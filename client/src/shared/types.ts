export interface SetCryptoKey {
  operation: "setCryptoKey";
  currentCryptoKey: Uint8Array;
  useCryptoOffset: boolean;
}

export type EncodedFrame = RTCEncodedVideoFrame | RTCEncodedAudioFrame;

export interface EncodeStream {
  operation: "encode";
  readableStream: ReadableStream<EncodedFrame>;
  writableStream: WritableStream<EncodedFrame>;
}

export interface DecodeStream {
  operation: "decode";
  readableStream: ReadableStream<EncodedFrame>;
  writableStream: WritableStream<EncodedFrame>;
}

export type CryptoWorkerMessage = SetCryptoKey | EncodeStream | DecodeStream;
