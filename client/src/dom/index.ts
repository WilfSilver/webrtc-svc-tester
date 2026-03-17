/**
 * This handles both producing video the media option and receiving it, displaying it to the screne.
 */

import { parseScalabilityMode } from "mediasoup-client";
import type { Consumer, RtpCodecCapability } from "mediasoup-client/lib/types";
import { API, type ProducerId } from "../lib/api";
import { ConsumerStream } from "../lib/consumer";
import { DeviceWrapper } from "../lib/device";
import { E2EWorker } from "../lib/e2e_manager";
import { LayerManager } from "../lib/layer";
import { ProducerStream } from "../lib/producer";

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

function updateOnScreenCodec(codec: RtpCodecCapability) {
  getVideoCodec().innerText = codec.mimeType?.split("/")[1] ?? "?";
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
const e2e = E2EWorker.newWithRandomKey();

const device = new DeviceWrapper(api);

const producer = new ProducerStream(api, device).withEncryption(e2e);
producer.addOnChosenCodec(updateOnScreenCodec);

const consumer = new ConsumerStream(api, device).withEncryption(e2e);
consumer.addOnNewConsumer(createLayerMgrFor);

const recvPreview = VideoPreview.fromId("preview-receive");
recvPreview.setSrc(consumer.stream);

producer.addOnNewProducer((producer) =>
  consumer.consume(producer.id as ProducerId),
);

api.connnect();

const sendPreview = VideoPreview.fromId("preview-send");

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

sendPreview.setSrc(mediaStream);
producer.connectStream(mediaStream);
