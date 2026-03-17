import { randomBytes } from "@noble/ciphers/utils.js";
import {
  type E2EWorkerOptions,
  type SetCryptoKey,
  TransformDir,
} from "../shared/types";

/**
 * This code acts as the basic interface for the encryption part of the stream,
 * setting up and communicating with the worker, see [../workers/e2e.worker.ts]
 *
 * NOTE: `setupSenderTransform` and/or `setupReceiverTransform` must be setup
 * properly
 *
 * See {@linkcode setupSenderTransform} and {@linkcode setupReceiverTransform}
 * for example usage.
 *
 * Code heavily inspired by:
 * {@link https://github.com/versatica/mediasoup-demo/blob/v3/app/src/e2e.js}
 */
export class E2EWorker {
  private worker: Worker;

  constructor(key: Uint8Array, useOffset: boolean = true) {
    const stream = new ReadableStream();

    window.postMessage(stream, "*", [stream]);
    this.worker = new Worker("/src/workers/e2e.worker.ts", {
      type: "module",
      name: "e2e worker",
    });

    console.info("Setup E2EE worker");

    this.worker.postMessage({
      operation: "setCryptoKey",
      currentCryptoKey: key,
      useCryptoOffset: useOffset,
    } as SetCryptoKey);
  }

  static newWithRandomKey(useOffset: boolean = true): E2EWorker {
    return new E2EWorker(randomBytes(32), useOffset);
  }

  /**
   * Connects the encryption process to the given sender
   *
   * Example usage:
   *
   * ```ts
   * const e2e = E2EWorker.newWithRandomKey();
   *
   * const device = new Device();
   * const transport = device.createSendTransport({});
   *
   * // ...
   *
   * const mediaStream = await navigator.mediaDevices.getUserMedia({
   *   video: true,
   * });
   *
   * const track = mediaStream.getTracks()[0];
   *
   * const producer = await transport.produce({
   *   track,
   *   encodings: [{ scalabilityMode: "S3T3" }],
   *   codec: { ... },
   * });
   *
   * if (producer.rtpSender)
   *   e2e.setupSenderTransform(producer.rtpSender);
   * ```
   */
  setupSenderTransform(sender: RTCRtpSender) {
    sender.transform = new RTCRtpScriptTransform(this.worker, {
      dir: TransformDir.Sender,
    } satisfies E2EWorkerOptions);
  }

  /**
   * Connects the encryption process to the given sender
   *
   * Example usage:
   *
   * ```ts
   * const api = new API();
   * const e2e = E2EWorker.newWithRandomKey();
   *
   * const producer = ...;
   *
   * api.waitFor("Consumed", async (message: ServerConsumed) => {
   *   const consumer = await transport.consume({
   *     id: message.id,
   *     kind: message.kind,
   *     trpParameters: message.rtpParameters,
   *     producerId: producer.id,
   *   });
   *
   *   if (consumer.rtpReceiver)
   *     e2e.setupReceiverTransform(consumer.rtpReceiver)
   * })
   *
   * ```
   */
  setupReceiverTransform(receiver: RTCRtpReceiver) {
    receiver.transform = new RTCRtpScriptTransform(this.worker, {
      dir: TransformDir.Receiver,
    } satisfies E2EWorkerOptions);
  }
}
