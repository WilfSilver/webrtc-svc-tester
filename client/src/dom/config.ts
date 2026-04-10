import { randomBytes } from "@noble/ciphers/utils.js";
import type { ProducerId } from "../lib/api";
import type { VideoCodecMimeType } from "../lib/device";
import { E2EWorker } from "../lib/e2e_manager";
import { EncodingType } from "../lib/producer";

export class Config {
  inner: ProducerConfig | ConsumerConfig;
  select: HTMLSelectElement;
  submit: HTMLButtonElement;

  constructor(onsubmit: (config: ProducerConfig | ConsumerConfig) => void) {
    this.inner = new ProducerConfig();

    this.select = document.getElementById("video-client") as HTMLSelectElement;
    this.submit = document.getElementById("config-submit") as HTMLButtonElement;

    this.submit.onclick = () => {
      this.inner.disable();
      this.select.disabled = true;
      this.submit.disabled = true;
      onsubmit(this.inner);
    };

    this.select.onchange = () => {
      if (this.inner.type() === this.select.value) return;

      this.inner.hide();
      switch (this.select.value) {
        case "producer":
          this.inner = new ProducerConfig();
          break;
        case "consumer":
          this.inner = new ConsumerConfig();
          break;
      }
    };
  }
}

export class BaseConfig {
  roomIdInput: HTMLInputElement;
  encryptionKeyInput: HTMLInputElement;

  constructor() {
    this.roomIdInput = document.getElementById("room-id") as HTMLInputElement;

    this.encryptionKeyInput = document.getElementById(
      "encryption-key",
    ) as HTMLInputElement;
  }

  encryptionKey(): string {
    return this.encryptionKeyInput.value;
  }

  e2eWorker(): E2EWorker {
    const encryptionKey = this.encryptionKey();

    if (encryptionKey === "") {
      const key = randomBytes(32);
      console.log(`Key: ${key.toHex()}`);

      this.encryptionKeyInput.value = key.toHex();

      return new E2EWorker(key);
    }

    return E2EWorker.fromHexKey(encryptionKey);
  }

  disable() {
    this.roomIdInput.disabled = true;
    this.encryptionKeyInput.disabled = true;
  }

  roomId(): string {
    let id = this.roomIdInput.value;

    if (id === "") {
      id = crypto.randomUUID();
      this.roomIdInput.value = id;
    }

    return id;
  }
}

export class ConsumerConfig extends BaseConfig {
  type(): "consumer" {
    return "consumer";
  }
}

export class ProducerConfig extends BaseConfig {
  codecSelect: HTMLSelectElement;
  formatSelect: HTMLSelectElement;
  div: HTMLDivElement;

  constructor() {
    super();

    this.div = document.getElementById("producer-controls") as HTMLDivElement;
    this.codecSelect = document.getElementById(
      "video-codec",
    ) as HTMLSelectElement;
    this.formatSelect = document.getElementById(
      "video-format",
    ) as HTMLSelectElement;
    this.show();
  }

  codec(): VideoCodecMimeType {
    return this.codecSelect.value as VideoCodecMimeType;
  }

  format(): EncodingType {
    switch (this.formatSelect.value) {
      case "simulcast":
        return EncodingType.Simulcast;
      default:
        return EncodingType.SVC;
    }
  }

  // e2eWorker(): E2EWorker {
  //   const key = randomBytes(32);
  //   console.log(`Key: ${key.toHex()}`);
  //
  //   const encKeyInp = document.getElementById(
  //     "producer-encryption-key",
  //   ) as HTMLInputElement;
  //   encKeyInp.value = key.toHex();
  //
  //   return new E2EWorker(key);
  // }

  disable() {
    super.disable();
    this.codecSelect.disabled = true;
    this.formatSelect.disabled = true;
  }

  type(): "producer" {
    return "producer";
  }

  show() {
    this.div.classList.remove("hidden");
  }

  hide() {
    this.div.classList.add("hidden");
  }
}
