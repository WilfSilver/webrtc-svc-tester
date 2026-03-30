/**
 * This handles both producing video the media option and receiving it, displaying it to the screne.
 */

import { parseScalabilityMode } from "mediasoup-client";
import type { Consumer } from "mediasoup-client/lib/types";
import {
  API,
  ServerInit,
  ServerProducerAdded,
  ServerProducerRemoved,
} from "../lib/api";
import { ConsumerStream } from "../lib/consumer";
import { DeviceWrapper, type VideoCodecMimeType } from "../lib/device";
import { LayerManager } from "../lib/layer";
import { ProducerStream } from "../lib/producer";
import { Config, ProducerConfig } from "./config";

function getVideoCodec(): HTMLSpanElement {
  return document.querySelector("#video-codec") as HTMLSpanElement;
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

function updateOnScreenCodec(codec: VideoCodecMimeType) {
  getVideoCodec().innerText = codec.split("/")[1].toUpperCase() ?? "?";
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
    }
  }
}

const api = new API();

new Config(async (config) => {
  const e2e = config.e2eWorker();

  const device = new DeviceWrapper(api);

  if (config instanceof ProducerConfig) {
    const producer = new ProducerStream(api, device).withEncryption(e2e);
    updateOnScreenCodec(producer.codec);

    const producerIdsInp = document.getElementById(
      "producer-ids-info",
    ) as HTMLInputElement;
    producer.addOnNewProducer((p) => {
      console.log(p.id);
      if (producerIdsInp.value !== "") producerIdsInp.value += ",";

      producerIdsInp.value += p.id;
    });

    api.connnect(config.roomId());

    const sendPreview = VideoPreview.fromId("preview-send");

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: {
          ideal: 1280,
        },
        height: {
          ideal: 720,
        },
        frameRate: {
          ideal: 30,
        },
      },
    });

    sendPreview.setSrc(mediaStream);
    producer.connectStream(mediaStream);

    document.getElementById("producer-info")?.classList.remove("hidden");
  } else {
    const consumer = new ConsumerStream(api, device).withEncryption(e2e);
    consumer.addOnNewConsumer(createLayerMgrFor);

    const recvPreview = VideoPreview.fromId("preview-receive");
    recvPreview.setSrc(consumer.stream);

    const toConsume = [];
    api.waitFor("ProducerAdded", (info: ServerProducerAdded) => {
      console.log({ info });
      toConsume.push(info.producerId);
    });

    api.waitFor("Init", (_: ServerInit) => {
      for (const c of toConsume) consumer.consume(c);
    });

    api.waitFor("ProducerRemoved", () => {
      // Ignore Producer I guess
    });

    api.connnect(config.roomId());
  }
});
