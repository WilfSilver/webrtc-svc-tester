import type {
  AppData,
  Producer,
  RtpCodecCapability,
  RtpEncodingParameters,
  Transport,
} from "mediasoup-client/lib/types";
import type { API, ServerInit } from "./api";
import { DeviceWrapper } from "./device";
import type { E2EWorker } from "./e2e_manager";

/**
 * The supported encoding type
 */
export enum EncodingType {
  Simulcast,
  SVC,
}

/**
 * This class wraps around all producers for a given stream and manages any
 * communication with the server.
 *
 * Example usage:
 *
 * ```ts
 *
 * const api = new API();
 * const e2e = E2EWorker.newWithRandomKey();
 *
 * // Create a producer with end to end encryption
 * const producer = new ProducerStream(api).withEncryption(e2e);
 * producer.addOnChosenCodec(updateOnScreenCodec);
 *
 * // Once configured, we can now connect the API causing the "Init" event
 * api.connect();
 *
 * const mediaStream = await navigator.mediaDevices.getUserMedia({
 *   audio: true,
 *   video: {
 *     width: {
 *       ideal: 1280,
 *     },
 *     height: {
 *       ideal: 720,
 *     },
 *     frameRate: {
 *       ideal: 60,
 *     },
 *   },
 * });
 *
 * // Creates all the internal producers and sends them to the server
 * producer.connectStream(mediaStream);
 * ```
 */
export class ProducerStream {
  api: API;
  transport?: Transport;
  device: DeviceWrapper;

  type: EncodingType;

  onChosenCodec: ((codec: RtpCodecCapability) => void)[];
  onNewProducer: ((producer: Producer<AppData>) => void)[];
  producers: Producer<AppData>[];

  /**
   * Constructs the steam and sets up listeners for the API
   *
   * @param api The API which will be used for all communications to the server
   * @param device The {@linkcode DeviceWrapper} which will be used for
   *   communications
   * @param type The type of encoding to be used for communications
   *
   * TODO: Fix the encoding type
   */
  constructor(
    api: API,
    device: DeviceWrapper | undefined,
    type: EncodingType = EncodingType.SVC,
  ) {
    if (!device) device = new DeviceWrapper(api);

    this.device = device;

    this.type = type;

    this.api = api;
    this.producers = [];

    this.onNewProducer = [];
    this.onChosenCodec = [];

    this.api.waitFor("Init", (msg: ServerInit) => this.init(msg), false);
  }

  /**
   * Adds end to end encryption to all producers created after this point.
   *
   * NOTE: This needs to be run before {@linkcode connectStream}, it is
   * recommended to be run during creation e.g.
   *
   * ```ts
   * const api = new API();
   * const e2e = E2EWorker.newWithRandomKey();
   *
   * const producer = new ProducerStream(api).withEncryption(e2e);
   * ```
   */
  withEncryption(e2e: E2EWorker): ProducerStream {
    this.addOnNewProducer((producer) => {
      if (producer.rtpSender) {
        e2e.setupSenderTransform(producer.rtpSender);
      }
    });

    return this;
  }

  /* Initialises the transport ready for the stream connection */
  private init(msg: ServerInit) {
    this.transport = this.device.inner.createSendTransport(
      msg.producerTransportOptions,
    );

    this.transport
      .on("connect", ({ dtlsParameters }, success) => {
        this.api
          .sendAndWait({
            action: "ConnectProducerTransport",
            dtlsParameters,
          })
          .then(() => {
            success();
            console.log("Producer transport connected");
          });
      })
      .on("produce", ({ kind, rtpParameters }, success) => {
        this.api
          .sendAndWait({
            action: "Produce",
            kind,
            rtpParameters,
          })
          .then(success);
      });
  }

  /**
   * Adds a new listener for when a producer is created during
   * {@linkcode connectStream}.
   *
   * @param cb The function to be called when a producer is created
   */
  addOnNewProducer(cb: (producer: Producer<AppData>) => void) {
    this.onNewProducer.push(cb);
  }

  /**
   * Adds a new listener for when a codec get's chosen for the video
   * during {@linkcode connectStream}.
   *
   * @param cb The function to be called with the chosen codec
   */
  addOnChosenCodec(cb: (codec: RtpCodecCapability) => void) {
    this.onChosenCodec.push(cb);
  }

  /**
   * Connects a given {@linkcode MediaStream} to the transport, creating
   * all producers required to send the tracks.
   *
   * NOTE: This must be called after the "Init" from the server
   */
  async connectStream(mediaStream: MediaStream) {
    if (this.producers.length > 0) {
      throw Error("Producers have already been initialised");
    }

    if (!this.transport) {
      throw Error("Transport has not been initialised yet");
    }

    console.info("Initialising producer stream");

    // And create producers for all tracks that were previously requested
    for (const track of mediaStream.getTracks()) {
      let encodings: RtpEncodingParameters[] | undefined;
      let codec: RtpCodecCapability | undefined;

      if (track.kind === "video") {
        codec = this.device.chooseCodec();
        if (!codec) {
          throw Error("Could not find suitable codec!!");
        }
        console.info("Chosen codec:", codec);

        for (const cb of this.onChosenCodec) {
          cb(codec);
        }

        // TODO: Check if encoding type is compatible with video format
        if (this.type === EncodingType.SVC) {
          encodings = [{ scalabilityMode: "S3T3" }];
        } else {
          encodings = [
            { scaleResolutionDownBy: 4, maxBitrate: 500000 },
            { scaleResolutionDownBy: 2, maxBitrate: 1000000 },
            { scaleResolutionDownBy: 1, maxBitrate: 5000000 },
          ];
        }
      }

      const producer = await this.transport?.produce({
        track,
        encodings,
        codec,
      });

      if (producer) {
        for (const cb of this.onNewProducer) {
          cb(producer);
        }

        this.producers.push(producer);
      }
      console.info(`${track.kind} producer created:`, producer);
    }
  }
}
