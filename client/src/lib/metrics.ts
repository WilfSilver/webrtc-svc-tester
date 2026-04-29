import type { Consumer, Producer, Transport } from "mediasoup-client/lib/types";
import * as Papa from "papaparse";

interface QualityLimitationDurations {
  bandwidth: number;
  cpu: number;
  none: number;
  other: number;
}

/**
 * Subset of the stats provided by mediasoup, specifically ones that are useful
 * for us.
 *
 * Example data:
 *
 * ```json
 * {
 *     "id": "OT01V989303127",
 *     "timestamp": 1775059147842.494,
 *     "type": "outbound-rtp",
 *     "codecId": "COT01_98_profile-id=0",
 *     "kind": "video",
 *     "mediaType": "video",
 *     "ssrc": 989303127,
 *     "transportId": "T01",
 *     "bytesSent": 204031,
 *     "packetsSent": 466,
 *     "active": true,
 *     "encoderImplementation": "libvpx",
 *     "encodingIndex": 0,
 *     "firCount": 0,
 *     "frameHeight": 360,
 *     "frameWidth": 640,
 *     "framesEncoded": 307,
 *     "framesPerSecond": 30,
 *     "framesSent": 307,
 *     "headerBytesSent": 38900,
 *     "hugeFramesSent": 2,
 *     "keyFramesEncoded": 3,
 *     "mediaSourceId": "SV1",
 *     "mid": "0",
 *     "nackCount": 0,
 *     "packetsSentWithEct1": 0,
 *     "pliCount": 0,
 *     "powerEfficientEncoder": false,
 *     "qpSum": 55497,
 *     "qualityLimitationDurations": {
 *         "bandwidth": 5.596,
 *         "cpu": 0,
 *         "none": 0.041,
 *         "other": 0
 *     },
 *     "qualityLimitationReason": "bandwidth",
 *     "qualityLimitationResolutionChanges": 1,
 *     "remoteId": "RIV989303127",
 *     "retransmittedBytesSent": 0,
 *     "retransmittedPacketsSent": 0,
 *     "rtxSsrc": 1357296335,
 *     "scalabilityMode": "S3T3",
 *     "targetBitrate": 139286,
 *     "totalEncodeTime": 0.539,
 *     "totalEncodedBytesTarget": 0,
 *     "totalPacketSendDelay": 2.6805019999999997
 * }
 * ```
 */
interface ProducerStats {
  type: "outbound-rtp";

  bytesSent: number;
  timestamp: number;
  packetsSent: number;

  hugeFramesSent: number;
  keyFramesEncoded: number;

  frameHeight: number;
  frameWidth: number;
  framesEncoded: number;
  framesPerSecond: number;

  qualityLimitationReason: "bandwidth" | "cpu" | "none" | "other";
  headerBytesSent: number;

  qualityLimitationDurations: QualityLimitationDurations;

  rtxSsrc: number;

  retransmittedBytesSent: number;
  retransmittedPacketsSent: number;

  targetBitrate: number;
  totalEncodeTime: number;
  totalEncodedBytesTarget: number;
  totalPacketSendDelay: number;
}

/**
 * Subset of the stats provided by mediasoup, specifically ones that are useful
 * for us for consumption.
 *
 * Example data:
 *
 * ```json
 * {
 *     "id": "IT01V1234",
 *     "timestamp": 1775059196376.211,
 *     "type": "inbound-rtp",
 *     "kind": "video",
 *     "mediaType": "video",
 *     "ssrc": 1234,
 *     "transportId": "T01",
 *     "jitter": 0.001,
 *     "packetsLost": 0,
 *     "packetsReceived": 15,
 *     "packetsReceivedWithCe": 0,
 *     "packetsReceivedWithEct1": 0,
 *     "bytesReceived": 9884,
 *     "firCount": 0,
 *     "framesAssembledFromMultiplePackets": 0,
 *     "framesDecoded": 0,
 *     "framesDropped": 0,
 *     "framesReceived": 0,
 *     "freezeCount": 0,
 *     "headerBytesReceived": 480,
 *     "jitterBufferDelay": 0,
 *     "jitterBufferEmittedCount": 0,
 *     "jitterBufferMinimumDelay": 0,
 *     "jitterBufferTargetDelay": 0,
 *     "keyFramesDecoded": 0,
 *     "lastPacketReceivedTimestamp": 1775059194293.293,
 *     "mid": "probator",
 *     "nackCount": 0,
 *     "pauseCount": 0,
 *     "pliCount": 9,
 *     "totalAssemblyTime": 0,
 *     "totalDecodeTime": 0,
 *     "totalFreezesDuration": 0,
 *     "totalInterFrameDelay": 0,
 *     "totalPausesDuration": 0,
 *     "totalProcessingDelay": 0,
 *     "totalSquaredInterFrameDelay": 0,
 *     "trackIdentifier": "probator"
 * }
 * ```
 */
interface ConsumerStats {
  type: "outbound-rtp";
  timestamp: number;

  ssrc: number;
  jitter: number;
  packetsLost: number;
  packetsReceived: number;
  packetsReceivedWithCe: number;
  packetsReceivedWithEct1: number;
  bytesReceived: number;
  firCount: number;
  framesAssembledFromMultiplePackets: number;
  framesDecoded: number;
  framesDropped: number;
  framesReceived: number;
  freezeCount: number;
  headerBytesReceived: number;
  jitterBufferDelay: number;
  jitterBufferEmittedCount: number;
  jitterBufferMinimumDelay: number;
  jitterBufferTargetDelay: number;
  keyFramesDecoded: number;
  lastPacketReceivedTimestamp: number;
  mid: number;
  nackCount: number;
  pauseCount: number;
  pliCount: number;
  totalAssemblyTime: number;
  totalDecodeTime: number;
  totalFreezesDuration: number;
  totalInterFrameDelay: number;
  totalPausesDuration: number;
  totalProcessingDelay: number;
  totalSquaredInterFrameDelay: number;
}

