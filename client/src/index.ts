import { randomBytes } from "@noble/ciphers/utils.js";
import { Device, parseScalabilityMode } from "mediasoup-client";
import type {
  MediaKind,
  RtpCapabilities,
  RtpCodecCapability,
  RtpEncodingParameters,
  RtpParameters,
} from "mediasoup-client/lib/RtpParameters";
import type {
  DtlsParameters,
  Transport,
  TransportOptions,
} from "mediasoup-client/lib/Transport";
import type { AppData, Consumer, Producer } from "mediasoup-client/lib/types";
import type { DecodeStream, EncodeStream, SetCryptoKey } from "./shared/types";

type Brand<K, T> = K & { __brand: T };

type ConsumerId = Brand<string, "ConsumerId">;
type ProducerId = Brand<string, "ProducerId">;

interface ServerInit {
  action: "Init";
  consumerTransportOptions: TransportOptions;
  producerTransportOptions: TransportOptions;
  routerRtpCapabilities: RtpCapabilities;
}

interface ServerConnectedProducerTransport {
  action: "ConnectedProducerTransport";
}

interface ServerProduced {
  action: "Produced";
  id: ProducerId;
}

interface ServerConnectedConsumerTransport {
  action: "ConnectedConsumerTransport";
}

interface ServerConsumed {
  action: "Consumed";
  id: ConsumerId;
  kind: MediaKind;
  rtpParameters: RtpParameters;
}

type ServerMessage =
  | ServerInit
  | ServerConnectedProducerTransport
  | ServerProduced
  | ServerConnectedConsumerTransport
  | ServerConsumed;

interface ClientInit {
  action: "Init";
  rtpCapabilities: RtpCapabilities;
}

interface ClientConnectProducerTransport {
  action: "ConnectProducerTransport";
  dtlsParameters: DtlsParameters;
}

interface ClientConnectConsumerTransport {
  action: "ConnectConsumerTransport";
  dtlsParameters: DtlsParameters;
}

interface ClientProduce {
  action: "Produce";
  kind: MediaKind;
  rtpParameters: RtpParameters;
}

interface ClientConsume {
  action: "Consume";
  producerId: ProducerId;
}

interface ClientConsumerResume {
  action: "ConsumerResume";
  id: ConsumerId;
}

interface ClientSetConsumerPreferredLayers {
  action: "SetConsumerPreferredLayers";
  id: ConsumerId;
  preferredLayers: {
    spatialLayer: number;
    temporalLayer: number;
  };
}

type ClientMessage =
  | ClientInit
  | ClientConnectProducerTransport
  | ClientProduce
  | ClientConnectConsumerTransport
  | ClientConsume
  | ClientConsumerResume
  | ClientSetConsumerPreferredLayers;

function getVideoCodec(): HTMLSpanElement {
  return document.querySelector("#video-codec") as HTMLSpanElement;
}

function isFirefox(): boolean {
  return navigator.userAgent.toLowerCase().includes("firefox");
}

class LayerCtrl {
  private ctrl: ConsumerCtrl;

  maxSpatial: number;
  maxTemporal: number;
  spatial: number;
  temporal: number;

  decreaseBtn: HTMLButtonElement;
  increaseBtn: HTMLButtonElement;

  constructor(stream: ConsumerCtrl, maxSpatial: number, maxTemporal: number) {
    console.info(`Initialising Layer control (${maxSpatial}, ${maxTemporal})`);
    this.ctrl = stream;

    this.maxSpatial = maxSpatial + 1;
    this.maxTemporal = maxTemporal + 1;

    this.spatial = maxSpatial;
    this.temporal = maxTemporal;

    this.decreaseBtn = document.getElementById(
      "decrease-layer",
    ) as HTMLButtonElement;
    this.decreaseBtn.onclick = () => this.decrease();
    this.increaseBtn = document.getElementById(
      "increase-layer",
    ) as HTMLButtonElement;
    this.increaseBtn.onclick = () => this.increase();

    this.updateStream();
  }

  decrease() {
    this.temporal--;
    if (this.temporal < 0) {
      this.temporal += this.maxTemporal;

      this.spatial--;
      if (this.spatial < 0) this.spatial += this.maxSpatial;
    }

    this.updateStream();
  }

