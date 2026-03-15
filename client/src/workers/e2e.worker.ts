/*
 *  Copyright (c) 2020 The WebRTC project authors, Wilf Silver. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import type { CryptoWorkerMessage, EncodedFrame } from "../shared/types";

/*
 * This is a worker doing the encode/decode transformations to add end-to-end
 * encryption to a WebRTC PeerConnection using the Insertable Streams API.
 */

type Controller = TransformStreamDefaultController<EncodedFrame>;

const NONCE_BYTE_LENGTH = 24; // 24-byte nonce (192-bit)

let currentCryptoKey: Uint8Array | undefined;
let useCryptoOffset = true;
let currentKeyIdentifier = 0;

// If using crypto offset (controlled by a checkbox):
// Do not encrypt the first couple of bytes of the payload. This allows
// a middle to determine video keyframes or the opus mode being used.
// For VP8 this is the content described in
//   https://tools.ietf.org/html/rfc6386#section-9.1
// which is 10 bytes for key frames and 3 bytes for delta frames.
// For opus (where encodedFrame.type is not set) this is the TOC byte from
//   https://tools.ietf.org/html/rfc6716#section-3.1
//
// It makes the (encrypted) video and audio much more fun to watch and listen to
// as the decoder does not immediately throw a fatal error.
const frameTypeToCryptoOffset: {
  [key in RTCEncodedVideoFrameType | "audio"]: number;
} = {
  key: 10,
  delta: 3,
  empty: 0,
  audio: 1,
};

// crypto.subtle.encrypt()

function getCryptoOffset(encodedFrame: EncodedFrame): number {
  if (!useCryptoOffset) return 0;

  return frameTypeToCryptoOffset[getFrameType(encodedFrame)];
}

function getFrameType(
  encodedFrame: EncodedFrame,
): RTCEncodedVideoFrameType | "audio" {
  if ("type" in encodedFrame) {
    return encodedFrame.type;
  }

  return "audio";
}

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
  console.log(
    `[e2e worker] [${direction}] ${performance.now().toFixed(2)} `,
    bytes.trim(),
    `len=${encodedFrame.data.byteLength}`,
    `type=${getFrameType(encodedFrame)}`,
    `ts=${encodedFrame.timestamp}`,
    `ssrc=${encodedFrame.getMetadata().synchronizationSource}`,
  );
}

let scount = 0;
function encodeFunction(encodedFrame: EncodedFrame, controller: Controller) {
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
}

let rcount = 0;
function decodeFunction(encodedFrame: EncodedFrame, controller: Controller) {
  if (rcount++ < 30) {
    // dump the first 30 packets
    dump(encodedFrame, "recv");
    // logFirstBytesInBuffer(new Uint8Array(encodedFrame.data), "recv");
  }

  if (encodedFrame.data.byteLength < NONCE_BYTE_LENGTH) {
    console.error(
      `[e2e worker] [recv] Corrupted frame received, byte length ${encodedFrame.data.byteLength}`,
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
        `[e2e worker] [recv] Key identifier mismatch, got ${keyIdentifier} expected ${currentKeyIdentifier}.`,
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
      console.error("[e2e worker] [recv] Currupted frame received: ", e);
      return;
    }
  }
  controller.enqueue(encodedFrame);
}

globalThis.onmessage = async (event: MessageEvent) => {
  const { operation } = event.data as CryptoWorkerMessage;
  if (operation === "encode") {
    console.log("[e2e worker]", operation);
    const { readableStream, writableStream } = event.data;
    const transformStream = new TransformStream({
      transform: encodeFunction,
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
  } else if (operation === "decode") {
    console.log("[e2e worker]", operation);
    const { readableStream, writableStream } = event.data;
    const transformStream = new TransformStream({
      transform: decodeFunction,
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
  } else if (operation === "setCryptoKey") {
    console.log("[e2e worker]", operation, event.data.currentCryptoKey);
    if (event.data.currentCryptoKey !== currentCryptoKey) {
      currentKeyIdentifier++;
    }
    currentCryptoKey = event.data.currentCryptoKey;
    useCryptoOffset = event.data.useCryptoOffset;
  }
};
