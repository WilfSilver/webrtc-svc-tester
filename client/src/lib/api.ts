import type {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup-client/lib/RtpParameters";
import type {
  DtlsParameters,
  TransportOptions,
} from "mediasoup-client/lib/Transport";

export type Brand<K, T> = K & { __brand: T };

export type ConsumerId = Brand<string, "ConsumerId">;
export type ProducerId = Brand<string, "ProducerId">;

export interface ServerInit {
  action: "Init";
  consumerTransportOptions: TransportOptions;
  producerTransportOptions: TransportOptions;
  routerRtpCapabilities: RtpCapabilities;
}

export interface ServerConnectedProducerTransport {
  action: "ConnectedProducerTransport";
}

export interface ServerProduced {
  action: "Produced";
  id: ProducerId;
}

export interface ServerConnectedConsumerTransport {
  action: "ConnectedConsumerTransport";
}

export interface ServerConsumed {
  action: "Consumed";
  id: ConsumerId;
  kind: MediaKind;
  rtpParameters: RtpParameters;
}

export type ServerMessage =
  | ServerInit
  | ServerConnectedProducerTransport
  | ServerProduced
  | ServerConnectedConsumerTransport
  | ServerConsumed;

export interface ClientInit {
  action: "Init";
  rtpCapabilities: RtpCapabilities;
}

export interface ClientConnectProducerTransport {
  action: "ConnectProducerTransport";
  dtlsParameters: DtlsParameters;
}

export interface ClientConnectConsumerTransport {
  action: "ConnectConsumerTransport";
  dtlsParameters: DtlsParameters;
}

export interface ClientProduce {
  action: "Produce";
  kind: MediaKind;
  rtpParameters: RtpParameters;
}

export interface ClientConsume {
  action: "Consume";
  producerId: ProducerId;
}

export interface ClientConsumerResume {
  action: "ConsumerResume";
  id: ConsumerId;
}

export interface ClientSetConsumerPreferredLayers {
  action: "SetConsumerPreferredLayers";
  id: ConsumerId;
  preferredLayers: {
    spatialLayer: number;
    temporalLayer: number;
  };
}

export type ClientMessagesWithResponse =
  | ClientConnectConsumerTransport
  | ClientConsume
  | ClientConnectProducerTransport
  | ClientProduce;

export type ClientMessage =
  | ClientInit
  | ClientConsumerResume
  | ClientSetConsumerPreferredLayers
  | ClientMessagesWithResponse;

type GetServerResponse<T extends ClientMessage> =
  T extends ClientConnectConsumerTransport
    ? ServerConnectedConsumerTransport
    : T extends ClientConsume
      ? ServerConsumed
      : T extends ClientConnectProducerTransport
        ? ServerConnectedProducerTransport
        : T extends ClientProduce
          ? ServerProduced
          : never;

const clientToServer: {
  [C in ClientMessagesWithResponse as C["action"]]: GetServerResponse<C>["action"];
} = {
  ConnectConsumerTransport: "ConnectedConsumerTransport",
  Consume: "Consumed",
  Produce: "Produced",
  ConnectProducerTransport: "ConnectedProducerTransport",
};

export type ServerCallback = (msg: ServerMessage) => void | Promise<void>;

/**
 * Interacts with the Mediasoup backend, storing a websocket connection and
 * storing any listeners to be returned.
 *
 * Example usage:
 *
 * ```ts
 * const api = new API().connect();
 *
 * // Send a message to the server with no response
 * api.send({ action: "Init", ... });
 *
 * // Wait for message for server
 * api.waitFor("Init", (msg: ServerInit) => { ... })
 *
 * // Send a message and wait for a response
 * api
 *   .sendAndWait({
 *     action: "Consume",
 *     producerId: producer.id as ProducerId,
 *   }).then((msg) => {
 *     const id = msg.id;
 *     const kind = msg.kind;
 *     const msg = msg.rtpParameters;
 *     // ...
 *   });
 * ```
 */
export class API {
  /**
   * The websocket connected to the server
   */
  private ws?: WebSocket;

  /**
   * The map of listeners, the type is generic but type enforcement by
   * {@linkcode waitFor}
   */
  private listeners: Map<ServerMessage["action"], Map<number, ServerCallback>>;
  /**
   * Stores the next listener id so we don't assign duplicate IDs
   */
  private nextListenerId: number;

  /**
   * Constructs new {@linkcode API} object
   *
   * NOTE: This does not connect to the API, to allow you to setup the
   * listeners before the connection is made
   *
   * Before you can use {@linkcode send} you must call {@linkcode connect}
   */
  constructor() {
    console.info("Initiating websocket");

    this.listeners = new Map();
    this.nextListenerId = 0;
  }

  /**
   * Connects to the chosen websocket
   *
   * @param url The full URL to the websocket, expected with `ws://`
   * or `wss://`
   *
   * @returns The api object, to allow for combination with the constructor
   */
  connnect(url: URL = new URL("ws://localhost:3000/ws")): API {
    this.ws = new WebSocket(url.toString());

    this.ws.onmessage = async (msg) => {
      const decodedMessage: ServerMessage = JSON.parse(msg.data);
      this.handle(decodedMessage);
    };

    this.ws.onerror = console.error;

    return this;
  }

  /**
   * Sends a given {@linkcode msg} to the server via the websocket.
   *
   * @param msg The message to send to the server
   */
  send(msg: ClientMessage) {
    console.debug("Sending", msg);
    if (this.ws) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.error("Tried to send message, but websocket is not connected");
    }
  }

  /**
   * Creates a promise from a send function which expects a response from the
   * server.
   *
   * So instead of going
   *
   * ```ts
   * api.send({ action: "Consume", producerId: producer.id as ProducerId });
   * api.waitFor("Consumed", async (msg: ServerConsumed) => {
   *   const id = msg.id;
   *   const kind = msg.kind;
   *   const msg = msg.rtpParameters;
   *   // ...
   * })
   * ```
   *
   * You go:
   *
   * ```ts
   * api
   *   .sendAndWait({
   *     action: "Consume",
   *     producerId: producer.id as ProducerId,
   *   }).then((msg) => {
   *     const id = msg.id;
   *     const kind = msg.kind;
   *     const msg = msg.rtpParameters;
   *     // ...
   *   });
   * ```
   */
  sendAndWait<C extends ClientMessagesWithResponse>(
    msg: C,
  ): Promise<GetServerResponse<C>> {
    return new Promise((resolve, _reject) => {
      this.send(msg);
      const serverAct = clientToServer[msg.action];
      this.waitFor(
        serverAct,
        resolve as (msg: GetServerResponse<C>) => void,
        true,
      );
    });
  }

  /**
   * Removes the listener with the given id waiting on the given action
   *
   * @param action The action the listener was originally attached to
   * @param id The ID returned from the {@linkcode waitFor}
   */
  stopWaitingFor(action: ServerMessage["action"], id: number) {
    const listeners = this.listeners.get(action);
    if (listeners) listeners.delete(id);
  }

  /**
   * Calls the {@linkcode callback} function when the given {@linkcode action}
   * is sent from the server.
   *
   * @param action The action we are waiting to hear from the server
   * @param callback The function to call with the full message when that
   *  action is found
   * @param once If set to `true`, the listener will automatically be removed
   *  after one call. If set to false, it has to be removed manually with
   *  {@linkcode stopWaitingFor}
   *
   * If you are using `once`, you probably want to look at
   * {@linkcode sendAndWait}
   *
   * @returns The ID which when combined with the {@linkcode action} can be
   *  used to remove the listener
   */
  waitFor<T extends ServerMessage>(
    action: T["action"],
    callback: (message: T) => void | Promise<void>,
    once: boolean = false,
  ): number {
    console.debug(`Waiting for ${action}`);

    const id = this.nextListenerId++;

    const cb = (async (msg: T) => {
      await callback(msg);
      if (once) this.stopWaitingFor(action, id);
    }) as ServerCallback;

    const responses = this.listeners.get(action);
    if (responses) {
      responses.set(id, cb);
    } else {
      const map = new Map();
      map.set(id, cb);
      this.listeners.set(action, map);
    }

    return id;
  }

  /**
   * Handles a given message from the server.
   */
  private async handle(message: ServerMessage): Promise<void> {
    console.debug("Received: ", message);

    const callbacks = this.listeners.get(message.action);

    if (callbacks) {
      for (const cb of callbacks.values()) {
        await Promise.resolve(cb(message)).catch(console.error);
      }
    }
  }
}