  increase() {
    this.temporal = (this.temporal + 1) % this.maxTemporal;
    if (this.temporal === 0) {
      this.spatial = (this.spatial + 1) % this.maxSpatial;
    }

    this.updateStream();
  }

  /**
   * Sends an update to the stream with the new information
   */
  private updateStream() {
    this.getSpatialSpan().innerText = String(this.spatial);
    this.getTemporalSpan().innerText = String(this.temporal);
    this.ctrl.setPreferredLayers(this.spatial, this.temporal);
  }

  private getSpatialSpan(): HTMLSpanElement {
    return document.getElementById("spatial") as HTMLSpanElement;
  }

  private getTemporalSpan(): HTMLSpanElement {
    return document.getElementById("temporal") as HTMLSpanElement;
  }
}

class VideoPreview {
  elem: HTMLVideoElement;

  constructor(elem: HTMLVideoElement) {
    this.elem = elem;

    this.elem.onloadedmetadata = () => {
      this.elem.play();
    };

    console.info(`Initialised ${this.elem.id}`);
  }

  static fromId(id: string): VideoPreview {
    return new VideoPreview(document.getElementById(id) as HTMLVideoElement);
  }

  setSrc(src: MediaStream) {
    this.elem.srcObject = src;
  }
}

/**
 * Code heavily inspired by: https://github.com/versatica/mediasoup-demo/blob/v3/app/src/e2e.js
 */
class E2E {
  worker: Worker;
  key: Uint8Array;
  useOffset: boolean;

  constructor(key: Uint8Array, useOffset: boolean = true) {
    const stream = new ReadableStream();

    this.key = key;
    this.useOffset = useOffset;

    window.postMessage(stream, "*", [stream]);
    this.worker = new Worker("/e2e-worker.js", { name: "e2e worker" });

    console.info("Setup E2EE worker");

    this.worker.postMessage({
      operation: "setCryptoKey",
      currentCryptoKey: key,
      useCryptoOffset: this.useOffset,
    } as SetCryptoKey);
  }

  static newWithRandomKey(useOffset: boolean = true): E2E {
    return new E2E(randomBytes(32), useOffset);
  }

  setupSenderTransform(sender: RTCRtpSender) {
    // @ts-ignore
    const senderStreams = sender.createEncodedStreams();
    const readableStream =
      senderStreams.readable || senderStreams.readableStream;
    const writableStream =
      senderStreams.writable || senderStreams.writableStream;

    this.worker.postMessage(
      {
        operation: "encode",
        readableStream,
        writableStream,
      } as EncodeStream,
      [readableStream, writableStream],
    );
  }

  setupReceiverTransform(receiver: RTCRtpReceiver) {
    // @ts-ignore
    const receiverStreams = receiver.createEncodedStreams();
    const readableStream =
      receiverStreams.readable || receiverStreams.readableStream;
    const writableStream =
      receiverStreams.writable || receiverStreams.writableStream;

    this.worker.postMessage(
      {
        operation: "decode",
        readableStream,
        writableStream,
      } as DecodeStream,
      [readableStream, writableStream],
    );
  }
}

class ProducerCtrl {
  preview: VideoPreview;

  server: ServerCtrl;
  device: Device;
  transport?: Transport;

  producers: Producer<AppData>[];

  constructor(server: ServerCtrl, device: Device) {
    this.server = server;
    this.device = device;
    this.producers = [];
    this.preview = VideoPreview.fromId("preview-send");
  }

