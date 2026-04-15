/**
 * This handles both producing video the media option and receiving it, displaying it to the screne.
 */

import { parseScalabilityMode } from "mediasoup-client";
import type { Consumer } from "mediasoup-client/lib/types";
import {
  API,
  type ServerProducerRemoved,
  type ServerProducerAdded,
} from "../lib/api";
import { ConsumerStream } from "../lib/consumer";
import { DeviceWrapper, type VideoCodecMimeType } from "../lib/device";
import { LayerManager } from "../lib/layer";
import { MetricsLog } from "../lib/metrics";
import { EncodingType, ProducerStream } from "../lib/producer";
import { Config } from "./config";
import imgUrl from "../assets/videos/sample-webm-files-sample_1920x1080.webm";

function getVideoCodec(): HTMLSpanElement {
  return document.getElementById("video-codec") as HTMLSpanElement;
}

function getSpatialSpan(): HTMLSpanElement {
  return document.getElementById("spatial") as HTMLSpanElement;
}

function getTemporalSpan(): HTMLSpanElement {
  return document.getElementById("temporal") as HTMLSpanElement;
}

class VideoPreview {
  elem: HTMLVideoElement;

  constructor(elem: HTMLVideoElement) {
    this.elem = elem;

    console.info(`Initialised ${this.elem.id}`);
  }

  static fromId(id: string): VideoPreview {
    return new VideoPreview(document.getElementById(id) as HTMLVideoElement);
  }

  onEnd(cb: () => void) {
    this.elem.addEventListener("ended", cb);
  }

  reset() {
    this.elem.pause();
    this.elem.currentTime = 0;
  }

  setSrc(src: MediaStream | null) {
    this.elem.srcObject = src;
  }

  setSrcUrl(src: string) {
    this.elem.src = src;
  }

  capture(): MediaStream {
    return (this.elem as unknown as HTMLCanvasElement).captureStream();
  }

  play() {
    this.elem.play();
  }

  finished(): Promise<undefined> {
    return new Promise((resolve) => this.onEnd(() => resolve(undefined)));
  }
}

function updateOnScreenCodec(codec: VideoCodecMimeType) {
  getVideoCodec().innerText = codec.split("/")[1].toUpperCase() ?? "?";
  getVideoCodec().classList.remove("hidden");
}

function updateOnScreenLayers(spatial: number, temporal: number) {
  getSpatialSpan().innerText = String(spatial);
  getTemporalSpan().innerText = String(temporal);
}

function setupLayerBtns(layerMgr: LayerManager) {
  const decreaseBtn = document.getElementById(
    "decrease-layer",
  ) as HTMLButtonElement;
  decreaseBtn.onclick = () => layerMgr.decrease();

  const increaseBtn = document.getElementById(
    "increase-layer",
  ) as HTMLButtonElement;
  increaseBtn.onclick = () => layerMgr.increase();

  document.getElementById("layer-ctrl")?.classList.remove("hidden");
}

function createLayerMgrFor(consumer: Consumer) {
  if (consumer.kind === "video") {
    const encodings = consumer.rtpParameters.encodings ?? [];

    if (encodings[0]) {
      const scalabilityMode = parseScalabilityMode(
        encodings[0].scalabilityMode,
      );

      const layerMgr = new LayerManager(
        scalabilityMode.spatialLayers,
        scalabilityMode.temporalLayers,
      );
      layerMgr.attachToConsumer(api, consumer);
      layerMgr.addOnUpdate(updateOnScreenLayers);
      setupLayerBtns(layerMgr);

      const { spatial, temporal } = testInfo();
      layerMgr.set(spatial, temporal);
    }
  }
}

function showStreamInfo(stream: MediaStream) {
  setInterval(() => {
    const settings = stream.getTracks().at(0)?.getSettings();
    if (settings) {
      (document.getElementById("framerate") as HTMLSpanElement).innerText =
        `${settings?.frameRate?.toPrecision(3) ?? "0"}fps`;
      (document.getElementById("resolution") as HTMLSpanElement).innerText =
        `${settings?.width}x${settings?.height}`;

      document.getElementById("stream-info")?.classList.remove("hidden");
    } else {
      document.getElementById("stream-info")?.classList.add("hidden");
    }
  }, 500);
}

const api = new API();

const TEST_EPOCH = 10;

function testInfo(): {
  codec: VideoCodecMimeType;
  encType: EncodingType;
  spatial: number;
  temporal: number;
} {
  const [codec, encType, spatial, temporal] = tests[testNum % tests.length];

  return { codec, encType, spatial, temporal };
}

