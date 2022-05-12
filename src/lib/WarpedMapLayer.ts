import Layer from 'ol/layer/Layer.js'
import type { FrameState } from 'ol/PluggableMap.js'

import { throttle } from 'lodash'

import vertexShaderSource from './vertex-shader.glsl?raw'
import fragmentShaderSource from './fragment-shader.glsl?raw'

import WarpedMapEventType from './WarpedMapEventType.js'
import type { WarpedMapSource } from './WarpedMapSource'
import { WarpedMapWebGLRenderer } from './WarpedMapWebGLRenderer'

export class WarpedMapLayer extends Layer {
  source: WarpedMapSource | null = null
  container: HTMLElement
  canvas: HTMLCanvasElement | null = null
  canvasSize: [number, number] = [0, 0]

  gl: WebGL2RenderingContext | null = null
  program: WebGLProgram | null = null

  uboBuffers: Map<string, WebGLBuffer> = new Map()
  uboVariableInfo: Map<string, Map<string, { index: number; offset: number }>> = new Map()

  warpedMapWebGLRenderers: Map<string, WarpedMapWebGLRenderer> = new Map()
  mapIdsInExtent: Set<string> = new Set()

  throttledUpdateNeededTiles

  constructor(options: {}) {
    options = options || {}

    super(options)

    this.source = this.getSource() as WarpedMapSource
    if (this.source) {
      this.source.on(WarpedMapEventType.WARPEDMAPADDED, this.warpedMapAdded.bind(this))
      this.source.on(WarpedMapEventType.WARPEDMAPENTEREXTENT, this.warpedMapEnterExtent.bind(this))
      this.source.on(WarpedMapEventType.WARPEDMAPLEAVEEXTENT, this.warpedMapLeaveExtent.bind(this))
      this.source.on(WarpedMapEventType.TILENEEDED, this.tileNeeded.bind(this))
      this.source.on(WarpedMapEventType.TILEUNNEEDED, this.tileUnneeded.bind(this))

      this.throttledUpdateNeededTiles = throttle(
        this.source.updateNeededTiles.bind(this.source),
        100
      )
    }

    const container = document.createElement('div')
    this.container = container

    container.style.position = 'absolute'
    container.style.width = '100%'
    container.style.height = '100%'
    container.classList.add('ol-layer')
    container.classList.add('allmaps-warped-layer')
    const canvas = document.createElement('canvas')

    canvas.style.position = 'absolute'
    canvas.style.left = '0'

    canvas.style.width = '100%'
    canvas.style.height = '100%'

    container.appendChild(canvas)

    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false })

    if (!gl) {
      throw new Error('WebGL 2 not available')
    }

    const resizeObserver = new ResizeObserver(this.onResize.bind(this))
    resizeObserver.observe(canvas, { box: 'content-box' })

    this.canvas = canvas
    this.gl = gl

    const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)

    this.program = this.createProgram(gl, vertexShader, fragmentShader)


    this.createSettingsUniformBufferObject()
    // this.createTransformerUniformBufferObject()

    gl.disable(gl.DEPTH_TEST)
  }



  createSettingsUniformBufferObject() {
    this.createUniformBufferObject('Settings', ['u_opacity'])
    // this.createUniformBufferObject('Settings', ['u_opacity'])
  }

  createTransformerUniformBufferObject() {
    this.createUniformBufferObject('Transformer', [
      'u_imageSize',
      'u_x2Mean',
      'u_y2Mean',
      'u_adfFromGeoX',
      'u_adfFromGeoY',
      'u_nOrder'
    ])

    // TODO stop er ook de data in!
    // 'u_adfFromGeoX[0]': hTransformArg.adfFromGeoX[0],
    // 'u_adfFromGeoX[1]': hTransformArg.adfFromGeoX[1],
    // 'u_adfFromGeoX[2]': hTransformArg.adfFromGeoX[2],
    // 'u_adfFromGeoX[3]': 0.0,
    // 'u_adfFromGeoX[4]': 0.0,
    // 'u_adfFromGeoX[5]': 0.0,
    // 'u_adfFromGeoX[6]': 0.0,
    // 'u_adfFromGeoX[7]': 0.0,
    // 'u_adfFromGeoX[8]': 0.0,
    // 'u_adfFromGeoX[9]': 0.0,

    // 'u_adfFromGeoY[0]': hTransformArg.adfFromGeoY[0],
    // 'u_adfFromGeoY[1]': hTransformArg.adfFromGeoY[1],
    // 'u_adfFromGeoY[2]': hTransformArg.adfFromGeoY[2],
    // 'u_adfFromGeoY[3]': 0.0,
    // 'u_adfFromGeoY[4]': 0.0,
    // 'u_adfFromGeoY[5]': 0.0,
    // 'u_adfFromGeoY[6]': 0.0,
    // 'u_adfFromGeoY[7]': 0.0,
    // 'u_adfFromGeoY[8]': 0.0,
    // 'u_adfFromGeoY[9]': 0.0,
  }

  createUniformBufferObject(uniformBlockName: string, uboVariableNames: string[]) {
    // Adapted from
    // https://gist.github.com/jialiang/2880d4cc3364df117320e8cb324c2880

    const gl = this.gl
    const program = this.program

    const blockIndex = gl.getUniformBlockIndex(program, uniformBlockName)

    // Get the size of the Uniform Block in bytes
    const blockSize = gl.getActiveUniformBlockParameter(
      program,
      blockIndex,
      gl.UNIFORM_BLOCK_DATA_SIZE
    )

    // Create Uniform Buffer to store our data
    const uboBuffer = gl.createBuffer()

    if (!uboBuffer) {
      throw new Error('Unable to create uniform buffer object')
    }

    // Bind it to tell WebGL we are working on this buffer
    gl.bindBuffer(gl.UNIFORM_BUFFER, uboBuffer)

    // Allocate memory for our buffer equal to the size of our Uniform Block
    // We use dynamic draw because we expect to respecify the contents of the buffer frequently
    gl.bufferData(gl.UNIFORM_BUFFER, blockSize, gl.DYNAMIC_DRAW)

    // Unbind buffer when we're done using it for now
    // Good practice to avoid unintentionally working on it
    gl.bindBuffer(gl.UNIFORM_BUFFER, null)

    // Bind the buffer to a binding point
    // Think of it as storing the buffer into a special UBO ArrayList
    // The second argument is the index you want to store your Uniform Buffer in
    // Let's say you have 2 unique UBO, you'll store the first one in index 0 and the second one in index 1
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, uboBuffer)

    // Get the respective index of the member variables inside our Uniform Block
    const uboVariableIndices = gl.getUniformIndices(program, uboVariableNames)

    if (!uboVariableIndices) {
      throw new Error('Unable to get uniform indices')
    }

    // Get the offset of the member variables inside our Uniform Block in bytes
    const uboVariableOffsets = gl.getActiveUniforms(program, uboVariableIndices, gl.UNIFORM_OFFSET)

    // Create an object to map each variable name to its respective index and offset
    const uboVariableInfo = new Map()

    uboVariableNames.forEach((name, index) => {
      uboVariableInfo.set(name, {
        index: uboVariableIndices[index],
        offset: uboVariableOffsets[index]
      })
    })

    this.uboVariableInfo.set(uniformBlockName, uboVariableInfo)

    const index = gl.getUniformBlockIndex(program, uniformBlockName)
    gl.uniformBlockBinding(program, index, 0)

    this.uboBuffers.set(uniformBlockName, uboBuffer)
  }

  warpedMapAdded(event) {
    const { mapId, image, transformer, triangles } = event.data

    const gl = this.gl
    const program = this.program

    if (gl && program) {
      const warpedMapWebGLRenderer = new WarpedMapWebGLRenderer(gl, program, mapId, {
        image,
        transformer,
        triangles
      })
      this.warpedMapWebGLRenderers.set(mapId, warpedMapWebGLRenderer)

      warpedMapWebGLRenderer.on(WarpedMapEventType.TILELOADED, this.tileLoaded.bind(this))
    }

    // this.changed()
  }

  warpedMapEnterExtent(event) {
    const { mapId } = event.data
    this.mapIdsInExtent.add(mapId)

    // const warpedMapWebGLRenderer = this.warpedMapWebGLRenderers.get(mapId)
    // TODO: set visible
  }

  warpedMapLeaveExtent(event) {
    const { mapId } = event.data
    this.mapIdsInExtent.delete(mapId)

    // const warpedMapWebGLRenderer = this.warpedMapWebGLRenderers.get(mapId)
    // TODO: set invisible
  }

  tileNeeded(event) {
    const { mapId, url, tile, imageRequest } = event.data

    const warpedMapWebGLRenderer = this.warpedMapWebGLRenderers.get(mapId)
    warpedMapWebGLRenderer.addTileNeeded(url, tile, imageRequest)
  }

  tileUnneeded(event) {
    const { mapId, url } = event.data

    const warpedMapWebGLRenderer = this.warpedMapWebGLRenderers.get(mapId)
    warpedMapWebGLRenderer.deleteTileNeeded(url)
  }

  tileLoaded(event) {
    this.changed()
  }

  createShader(
    gl: WebGL2RenderingContext,
    type: WebGLRenderingContextBase['VERTEX_SHADER'],
    source: string
  ): WebGLShader {
    const shader = gl.createShader(type)

    if (shader) {
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
      if (success) {
        return shader
      } else {
        const message = gl.getShaderInfoLog(shader)
        gl.deleteShader(shader)
        throw new Error('Failed to compile shader: ' + message)
      }
    } else {
      throw new Error('Failed to create shader')
    }
  }

  createProgram(
    gl: WebGL2RenderingContext,
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader
  ): WebGLProgram {
    const program = gl.createProgram()

    if (program) {
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)
      const success = gl.getProgramParameter(program, gl.LINK_STATUS)
      if (success) {
        return program
      } else {
        const message = gl.getProgramInfoLog(program)
        gl.deleteProgram(program)
        throw new Error('Failed to link program: ' + message)
      }
    } else {
      throw new Error('Failed to create program')
    }
  }

  onResize(entries: ResizeObserverEntry[]) {
    // From https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
    for (const entry of entries) {
      let width
      let height
      let dpr = window.devicePixelRatio
      if (entry.devicePixelContentBoxSize) {
        // NOTE: Only this path gives the correct answer
        // The other paths are imperfect fallbacks
        // for browsers that don't provide anyway to do this
        width = entry.devicePixelContentBoxSize[0].inlineSize
        height = entry.devicePixelContentBoxSize[0].blockSize
        dpr = 1 // it's already in width and height
      } else if (entry.contentBoxSize) {
        if (entry.contentBoxSize[0]) {
          width = entry.contentBoxSize[0].inlineSize
          height = entry.contentBoxSize[0].blockSize
        } else {
          width = entry.contentBoxSize.inlineSize
          height = entry.contentBoxSize.blockSize
        }
      } else {
        width = entry.contentRect.width
        height = entry.contentRect.height
      }

      const displayWidth = Math.round(width * dpr)
      const displayHeight = Math.round(height * dpr)

      this.canvasSize = [displayWidth, displayHeight]
    }

    this.changed()
  }

  resizeCanvas(canvas: HTMLCanvasElement, [width, height]: [number, number]) {
    const needResize = canvas.width !== width || canvas.height !== height

    if (needResize) {
      canvas.width = width
      canvas.height = height
    }

    return needResize
  }

  destroy() {
    // Remove WebGL context, all textures etc.
  }

  render(frameState: FrameState, target: HTMLElement): HTMLElement {
    if (this.canvas) {
      this.resizeCanvas(this.canvas, this.canvasSize)
    }

    if (this.throttledUpdateNeededTiles) {
      this.throttledUpdateNeededTiles(
        frameState.size,
        frameState.extent,
        frameState.coordinateToPixelTransform
      )
    }

    if (this.gl && this.program) {
      const gl = this.gl

      const extent = frameState.extent
      const southWest = [extent[0], extent[1]]
      const northEast = [extent[2], extent[3]]

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.useProgram(this.program)

      // Settings UBO // // // // // // // // // // // // // // // //

      const settingsUboBuffer = this.uboBuffers.get('Settings')
      const settingsUboVariableInfo = this.uboVariableInfo.get('Settings')

      gl.bindBuffer(gl.UNIFORM_BUFFER, settingsUboBuffer)

      gl.bufferSubData(
        gl.UNIFORM_BUFFER,
        settingsUboVariableInfo.get('u_opacity').offset,
        new Float32Array([this.getOpacity()]),
        0
      )

      // gl.bufferSubData(
      //   gl.UNIFORM_BUFFER,
      //   settingsUboVariableInfo.get('u_southWest').offset,
      //   new Float32Array(southWest),
      //   0
      // )

      // gl.bufferSubData(
      //   gl.UNIFORM_BUFFER,
      //   settingsUboVariableInfo.get('u_northEast').offset,
      //   new Float32Array(northEast),
      //   0
      // )

      gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, settingsUboBuffer)
      gl.bindBuffer(gl.UNIFORM_BUFFER, null)

      // // // // // // // // // // // // // // // // // // // // // //

      for (let mapId of this.mapIdsInExtent) {
        const viewportSizeLocation = gl.getUniformLocation(this.program, 'u_viewport_size')
        // TODO: pixelRatio!
        gl.uniform1fv(viewportSizeLocation, [gl.canvas.width / 2, gl.canvas.height / 2])

        const coordinateToPixelLocation = gl.getUniformLocation(
          this.program,
          'u_coordinate_to_pixel'
        )

        gl.uniform1fv(coordinateToPixelLocation, frameState.coordinateToPixelTransform)

        const warpedMapWebGLRenderer = this.warpedMapWebGLRenderers.get(mapId)

        // Transformer UBO // // // // // // // // // // // // // // //

        const transformerUboBuffer = this.uboBuffers.get('Transformer')
        const transformerUboVariableInfo = this.uboVariableInfo.get('Transformer')

        // gl.bindBuffer(gl.UNIFORM_BUFFER, transformerUboBuffer)

        // gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, transformerUboBuffer)
        // gl.bindBuffer(gl.UNIFORM_BUFFER, null)

        // // // // // // // // // // // // // // // // // // // // // //

        const u_tilesTextureLocation = gl.getUniformLocation(this.program, 'u_tilesTexture')
        gl.uniform1i(u_tilesTextureLocation, 0)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, warpedMapWebGLRenderer.tilesTexture)

        const u_tilePositionsTextureLocation = gl.getUniformLocation(
          this.program,
          'u_tilePositionsTexture'
        )
        gl.uniform1i(u_tilePositionsTextureLocation, 1)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, warpedMapWebGLRenderer.tilePositionsTexture)

        const u_imagePositionsTextureLocation = gl.getUniformLocation(
          this.program,
          'u_imagePositionsTexture'
        )
        gl.uniform1i(u_imagePositionsTextureLocation, 2)
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, warpedMapWebGLRenderer.imagePositionsTexture)

        const u_scaleFactorsTextureLocation = gl.getUniformLocation(
          this.program,
          'u_scaleFactorsTexture'
        )
        gl.uniform1i(u_scaleFactorsTextureLocation, 3)
        gl.activeTexture(gl.TEXTURE3)
        gl.bindTexture(gl.TEXTURE_2D, warpedMapWebGLRenderer.scaleFactorsTexture)

        const vao = warpedMapWebGLRenderer.vao
        const triangles = warpedMapWebGLRenderer.triangles

        const primitiveType = this.gl.TRIANGLES
        const offset = 0
        const count = triangles.length / 2

        gl.bindVertexArray(vao)
        gl.drawArrays(primitiveType, offset, count)
      }
    }

    return this.container
  }
}