  async handle(message: ServerMessage): Promise<boolean> {
    switch (message.action) {
      case "Init": {
        console.debug("Initialising ProducerCtrl");
        await this.device.load({
          routerRtpCapabilities: message.routerRtpCapabilities,
        });

        // Send client-side initialization message back right away
        this.server.send({
          action: "Init",
          rtpCapabilities: this.device.recvRtpCapabilities,
        });

        this.transport = this.device.createSendTransport({
          ...message.producerTransportOptions,
          additionalSettings: {
            // @ts-ignore
            encodedInsertableStreams: true,
          },
        });

        this.transport
          .on("connect", ({ dtlsParameters }, success) => {
            this.server.send({
              action: "ConnectProducerTransport",
              dtlsParameters,
            });
            this.server.waitFor("ConnectedProducerTransport", () => {
              success();
              console.log("Producer transport connected");
            });
          })
          .on("produce", ({ kind, rtpParameters }, success) => {
            this.server.send({
              action: "Produce",
              kind,
              rtpParameters,
            });

            this.server.waitFor("Produced", ({ id }: ServerProduced) => {
              success({ id });
            });
          });

        await this.initStream();

        break;
      }
    }

    return false;
  }

  private async initStream() {
    if (this.producers.length > 0) {
      throw Error("Producers have already been initialised");
    }

    console.info("Initialising producer stream");

    // Request microphone and camera access, in real-world apps you may want
    // to do this separately so that audio-only and video-only cases are
    // handled nicely instead of failing completely
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: {
          ideal: 1280,
        },
        height: {
          ideal: 720,
        },
        frameRate: {
          ideal: 60,
        },
      },
    });

    this.preview.setSrc(mediaStream);

    // And create producers for all tracks that were previously requested
    for (const track of mediaStream.getTracks()) {
      let encodings: RtpEncodingParameters[] | undefined;
      let codec: RtpCodecCapability | undefined;

      if (track.kind === "video") {
        codec = this.chooseCodec();
        if (!codec) {
          throw Error("Could not find suitable codec!!");
        }
        console.info("Chosen codec:", codec);

        getVideoCodec().innerText = codec.mimeType?.split("/")[1] ?? "?";

        if (codec.mimeType.toLowerCase() === "video/vp8") {
          encodings = [
            { scaleResolutionDownBy: 4, maxBitrate: 500000 },
            { scaleResolutionDownBy: 2, maxBitrate: 1000000 },
            { scaleResolutionDownBy: 1, maxBitrate: 5000000 },
          ];
        } else if (
          ["video/vp9", "video/av1"].includes(codec.mimeType.toLowerCase())
        ) {
          encodings = [{ scalabilityMode: "S3T3" }];
        }
      }

      const producer = await this.transport?.produce({
        track,
        encodings,
        codec,
      });

      if (producer) {
        if (producer.rtpSender)
          this.server.e2e.setupSenderTransform(producer.rtpSender);

        this.producers.push(producer);
      }
      console.info(`${track.kind} producer created:`, producer);
    }
  }

  private chooseCodec(): RtpCodecCapability | undefined {
    console.debug("Supported codecs: ", this.device.recvRtpCapabilities.codecs);
    return (
      this.device.recvRtpCapabilities.codecs?.find((codec) => {
        // Firefox supports VP9, but not SVC
        return codec.mimeType.toLowerCase() === "video/vp9" && !isFirefox();
      }) ??
      this.device.recvRtpCapabilities.codecs?.find(
        (codec) => codec.mimeType.toLowerCase() === "video/vp8",
      )
    );
  }
}

class ConsumerCtrl {
  server: ServerCtrl;

  device: Device;
  transport?: Transport;

  preview: VideoPreview;
  layer?: LayerCtrl;
  inner?: Consumer;

  constructor(server: ServerCtrl, device: Device) {
    this.server = server;
    this.device = device;
    this.preview = VideoPreview.fromId("preview-receive");
  }

  async handle(message: ServerMessage): Promise<boolean> {
    switch (message.action) {
      case "Init": {
        console.info("Initialising Consumer");

        this.transport = this.device.createRecvTransport({
          ...message.consumerTransportOptions,
          additionalSettings: {
            // @ts-ignore
            encodedInsertableStreams: true,
          },
        });

        this.transport.on("connect", ({ dtlsParameters }, success) => {
          this.server.send({
            action: "ConnectConsumerTransport",
            dtlsParameters,
          });
          this.server.waitFor("ConnectedConsumerTransport", () => {
            success();
            console.log("Consumer transport connected");
          });
        });

        await this.consumeAll(this.server.producer.producers);
        break;
      }
    }

    return false;
  }

