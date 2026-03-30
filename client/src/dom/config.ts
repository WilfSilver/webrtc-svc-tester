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
      console.log(`Changing ${this.inner.type()} to ${this.select.value}`);
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

  constructor() {
    this.roomIdInput = document.getElementById("room-id") as HTMLInputElement;
  }

  roomId(): string {
    return this.roomIdInput.value;
  }
}

export class ConsumerConfig extends BaseConfig {
  encryptionKeyInput: HTMLInputElement;
  div: HTMLDivElement;

  constructor() {
    super();

    console.log("Creating consumer");

    this.encryptionKeyInput = document.getElementById(
      "encryption-key",
    ) as HTMLInputElement;

    this.div = document.getElementById("consumer-controls") as HTMLDivElement;
    this.show();
  }

  encryptionKey(): string {
    return this.encryptionKeyInput.value;
  }

  e2eWorker(): E2EWorker {
    return E2EWorker.fromHexKey(this.encryptionKey());
  }

  disable() {
    this.encryptionKeyInput.disabled = true;
  }

  type(): "consumer" {
    return "consumer";
  }

  show() {
    console.log("Showing consumer");
    this.div.classList.remove("hidden");
  }

  hide() {
    console.log("Hiding consumer");
    this.div.classList.add("hidden");
  }
}

export class ProducerConfig extends BaseConfig {
  codecSelect: HTMLSelectElement;
  formatSelect: HTMLSelectElement;
  div: HTMLDivElement;

  constructor() {
    super();

    console.log("Creating producer");

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

  e2eWorker(): E2EWorker {
    const key = randomBytes(32);
    console.log(`Key: ${key.toHex()}`);

    const encKeyInp = document.getElementById(
      "producer-encryption-key",
    ) as HTMLInputElement;
    encKeyInp.value = key.toHex();

    return new E2EWorker(key);
  }

  disable() {
    this.codecSelect.disabled = true;
    this.formatSelect.disabled = true;
  }

  type(): "producer" {
    return "producer";
  }

  show() {
    console.log("Showing producer");
    this.div.classList.remove("hidden");
  }

  hide() {
    console.log("Hiding producer");
    this.div.classList.add("hidden");
  }
}
