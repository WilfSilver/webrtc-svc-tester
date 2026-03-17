/*
 * Code inspired by the WebRTC project, however has been rewritten to support
 * the new [RTCRtpScriptTransform](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpScriptTransform)
 * spec as well as use xChaCha20-Poly1305 encryption.
 *
 * Written with help of [Mozilla's docs](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_Encoded_Transforms)
 *
 * Specifically this worker manages the encryption and decryption process for
 * a sent video signal.
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import {
  type CryptoWorkerMessage,
  type E2EWorkerOptions,
  type EncodedFrame,
  TransformDir,
} from "../shared/types";

// Types are still in draft stage
interface RTCRtpScriptTransformer {
  // biome-ignore lint/suspicious/noExplicitAny: This is the specification
  options: any;
  readable: ReadableStream;
  writable: WritableStream;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  dispatchEvent(event: Event): boolean;
  generateKeyFrame(rid?: string): Promise<number>;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  sendKeyFrameRequest(): Promise<void>;
}
interface RTCTransformEvent {
  AT_TARGET: 2;
  bubbles: boolean;
  BUBBLING_PHASE: 3;
  cancelable: boolean;
  cancelBubble: boolean;
  CAPTURING_PHASE: 1;
  composed: boolean;
  currentTarget: EventTarget;
  defaultPrevented: boolean;
  eventPhase: number;
  isTrusted: boolean;
  NONE: 0;
  returnValue: boolean;
  srcElement: EventTarget;
  target: EventTarget;
  timeStamp: number;
  transformer: RTCRtpScriptTransformer;
  type: string;
  composedPath(): EventTarget[];
  initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void;
  preventDefault(): void;
  stopImmediatePropagation(): void;
  stopPropagation(): void;
}

const PREFIX = "[e2e worker]";
const NONCE_BYTE_LENGTH = 24; // 24-byte nonce (192-bit)

let currentCryptoKey: Uint8Array | undefined;
let useCryptoOffset = true;
let currentKeyIdentifier = 0;

/* TODO: Check different format requirements
 *
 * We need to make sure we are not encrypting information about keyframes, if
 * `cryptoOffset` is set to `true`.
 *
 * See https://tools.ietf.org/html/rfc6386#section-9.1 for VP8
 */
const frameTypeToCryptoOffset: {
  [key in RTCEncodedVideoFrameType | "audio"]: number;
} = {
  key: 10,
  delta: 3,
  empty: 0,
  audio: 1,
};

/**
 * Gets the crypto offset, account for when {@linkcode useCryptoOffset} is set
 * to false
 *
 * @param encodedFrame to get the specific offset for
 *
 * @returns The offset which should be.
 */
function getCryptoOffset(encodedFrame: EncodedFrame): number {
  if (!useCryptoOffset) return 0;

  return frameTypeToCryptoOffset[getFrameType(encodedFrame)];
}

/**
 * @param encodedFrame The frame to get the normalised type from
 *
 * @returns the frame type, accounting for when encoding audio frames.
 */
function getFrameType(
  encodedFrame: EncodedFrame,
): RTCEncodedVideoFrameType | "audio" {
  if ("type" in encodedFrame) {
    return encodedFrame.type;
  }

  return "audio";
}

/**
 * Prints basic information about the encoded frame
 *
 * @param encodedFrame The frame to print info about
 * @param direction The direction this is happening for
 * @param max The maximum number of bytes to print out from the frame buffer
 */
function dump(
  encodedFrame: EncodedFrame,
  direction: "send" | "recv",
  max = 16,
) {
  const data = new Uint8Array(encodedFrame.data);
  let bytes = "";
  for (let j = 0; j < data.length && j < max; j++) {
    const val = data[j];

    bytes += `${(val < 16 ? "0" : "") + val.toString(16)} `;
  }
  console.debug(
    `${PREFIX} [${direction}] ${performance.now().toFixed(2)} `,
    bytes.trim(),
    `len=${encodedFrame.data.byteLength}`,
    `type=${getFrameType(encodedFrame)}`,
    `ts=${encodedFrame.timestamp}`,
    `ssrc=${encodedFrame.getMetadata().synchronizationSource}`,
  );
}

