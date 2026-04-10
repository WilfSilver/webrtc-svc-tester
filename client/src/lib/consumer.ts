import type { Consumer, Transport } from "mediasoup-client/lib/types";
import type { API, ConsumerId, ProducerId, ServerInit } from "./api";
import { DeviceWrapper } from "./device";
import type { E2EWorker } from "./e2e_manager";
import { MetricsLog } from "./metrics";

/**
 * This class wraps around the creation of all consumers and the resultant
 * {@linkcode MediaStream} once they are created.
 *
 * Example usage:
 *
 * ```ts
 * const api = new API();
 * const e2e = E2EWorker.newWithRandomKey();
 *
 * // Create a consumer with end to end encryption
 * const consumer = new ConsumerStream(api).withEncryption(e2e);
 *
 * consumer.addOnNewConsumer((consumer) => {
 *  if (consumer.kind === "video") {
 *    const encodings = consumer.rtpParameters.encodings ?? [];
 *
 *    if (encodings[0]) {
 *      const scalabilityMode = parseScalabilityMode(
 *        encodings[0].scalabilityMode,
 *      );
 *
 *      const layerMgr = new LayerManager(
 *        scalabilityMode.spatialLayers,
 *        scalabilityMode.temporalLayers,
 *      );
 *      layerMgr.attachToConsumer(api, consumer);
 *    }
 *  }
 * });
 *
 * // Once configured, we can now connect the API causing the "Init" event
 * api.connect();
 *
 * consumer.consume(getProducer());
 * ```
 */
export class ConsumerStream {
  api: API;
  transport?: Transport;
  device: DeviceWrapper;

  stream: MediaStream;

  onNewConsumer: ((consumer: Consumer) => void)[];

  producerToTrack: Record<ProducerId, MediaStreamTrack>;

  /**
   * Constructs the steam and sets up listeners for the API
   *
   * @param api The API which will be used for all communications to the server
   * @param device The {@linkcode DeviceWrapper} which will be used for
   *   communications
   */
  constructor(api: API, device: DeviceWrapper | undefined = undefined) {
    if (!device) device = new DeviceWrapper(api);

    this.device = device;
    this.api = api;

    this.stream = new MediaStream();
    this.onNewConsumer = [];

    this.api.waitFor("Init", (msg: ServerInit) => this.init(msg), false);

    this.producerToTrack = {};
  }

  /**
   * Adds end to end encryption to all consumers created after this point.
   *
   * NOTE: This needs to be run before {@linkcode consume}, it is
   * recommended to be run during creation e.g.
   *
   * ```ts
   * const api = new API();
   * const e2e = E2EWorker.newWithRandomKey();
   *
   * const producer = new ConsumerStream(api).withEncryption(e2e);
   * ```
   */
  withEncryption(e2e: E2EWorker): ConsumerStream {
    this.addOnNewConsumer((consumer) => {
      if (consumer.rtpReceiver)
        e2e.setupReceiverTransform(consumer.rtpReceiver);
    });
    return this;
  }

  /**
   * Logs the transport data to the given metrics log
   *
   * NOTE: This needs to be run before {@linkcode consume}, it is
   * recommended to be run during creation e.g.
   *
   * ```ts
   * const api = new API();
   * const metrics = new MetricsLog();
   *
   * const consumer = new ConsumerStream(api).withMetrics(metrics);
   * ```
   */
  withMetrics(metrics: MetricsLog): ConsumerStream {
    this.addOnNewConsumer((consumer) => {
      metrics.listenTo(consumer);
    });

    if (this.transport) {
      metrics.listenTo(this.transport);
    } else {
      this.api.waitFor("Init", (_) => {
        if (this.transport) metrics.listenTo(this.transport);
      });
    }

    return this;
  }

  /* Initialises the transport ready for consumption */
  private init(msg: ServerInit) {
    // Send client-side initialization message back right away
    this.api.send({
      action: "Init",
      rtpCapabilities: this.device.inner.recvRtpCapabilities,
    });

    this.transport = this.device.inner.createRecvTransport(
      msg.consumerTransportOptions,
    );

    this.transport.on("connect", ({ dtlsParameters }, success) => {
      this.api
        .sendAndWait({
          action: "ConnectConsumerTransport",
          dtlsParameters,
        })
        .then(() => {
          success();
          console.log("Consumer transport connected");
        });
    });
  }

  /**
   * Adds a new listener for when a consumer is created during
   * {@linkcode consume}.
   *
   * @param cb The function to be called when a consumer is created
   */
  addOnNewConsumer(cb: (consumer: Consumer) => void) {
    this.onNewConsumer.push(cb);
  }

  /**
   * Consumes the given producer adding it to the {@linkcode stream}.
   *
   * The consumer is also sent to any {@linkcode onNewConsumer} callback
   *
   * @returns The consumer created
   */
  async consume(producer: ProducerId): Promise<Consumer> {
    await new Promise((resolve) => setTimeout(resolve, 50));

    const transport = this.transport;
    if (!transport) {
      throw Error("Transport was not initialised");
    }
    // Send request to consume producer
    return await this.api
      .sendAndWait({
        action: "Consume",
        producerId: producer,
      })
      .then(async (msg) => {
        // Once confirmation is received, corresponding consumer
        // can be created client-side
        const consumer = await transport.consume({
          id: msg.id,
          kind: msg.kind,
          rtpParameters: msg.rtpParameters,
          producerId: producer,
        });

        for (const cb of this.onNewConsumer) cb(consumer);

        console.info(`${consumer?.kind} consumer created:`, consumer);

        // Consumer needs to be resumed after being created in
        // paused state (see official documentation about why:
        // https://mediasoup.org/documentation/v3/mediasoup/api/#transport-consume)
        this.api.send({
          action: "ConsumerResume",
          id: consumer?.id as ConsumerId,
        });

        console.log(consumer?.track);
        this.stream.addTrack(consumer?.track);

        console.log("Producer: ", producer);
        if (consumer?.track) this.producerToTrack[producer] = consumer?.track;

        return consumer;
      });
  }

  async stopConsumption(producer: ProducerId) {
    if (producer in this.producerToTrack) {
      this.stream.removeTrack(this.producerToTrack[producer]);
      delete this.producerToTrack[producer];
    }
  }

  close() {
    this.transport?.close();
  }
}