const tests: [VideoCodecMimeType, EncodingType, number, number][] = [
  ["video/av1", EncodingType.SVC, 0, 0],
  ["video/av1", EncodingType.SVC, 0, 1],
  ["video/av1", EncodingType.SVC, 0, 2],
  ["video/av1", EncodingType.SVC, 1, 0],
  ["video/av1", EncodingType.SVC, 1, 1],
  ["video/av1", EncodingType.SVC, 1, 2],
  ["video/av1", EncodingType.SVC, 2, 0],
  ["video/av1", EncodingType.SVC, 2, 1],
  ["video/av1", EncodingType.SVC, 2, 2],

  ["video/av1", EncodingType.Simulcast, 0, 0],
  ["video/av1", EncodingType.Simulcast, 0, 1],
  ["video/av1", EncodingType.Simulcast, 0, 2],
  ["video/av1", EncodingType.Simulcast, 1, 0],
  ["video/av1", EncodingType.Simulcast, 1, 1],
  ["video/av1", EncodingType.Simulcast, 1, 2],
  ["video/av1", EncodingType.Simulcast, 2, 0],
  ["video/av1", EncodingType.Simulcast, 2, 1],
  ["video/av1", EncodingType.Simulcast, 2, 2],

  ["video/vp9", EncodingType.SVC, 0, 0],
  ["video/vp9", EncodingType.SVC, 0, 1],
  ["video/vp9", EncodingType.SVC, 0, 2],
  ["video/vp9", EncodingType.SVC, 1, 0],
  ["video/vp9", EncodingType.SVC, 1, 1],
  ["video/vp9", EncodingType.SVC, 1, 2],
  ["video/vp9", EncodingType.SVC, 2, 0],
  ["video/vp9", EncodingType.SVC, 2, 1],
  ["video/vp9", EncodingType.SVC, 2, 2],

  ["video/vp9", EncodingType.Simulcast, 0, 0],
  ["video/vp9", EncodingType.Simulcast, 0, 1],
  ["video/vp9", EncodingType.Simulcast, 0, 2],
  ["video/vp9", EncodingType.Simulcast, 1, 0],
  ["video/vp9", EncodingType.Simulcast, 1, 1],
  ["video/vp9", EncodingType.Simulcast, 1, 2],
  ["video/vp9", EncodingType.Simulcast, 2, 0],
  ["video/vp9", EncodingType.Simulcast, 2, 1],
  ["video/vp9", EncodingType.Simulcast, 2, 2],
];

const MAX_TESTS = tests.length * TEST_EPOCH;

let testNum = 0;

new Config(async (config) => {
  const e2e = config.e2eWorker();
  const metrics = new MetricsLog();
  metrics.pause();

  const endTest = async () => {
    await metrics.logAllListeners();

    const { codec, encType, spatial, temporal } = testInfo();
    metrics.save(
      `${testNum}-${config.type()}-${codec}-${encType}-${spatial}-${temporal}`,
    );
    metrics.reset();
  };

  testNum = config.testNum;

  if (config.type() === "producer") {
    const device = new DeviceWrapper(api);

    const { codec, encType } = testInfo();

    const producer = new ProducerStream(api, device, codec, encType)
      .withEncryption(e2e)
      .withMetrics(metrics);
    updateOnScreenCodec(producer.codec);

    api.connect(config.roomId());
    await new Promise((resolve) => setTimeout(resolve, 100));

    const sendPreview = VideoPreview.fromId("preview");

    sendPreview.setSrcUrl(imgUrl);

    const stream = sendPreview.capture();
    metrics.listenTo(stream);
    showStreamInfo(stream);
    await producer.connectStream(stream);
    metrics.record();
    sendPreview.play();

    await sendPreview.finished();
    metrics.pause();
    await endTest();

    producer.close();
    api.disconnect();

    await new Promise((resolve) => setTimeout(resolve, 5000));

    if (testNum + 1 < MAX_TESTS) {
      const url = new URL(window.location.toString());
      url.search = config.asParams(true, testNum + 1).toString();
      window.location.replace(url);
    }
  } else {
    const url = new URL(window.location.toString());
    url.search = config.asParams(true).toString();
    url.searchParams.set("type", "producer");
    (document.getElementById("pair") as HTMLLinkElement).href = url.toString();
    const consumer = new ConsumerStream(api)
      .withEncryption(e2e)
      .withMetrics(metrics);
    consumer.addOnNewConsumer(createLayerMgrFor);

    const recvPreview = VideoPreview.fromId("preview");
    recvPreview.setSrc(consumer.stream);

    metrics.listenTo(consumer.stream);
    showStreamInfo(consumer.stream);

    let playing = false;
    api.waitFor("ProducerAdded", (info: ServerProducerAdded) => {
      const { spatial, temporal } = testInfo();

      consumer.consume(info.producerId, {
        spatialLayer: spatial,
        temporalLayer: temporal,
      });

      if (!playing) {
        recvPreview.play();
        metrics.record();
        playing = true;
      }
    });

    api.waitFor("ProducerRemoved", async (info: ServerProducerRemoved) => {
      console.log("ProducerRemoved", info);
      if (playing) {
        console.log("Pausing metrics");
        metrics.pause();

        // recvPreview.setSrc(null);
        recvPreview.elem.currentTime = 0;
      }

      await consumer.stopConsumption(info.producerId);

      if (playing) {
        console.log("Saving metrics");

        await endTest();

        playing = false;

        if (testNum + 1 < MAX_TESTS) {
          const url = new URL(window.location.toString());
          url.search = config.asParams(true, testNum + 1).toString();
          window.location.replace(url);
        }
      }
    });

    api.connect(config.roomId());
  }
});
