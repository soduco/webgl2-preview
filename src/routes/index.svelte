<script lang="ts">
  import { onMount } from 'svelte'

  import Map from 'ol/Map.js'
  import TileLayer from 'ol/layer/Tile.js'
  import XYZ from 'ol/source/XYZ.js'
  import View from 'ol/View.js'
  import { fromLonLat } from 'ol/proj.js'

  import { WarpedMapLayer } from '../lib/WarpedMapLayer'
  import { WarpedMapSource } from '../lib/WarpedMapSource'

  import { generateId } from '@allmaps/id/browser'
  import { parseAnnotation } from '@allmaps/annotation'

  let ol
  let xyz
  let baseLayer: TileLayer<XYZ>
  let warpedMapLayer: WarpedMapLayer
  let warpedMapSource: WarpedMapSource

  let opacity = 1
  let baseLayerOpacity = 1
  let backgroundColorThreshold = 0
  let backgroundColor = '#f2e7e0'

  $: {
    warpedMapLayer?.setOpacity(opacity)
  }

  $: {
    baseLayer?.setOpacity(baseLayerOpacity)
  }

  $: {
    warpedMapLayer?.hideBackgroundColor(backgroundColor, backgroundColorThreshold)
  }

  // async function addMapByImageUri(imageUri: string) {
  //   const imageId = await generateId(imageUri)
  //   const apiUrl = `https://dev.api.allmaps.org/images/${imageId}/maps`
  //   const maps = await fetch(apiUrl).then((response) => response.json())

  //   if (Array.isArray(maps)) {
  //     maps.forEach((map) => {
  //       warpedMapSource.addMap(map)
  //     })
  //   }
  // }

  onMount(async () => {
    const tileUrl =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'

    xyz = new XYZ({
      url: tileUrl,
      maxZoom: 19
    })

    baseLayer = new TileLayer({
      source: xyz
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

    const annotationsResponse = await fetch('annotations.json')
    const annotations = await annotationsResponse.json()
    const maps = parseAnnotation(annotations)

    for (let map of maps) {
      warpedMapSource.addMap(map)
    }

    // for (let imageUri of imageUris) {
    //   addMapByImageUri(imageUri)
    // }
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
    <div>
      <label>
        Opacity:
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
    justify-content: center;
  }

  .controls {
    padding: 5px;
    width: 400px;
    max-width: 100%;
    background: white;
    border-radius: 5px;
  }

  .controls > div {
    width: 100%;

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
