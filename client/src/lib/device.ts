import { Device } from "mediasoup-client";
import type { RtpCodecCapability } from "mediasoup-client/lib/RtpParameters";
import type { API, ServerInit } from "./api";

/* Supported codecs on the server */
export type VideoCodecMimeType = "video/vp9" | "video/av1";

/**
 * Basic wrapper around {@linkcode Device} to handle the initialisation
 */
export class DeviceWrapper {
  inner: Device;

  constructor(api: API) {
    this.inner = new Device();
    api.waitFor("Init", (msg: ServerInit) => this.init(msg), false);
  }

  private async init(msg: ServerInit) {
    console.log("Initialising device");
    await this.inner.load({
      routerRtpCapabilities: msg.routerRtpCapabilities,
    });
    console.log("Initialised device");
  }

  /**
   * Chooses the best codec supported by the browser and server
   */
  getCodecCapabilites(
    mimeType: VideoCodecMimeType,
  ): RtpCodecCapability | undefined {
    console.debug("Supported codecs: ", this.inner.recvRtpCapabilities.codecs);
    return this.inner.recvRtpCapabilities.codecs?.find((codec) => {
      return codec.mimeType.toLowerCase() === mimeType;
    });
  }
}
