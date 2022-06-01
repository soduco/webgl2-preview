<script lang="ts">
  import { onMount } from 'svelte'

  import Map from 'ol/Map.js'
  import TileLayer from 'ol/layer/Tile.js'
  import XYZ from 'ol/source/XYZ.js'
  import VectorLayer from 'ol/layer/Vector.js'
  import VectorSource from 'ol/source/Vector.js'
  import View from 'ol/View.js'
  import { fromLonLat } from 'ol/proj.js'
  import GeoJSON from 'ol/format/GeoJSON.js'
  import Select from 'ol/interaction/Select.js'

  import { WarpedMapLayer } from '../lib/WarpedMapLayer'
  import { WarpedMapSource } from '../lib/WarpedMapSource'
  import { vectorStyle, selectedVectorStyle } from '../lib/vector-style'

  import { generateId } from '@allmaps/id/browser'
  import { parseAnnotation } from '@allmaps/annotation'
  import { createTransformer, polygonToWorld } from '@allmaps/transform'

  let ol
  let xyzSource
  let baseLayer: TileLayer<XYZ>
  let warpedMapLayer: WarpedMapLayer
  let warpedMapSource: WarpedMapSource

  let vectorLayers: VectorLayer<VectorSource>[] = []

  let opacity = 1
  let baseLayerOpacity = 1
  let backgroundColorThreshold = 0
  let backgroundColor = '#f2e7e0'
  let showVectorLayers = false

  let layers = []

  $: {
    warpedMapLayer?.setOpacity(opacity)
  }

  $: {
    baseLayer?.setOpacity(baseLayerOpacity)
  }

  $: {
    warpedMapLayer?.hideBackgroundColor(backgroundColor, backgroundColorThreshold)
  }

  $: {
    for (let vectorLayer of vectorLayers) {
      vectorLayer.setVisible(showVectorLayers)
    }
  }

  async function addMapsByAnnotationUrl(annotationUrl: string, vectorSource) {
    const annotationsResponse = await fetch(annotationUrl)

    const annotations = await annotationsResponse.json()
    const maps = parseAnnotation(annotations)

    for (let map of maps) {
      warpedMapSource.addMap(map)

      const gcps = map.gcps
      const transformer = createTransformer(gcps)

      const geoMask = polygonToWorld(
        transformer,
        [...map.pixelMask, map.pixelMask[map.pixelMask.length - 1]],
        0.01,
        0
      )

      const feature = {
        type: 'Feature',
        properties: {
          uri: map.image.uri
        },
        geometry: geoMask
      }

      vectorSource.addFeature(
        new GeoJSON().readFeature(feature, { featureProjection: 'EPSG:3857' })
      )
    }
  }

  async function addLayer (layer) {
    const vectorSource = new VectorSource()
    const vectorLayer = new VectorLayer({
      visible: false,
      source: vectorSource,
      style: vectorStyle
    })

    ol.addLayer(vectorLayer)

    vectorLayers.push(vectorLayer)

    for (let annotationUrl of layer.annotationUrls) {
      await addMapsByAnnotationUrl(annotationUrl, vectorSource)
    }
  }

  function zoomToLayer (index) {
    const vectorLayer = vectorLayers[index]
    const extent = vectorLayer.getSource().getExtent()
    ol.getView().fit(extent)
  }

  async function addMapsByImageUri(imageUri: string) {
    const imageId = await generateId(imageUri)
    const apiUrl = `https://dev.api.allmaps.org/images/${imageId}/maps`
    const maps = await fetch(apiUrl).then((response) => response.json())

    if (Array.isArray(maps)) {
      maps.forEach((map) => {
        warpedMapSource.addMap(map)
      })
    }
  }

  onMount(async () => {
    const tileUrl =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'

    xyzSource = new XYZ({
      url: tileUrl,
      maxZoom: 19
    })

    baseLayer = new TileLayer({
      source: xyzSource
    })

    warpedMapSource = new WarpedMapSource()
    warpedMapLayer = new WarpedMapLayer({
      source: warpedMapSource
    })

    ol = new Map({
      layers: [baseLayer, warpedMapLayer],
      target: 'ol',
      view: new View({
        center: fromLonLat([-71.13, 42.2895]),
        maxZoom: 22,
        zoom: 17
      })
    })

    const select = new Select({
      style: selectedVectorStyle
    })

    ol.addInteraction(select)

    select.on('select', (event) => {
      const feature = event.selected[0]
      const uri = feature.get('uri')
      const url = `https://observablehq.com/@bertspaan/iiif-openseadragon?url=${uri}/info.json`
      window.open(url, '_blank').focus()
    })

    layers = await fetch('layers.json')
      .then((response) => response.json())

    for (let layer of layers) {
      addLayer(layer)
    }
  })

  function handleKeydown(event) {
    if (event.code === 'Space') {
      opacity = 0
    }
  }

  function handleKeyup(event) {
    if (event.code === 'Space') {
      opacity = 1
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} on:keyup={handleKeyup} />

<div class="container">
  <div id="ol" />
</div>

<footer>
  <div class="controls">
    <h1>Preview of new render module for <a href="https://allmaps.org">Allmaps</a>:</h1>
    <div>
      Move map to {#each layers as layer, index}<button on:click={() => zoomToLayer(index)}>{layer.title}</button>{/each}
    </div>
    <hr />
    <div>
      <label>
        Opacity (press Space to toggle):
        <input type="range" bind:value={opacity} min="0" max="1" step="0.01" />
      </label>
    </div>
    <div>
      <label>
        Remove background color:
        <input type="color" bind:value={backgroundColor} />
        <input type="range" bind:value={backgroundColorThreshold} min="0" max="1" step="0.01" />
      </label>
    </div>
    <div>
      <label>
        Base layer opacity:
        <input type="range" bind:value={baseLayerOpacity} min="0" max="1" step="0.01" />
      </label>
    </div>
    <div>
      <label>
        Show image outlines:
        <input type="checkbox" bind:checked={showVectorLayers} />
      </label>
    </div>
  </div>
</footer>

<style>
  :global(body),
  :global(#svelte) {
    margin: 0;
    position: absolute;
    width: 100%;
    height: 100%;
    font-family: monospace;
  }

  * {
    box-sizing: border-box;
  }

  .container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: row;
  }

  .container > * {
    width: 100%;
    height: 100%;
  }

  footer {
    position: absolute;
    width: 100%;
    bottom: 0;
    padding: 5px;
    display: flex;
    justify-content: flex-end;
    pointer-events: none;
  }

  .controls {
    padding: 5px;
    width: 520px;
    max-width: 100%;
    background: white;
    border-radius: 5px;
    pointer-events: auto;
  }

  .controls h1 {
    font-size: 150%;
    margin-top: 0;
  }

  .controls > div {
    width: 100%;
  }

  .controls button {
    margin-left: 5px;
  }

  .controls label {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  #ol {
    width: 100%;
    height: 100%;
  }
</style>