  setPreferredLayers(spatialLayer: number, temporalLayer: number) {
    this.checkConsumer("to update preferred layers");

    this.server.send({
      action: "SetConsumerPreferredLayers",
      id: this.inner?.id as ConsumerId,
      preferredLayers: { spatialLayer, temporalLayer },
    });
  }

  private checkConsumer(ctx: string) {
    if (!this.inner) {
      throw new Error(`Failed ${ctx}: video consumer not found.`);
    }
  }

  private async consumeAll(producers: Producer<AppData>[]) {
    const transport = this.transport;
    if (!transport) {
      throw Error("Transport was not initialised");
    }
    console.log("Consuming all producers", producers);

    const stream = new MediaStream();

    // For simplicity of this example producers were stored in an array
    // and are now all consumed one at a time
    for (const producer of producers) {
      await new Promise((resolve) => {
        // Send request to consume producer
        this.server.send({
          action: "Consume",
          producerId: producer.id as ProducerId,
        });

        // And wait for confirmation, but, obviously, no error handling,
        // which you should definitely have in real-world applications
        this.server.waitFor("Consumed", async (message: ServerConsumed) => {
          // Once confirmation is received, corresponding consumer
          // can be created client-side
          const consumer = await transport.consume({
            id: message.id,
            kind: message.kind,
            rtpParameters: message.rtpParameters,
            producerId: producer.id,
          });

          if (consumer.rtpReceiver)
            this.server.e2e.setupReceiverTransform(consumer.rtpReceiver);

          console.info(`${consumer?.kind} consumer created:`, consumer);

          // Consumer needs to be resumed after being created in
          // paused state (see official documentation about why:
          // https://mediasoup.org/documentation/v3/mediasoup/api/#transport-consume)
          this.server.send({
            action: "ConsumerResume",
            id: consumer?.id as ConsumerId,
          });

          stream.addTrack(consumer?.track);
          this.preview.setSrc(stream);

          if (consumer.kind === "video") {
            this.inner = consumer;

            const encodings = this.inner.rtpParameters.encodings ?? [];

            if (encodings[0]) {
              const scalabilityMode = parseScalabilityMode(
                encodings[0].scalabilityMode,
              );

              this.layer = new LayerCtrl(
                this,
                scalabilityMode.spatialLayers,
                scalabilityMode.temporalLayers,
              );
            }
          }

          resolve(undefined);
        });
      });
    }
  }
}

class ServerCtrl {
  ws: WebSocket;

  waitingForResponse: Map<
    ServerMessage["action"],
    (message: ServerMessage) => void
  >;

  consumer: ConsumerCtrl;
  producer: ProducerCtrl;

  e2e: E2E;

  constructor() {
    this.e2e = E2E.newWithRandomKey();

    console.info("Initiating websocket");
    this.ws = new WebSocket("ws://localhost:3000/ws");

    this.ws.onmessage = async (message) => {
      const decodedMessage: ServerMessage = JSON.parse(message.data);
      this.handle(decodedMessage);
    };

    this.ws.onerror = console.error;

    this.waitingForResponse = new Map();

    const device = new Device();
    this.consumer = new ConsumerCtrl(this, device);
    this.producer = new ProducerCtrl(this, device);
  }

  send(message: ClientMessage) {
    console.debug("Sending", message);
    this.ws.send(JSON.stringify(message));
  }

  waitFor<T extends ServerMessage>(
    action: T["action"],
    callback: (message: T) => void,
  ) {
    console.debug(`Waiting for ${action}`);
    this.waitingForResponse.set(
      action,
      callback as (message: ServerMessage) => void,
    );
  }

  async handle(message: ServerMessage): Promise<boolean> {
    console.debug("Received: ", message);

    if (await this.producer.handle(message)) return true;
    if (await this.consumer.handle(message)) return true;

    const callback = this.waitingForResponse.get(message.action);

    if (callback) {
      this.waitingForResponse.delete(message.action);
      console.debug(`Calling back for ${message.action}`);
      callback(message);
    }

    return false;
  }
}

declare var serverCtrl: ServerCtrl;
serverCtrl = new ServerCtrl();
