import Style from 'ol/style/Style.js'
import Fill from 'ol/style/Fill.js'
import Text from 'ol/style/Text.js'
import Stroke from 'ol/style/Stroke.js'

export function vectorStyle(feature) {
  return new Style({
    stroke: new Stroke({
      color: '#E10800',
      width: 4
    }),
    fill: new Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
    text: textStyle(feature)
  })
}

export function selectedVectorStyle(feature) {
  return new Style({
    stroke: new Stroke({
      color: '#E10800',
      width: 4
    }),
    fill: new Fill({ color: 'rgba(255, 255, 255, 0.5)' }),
    text: textStyle(feature)
  })
}

function textStyle(feature) {
  return new Text({
    scale: 1.5,
    text: label(feature),
    fill: new Fill({ color: '#000' }),
    stroke: new Stroke({ color: '#fff', width: 2 })
  })
}

function label(feature) {
  const properties = feature.getProperties()
  return String(properties.uri)
}
