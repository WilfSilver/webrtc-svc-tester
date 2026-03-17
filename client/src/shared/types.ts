export interface SetCryptoKey {
  operation: "setCryptoKey";
  currentCryptoKey: Uint8Array;
  useCryptoOffset: boolean;
}

export type EncodedFrame = RTCEncodedVideoFrame | RTCEncodedAudioFrame;

export type CryptoWorkerMessage = SetCryptoKey;

export enum TransformDir {
  Sender = "sender",
  Receiver = "reciever",
}

export interface E2EWorkerOptions {
  dir: TransformDir;
}
