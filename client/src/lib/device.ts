import { Device } from "mediasoup-client";
import type { RtpCodecCapability } from "mediasoup-client/lib/RtpParameters";
import type { API, ServerInit } from "./api";

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
   *
   * TODO: Give choice to user
   */
  chooseCodec(): RtpCodecCapability | undefined {
    console.debug("Supported codecs: ", this.inner.recvRtpCapabilities.codecs);
    return (
      this.inner.recvRtpCapabilities.codecs?.find((codec) => {
        // Firefox supports VP9, but not SVC
        return codec.mimeType.toLowerCase() === "video/vp9" && !isFirefox();
      }) ??
      this.inner.recvRtpCapabilities.codecs?.find(
        (codec) => codec.mimeType.toLowerCase() === "video/vp8",
      )
    );
  }
}

function isFirefox(): boolean {
  return navigator.userAgent.toLowerCase().includes("firefox");
}
