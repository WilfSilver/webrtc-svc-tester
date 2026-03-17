import type { Consumer } from "mediasoup-client/lib/Consumer";
import type { API, ConsumerId } from "./api";

export type LayerUpdateCb = (spatial: number, temporal: number) => void;

/**
 * A really simple class to manage the current layer and manage the cycle
 * through different layers.
 *
 * It is expected any extension is added to the {@linkcode onUpdate} parameter
 */
export class LayerManager {
  /* The maximum spatial layers from the source */
  private maxSpatial: number;
  /* The maximum temporal layers from the source */
  private maxTemporal: number;
  /* The current selected spatial layer */
  private spatial: number;
  /* The current selected temporal layer */
  private temporal: number;

  onUpdate: LayerUpdateCb[];

  constructor(maxSpatial: number, maxTemporal: number) {
    console.info(`Initialising Layer control (${maxSpatial}, ${maxTemporal})`);

    this.maxSpatial = maxSpatial + 1;
    this.maxTemporal = maxTemporal + 1;

    this.spatial = maxSpatial;
    this.temporal = maxTemporal;

    this.onUpdate = [];
  }

  /**
   * Attaches the layer manager to a consumer, meaning that when this updates,
   * the consumers layer choice is also updated
   *
   * @param api This is the API which is used to update the server about the
   *   consumers choice of layer
   * @param consumer The consumer to use the set layer
   *
   * @returns this, to make it nice to use with commands
   */
  attachToConsumer(api: API, consumer: Consumer): LayerManager {
    this.addOnUpdate((spatialLayer, temporalLayer) => {
      api.send({
        action: "SetConsumerPreferredLayers",
        id: consumer.id as ConsumerId,
        preferredLayers: { spatialLayer, temporalLayer },
      });
    });

    return this;
  }

  /* Decreases the layer, iterating through the temporal and spatial layers */
  decrease() {
    this.temporal--;
    if (this.temporal < 0) {
      this.temporal += this.maxTemporal;

      this.spatial--;
      if (this.spatial < 0) this.spatial += this.maxSpatial;
    }

    this.updateStream();
  }

  /* Increases the layer, iterating through the temporal and spatial layers */
  increase() {
    this.temporal = (this.temporal + 1) % this.maxTemporal;
    if (this.temporal === 0) {
      this.spatial = (this.spatial + 1) % this.maxSpatial;
    }

    this.updateStream();
  }

  /**
   * Adds an function to the on update stack
   *
   * @param cb The function called when any temporal or spatial layer changes
   */
  addOnUpdate(cb: LayerUpdateCb) {
    this.onUpdate.push(cb);
  }

  /* Iterates over all the onUpdate callbacks and calls all of them */
  private updateStream() {
    for (const cb of this.onUpdate) {
      cb(this.spatial, this.temporal);
    }
  }
}