/* Creates a transform which encrypts every frame with xChaCha20-Poly1305 */
function createSenderTransform(): TransformStream<EncodedFrame, EncodedFrame> {
  let scount = 0;
  return new TransformStream({
    start() {},
    flush() {},
    async transform(encodedFrame, controller) {
      if (scount++ < 30) {
        // dump the first 30 packets.
        dump(encodedFrame, "send");
      }
      if (currentCryptoKey) {
        const nonce = randomBytes(NONCE_BYTE_LENGTH);
        const chacha = xchacha20poly1305(currentCryptoKey, nonce);

        const cryptoOffset = getCryptoOffset(encodedFrame);

        const data = new Uint8Array(encodedFrame.data);
        const encryptedData = chacha.encrypt(data.subarray(cryptoOffset));

        const newData = new Uint8Array(
          cryptoOffset + encryptedData.byteLength + nonce.byteLength + 1,
        );

        // Copy all the data accross
        newData.set(data.subarray(0, cryptoOffset));
        newData.set(encryptedData, cryptoOffset);
        newData.set(nonce, cryptoOffset + encryptedData.length);

        newData[newData.byteLength - 1] = currentKeyIdentifier;

        encodedFrame.data = newData.buffer;
      }
      controller.enqueue(encodedFrame);
    },
  });
}

/* Creates a transform which decrypts every frame with xChaCha20-Poly1305 */
function createReceiverTransform(): TransformStream<
  EncodedFrame,
  EncodedFrame
> {
  let rcount = 0;
  return new TransformStream({
    start() {},
    flush() {},
    async transform(encodedFrame, controller) {
      if (rcount++ < 30) {
        // dump the first 30 packets
        dump(encodedFrame, "recv");
      }

      if (encodedFrame.data.byteLength < NONCE_BYTE_LENGTH) {
        console.error(
          `${PREFIX} [recv] Corrupted frame received, byte length ${encodedFrame.data.byteLength}`,
        );
        return; // This can happen when the key is set and there is an unencrypted frame in-flight.
      }

      // Remember last key identifier bit at the end
      const packetLength = encodedFrame.data.byteLength - NONCE_BYTE_LENGTH - 1;

      const data = new Uint8Array(encodedFrame.data);
      const nonce = data.subarray(packetLength, data.length - 1);

      if (currentCryptoKey) {
        const offset = Math.min(packetLength, getCryptoOffset(encodedFrame));
        const encryptedData = data.subarray(offset, packetLength);

        const keyIdentifier = data[data.length - 1];
        if (keyIdentifier !== currentKeyIdentifier) {
          console.log(
            `${PREFIX} [recv] Key identifier mismatch, got ${keyIdentifier} expected ${currentKeyIdentifier}.`,
          );
          return;
        }

        const chacha = xchacha20poly1305(currentCryptoKey, nonce);

        try {
          const decryptedData = chacha.decrypt(encryptedData);

          const newData = new Uint8Array(decryptedData.byteLength + offset);
          newData.set(data.subarray(0, offset));
          newData.set(decryptedData, offset);

          encodedFrame.data = newData.buffer;
        } catch (e) {
          console.error(PREFIX, "[recv] Currupted frame received: ", e);
          return;
        }
      }
      controller.enqueue(encodedFrame);
    },
  });
}

// @ts-expect-error - Still in draft stage
addEventListener("rtctransform", (event: RTCTransformEvent) => {
  let transform: TransformStream;

  const options = event.transformer.options as E2EWorkerOptions;

  switch (options.dir) {
    case TransformDir.Sender:
      transform = createSenderTransform();
      break;
    case TransformDir.Receiver:
      transform = createReceiverTransform();
      break;
    default:
      console.error(
        `Unknown transform with options:`,
        event.transformer.options,
      );
      return;
  }

  event.transformer.readable
    .pipeThrough(transform)
    .pipeTo(event.transformer.writable);

  console.info(PREFIX, `[${options.dir}] Connected transformer`);
});

globalThis.onmessage = async (event: MessageEvent) => {
  const { operation } = event.data as CryptoWorkerMessage;
  if (operation === "setCryptoKey") {
    console.info(PREFIX, operation, event.data.currentCryptoKey);
    if (event.data.currentCryptoKey !== currentCryptoKey) {
      currentKeyIdentifier++;
    }
    currentCryptoKey = event.data.currentCryptoKey;
    useCryptoOffset = event.data.useCryptoOffset;
  }
};
