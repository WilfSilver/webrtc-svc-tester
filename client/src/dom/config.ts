import { randomBytes } from "@noble/ciphers/utils.js";
import type { ProducerId } from "../lib/api";
import type { VideoCodecMimeType } from "../lib/device";
import { E2EWorker } from "../lib/e2e_manager";
import { EncodingType } from "../lib/producer";

interface ConfigParams {
  type: "producer" | "consumer" | null;
  roomId: string | null;
  encryptionKey: string | null;
  submit: string | null;
  testNum: number | null;
}

export class Config {
  select: HTMLSelectElement;
  submit: HTMLButtonElement;

  roomIdInput: HTMLInputElement;
  encryptionKeyInput: HTMLInputElement;
  testNum: number = 0;

  constructor(onsubmit: (config: Config) => void) {
    this.select = document.getElementById("video-client") as HTMLSelectElement;
    this.submit = document.getElementById("config-submit") as HTMLButtonElement;

    this.submit.onclick = () => {
      this.disable();
      this.select.disabled = true;
      this.submit.disabled = true;
      onsubmit(this);
    };

    this.roomIdInput = document.getElementById("room-id") as HTMLInputElement;

    this.encryptionKeyInput = document.getElementById(
      "encryption-key",
    ) as HTMLInputElement;

    const params = new URL(document.location.toString()).searchParams;
    this.set({
      type: params.get("type") as "producer" | "consumer" | null,
      roomId: params.get("roomId"),
      encryptionKey: params.get("encryptionKey"),
      submit: params.get("submit"),
      testNum:
        params.get("testNum") !== null ? Number(params.get("testNum")) : null,
    });
  }

  set(config: ConfigParams) {
    this.select.value = config.type ?? "producer";
    this.roomIdInput.value = config.roomId ?? "";
    this.encryptionKeyInput.value = config.encryptionKey ?? "";

    this.testNum = config.testNum ?? 0;

    if (config.submit) this.submit.click();
  }

  asParams(submit: boolean, testNum?: number): URLSearchParams {
    const params = new URLSearchParams();

    params.set("type", this.type());
    params.set("roomId", this.roomId());
    params.set("encryptionKey", this.encryptionKey());
    params.set("submit", String(submit));
    params.set("testNum", String(testNum ?? this.testNum));

    return params;
  }

  type(): "producer" | "consumer" {
    return this.select.value as "producer" | "consumer";
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
