export class WarpedMap {
  mapId
  map
  transformer
  image
  geoMask
  triangles
  geoExtent

  constructor(mapId: string, map, image, transformer, geoMask, geoExtent, triangles) {
    this.mapId = mapId
    this.map = map
    this.transformer = transformer
    this.image = image
    this.geoMask = geoMask
    this.triangles = triangles
    this.geoExtent = geoExtent
  }
}