/**
 * Subset of the stats provided by mediasoup, specifically ones that are useful
 * for us for the transport.
 *
 * Example data:
 *
 * ```json
 * {
 *     "id": "T01",
 *     "timestamp": 1775059166118.536,
 *     "type": "transport",
 *     "bytesReceived": 1306,
 *     "bytesSent": 37539,
 *     "dtlsCipher": "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
 *     "dtlsRole": "client",
 *     "dtlsState": "connected",
 *     "iceLocalUsernameFragment": "j4sj",
 *     "iceRole": "controlling",
 *     "iceState": "connected",
 *     "localCertificateId": "CF9B:12:1D:50:31:34:28:AD:A8:36:F3:B3:9E:26:11:31:00:D6:E3:52:04:8F:05:1F:31:8C:93:DE:8E:56:D0:0B",
 *     "packetsReceived": 11,
 *     "packetsSent": 97,
 *     "remoteCertificateId": "CFA3:F9:7F:94:6C:CB:3E:F1:83:FA:33:98:08:16:76:3D:3F:E9:13:28:35:90:75:CD:BD:9D:AE:CD:36:C0:E9:A3",
 *     "selectedCandidatePairChanges": 1,
 *     "selectedCandidatePairId": "CPcADvStLn_/Pokws0V",
 *     "srtpCipher": "AEAD_AES_256_GCM",
 *     "tlsVersion": "FEFD"
 * }
 */
interface TransportStats {
  type: "transport";

  bytesReceived: number;
  bytesSent: number;

  packetsReceived: number;
  packetsSent: number;
}

interface ConsumerStreamInfo {
  timestamp: number;
  framerate: number | undefined;
  height: number | undefined;
  width: number | undefined;
  track: number;
}

interface Stats {
  producer: ProducerStats[];
  consumer: ConsumerStats[];
  transport: TransportStats[];
  stream: ConsumerStreamInfo[];
}

/**
 * Allows the listening and recording of metrics at certain intervals
 */
export class MetricsLog {
  /** The raw data being collected */
  data: Stats;
  /** The objects that are being recorded */
  listeningTo: (Producer | Consumer | Transport | MediaStream)[];
  /** Whether metrics are being collected or not */
  paused: boolean = false;

  constructor(delay = 200) {
    this.data = {
      producer: [],
      consumer: [],
      transport: [],
      stream: [],
    };

    this.listeningTo = [];

    const saveBtn = document.getElementById(
      "metrics-save",
    ) as HTMLButtonElement;

    saveBtn.onclick = () => this.save();

    setInterval(async () => this.logAllListeners(), delay);
  }

  /**
   * Logs all objects within the {@link listeningTo} attribute
   */
  async logAllListeners() {
    if (this.paused) return;

    for (const listener of this.listeningTo) {
      if (listener instanceof MediaStream) {
        for (const [i, t] of listener.getTracks().entries()) {
          const settings = t.getSettings();
          this.logStream({
            track: i,
            timestamp: Date.now(),
            framerate: settings.frameRate,
            width: settings.width,
            height: settings.height,
          });
        }
      } else {
        this.log(await listener.getStats());
      }
    }
  }

  /** Resets all the metrics and all listeners */
  reset() {
    this.data = {
      producer: [],
      consumer: [],
      transport: [],
      stream: [],
    };

    this.listeningTo = [];
  }

  /** Pauses the metrics recording */
  pause() {
    this.paused = true;
  }

  /** Resumes the metrics recording */
  record() {
    this.paused = false;
  }

  /**
   * Downloads a single CSV file with all the data in it from the objects
   */
  save(name = "metrics") {
    const data = [
      Papa.unparse(this.data.producer, { header: true }),
      Papa.unparse(this.data.consumer, { header: true }),
      Papa.unparse(this.data.transport, { header: true }),
      Papa.unparse(this.data.stream, { header: true }),
    ].join("\n\n");

    const file = new Blob([data], { type: "text/csv" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = `${name}.csv`;
    a.click();

    setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }

  /**
   * Logs the given RTC stats report, only looking for "outbound-rtp",
   * "inbound-rtp" and "transport" types
   */
  log(stats: RTCStatsReport) {
    if (this.paused) return;

    for (const [_, vals] of stats) {
      if (vals.trackIdentifier === "probator") continue;

      if (vals.type === "outbound-rtp") {
        this.data.producer.push(vals as ProducerStats);
      } else if (vals.type === "inbound-rtp") {
        if (!("frameHeight" in vals)) {
          vals.frameHeight = 1;
        }
        this.data.consumer.push(vals as ConsumerStats);
      } else if (vals.type === "transport") {
        this.data.transport.push(vals as TransportStats);
      }
    }
  }

  logStream(stats: ConsumerStreamInfo) {
    if (this.paused) return;
    this.data.stream.push(stats);
  }

  /**
   * Listens to a given transport/producer/consumer that has the `getStats`
   * function and calls Metrics set delay
   */
  listenTo(transport: Transport | Producer | Consumer | MediaStream) {
    this.listeningTo.push(transport);
  }
}
