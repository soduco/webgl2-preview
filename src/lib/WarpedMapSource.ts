import Source from 'ol/source/Source.js'
import SourceState from 'ol/source/State.js'
import Event from 'ol/events/Event.js'

import { generateChecksum } from '@allmaps/id/browser'

import Worker from './worker.ts?worker'

import WarpedMapEventType from './WarpedMapEventType.js'

export class WarpedMapSourceEvent extends Event {
  constructor(type, data) {
    super(type)

    this.data = data
  }
}

export class WarpedMapSource extends Source {
  worker: Worker

  tileUrls: Set<string> = new Set()

  constructor() {
    super({
      interpolate: true,
      projection: undefined,
      state: SourceState.READY,
      wrapX: true
    })

    this.worker = new Worker()

    this.worker.onmessage = this.onWorkerMessage.bind(this)
  }

  onWorkerMessage(event) {
    const { type, data } = event.data
    if (type === WarpedMapEventType.WARPEDMAPADDED) {
      this.dispatchEvent(new WarpedMapSourceEvent(WarpedMapEventType.WARPEDMAPADDED, data))
      this.changed()
    } else if (type === WarpedMapEventType.WARPEDMAPENTEREXTENT) {
      this.dispatchEvent(new WarpedMapSourceEvent(WarpedMapEventType.WARPEDMAPENTEREXTENT, data))
    } else if (type === WarpedMapEventType.WARPEDMAPLEAVEEXTENT) {
      this.dispatchEvent(new WarpedMapSourceEvent(WarpedMapEventType.WARPEDMAPLEAVEEXTENT, data))
    } else if (type === WarpedMapEventType.TILENEEDED) {
      this.dispatchEvent(new WarpedMapSourceEvent(WarpedMapEventType.TILENEEDED, data))

      const { url } = data
      this.tileUrls.add(url)

      this.dispatchEvent(
        new WarpedMapSourceEvent(WarpedMapEventType.TILESCHANGED, [...this.tileUrls])
      )
    } else if (type === WarpedMapEventType.TILEUNNEEDED) {
      this.dispatchEvent(new WarpedMapSourceEvent(WarpedMapEventType.TILEUNNEEDED, data))

      const { url } = data
      this.tileUrls.delete(url)

      this.dispatchEvent(
        new WarpedMapSourceEvent(WarpedMapEventType.TILESCHANGED, [...this.tileUrls])
      )
    }
  }

  sendWorkerMessage(type, data) {
    this.worker.postMessage({
      type,
      data
    })
  }

  updateNeededTiles(size, extent, coordinateToPixelTransform) {
    this.sendWorkerMessage(WarpedMapEventType.UPDATENEEDEDTILES, { size, extent, coordinateToPixelTransform })
  }

  async addMap(map: any) {
    const mapId = await generateChecksum(map)
    this.sendWorkerMessage(WarpedMapEventType.ADDMAP, { mapId, map })
  }
}
