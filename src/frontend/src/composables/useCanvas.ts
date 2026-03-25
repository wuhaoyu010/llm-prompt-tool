import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import Konva from 'konva'

interface CanvasConfig {
  width?: number
  height?: number
  draggable?: boolean
}

interface ImageOptions {
  x?: number
  y?: number
  width?: number
  height?: number
  draggable?: boolean
  fill?: string
  stroke?: string
  strokeWidth?: number
  [key: string]: any
}

export function useCanvas(containerRef: Ref<HTMLElement | null>, config: CanvasConfig = {}) {
  const stage = ref<Konva.Stage | null>(null)
  const layer = ref<Konva.Layer | null>(null)
  const isReady = ref(false)

  function initCanvas(): void {
    if (!containerRef.value) return

    const container = containerRef.value as HTMLDivElement
    const width = config.width || container.offsetWidth || 800
    const height = config.height || container.offsetHeight || 600

    stage.value = new Konva.Stage({
      container: container,
      width,
      height,
      draggable: false
    })

    layer.value = new Konva.Layer() as any
    stage.value.add(layer.value as any)
    isReady.value = true
  }

  function destroyCanvas(): void {
    if (stage.value) {
      stage.value.destroy()
      stage.value = null
      layer.value = null
      isReady.value = false
    }
  }

  function addImage(imageUrl: string, options: ImageOptions = {}): Promise<Konva.Image> {
    return new Promise((resolve) => {
      const imageObj = new Image()
      imageObj.onload = () => {
        const img = new Konva.Image({
          image: imageObj,
          x: options.x || 0,
          y: options.y || 0,
          width: options.width || imageObj.width,
          height: options.height || imageObj.height,
          ...options
        })
        if (layer.value) {
          layer.value.add(img)
          layer.value.batchDraw()
        }
        resolve(img)
      }
      imageObj.src = imageUrl
    })
  }

  function addRect(options: ImageOptions = {}): Konva.Rect {
    const rect = new Konva.Rect({
      x: options.x || 0,
      y: options.y || 0,
      width: options.width || 100,
      height: options.height || 100,
      fill: options.fill || 'rgba(79, 70, 229, 0.3)',
      stroke: options.stroke || '#4F46E5',
      strokeWidth: options.strokeWidth || 2,
      draggable: options.draggable !== false,
      ...options
    })

    if (layer.value) {
      layer.value.add(rect)
      layer.value.batchDraw()
    }
    return rect
  }

  function addTransformer(node: Konva.Node): Konva.Transformer {
    const transformer = new Konva.Transformer({
      rotateEnabled: false,
      boundBoxFunc: (oldBox, newBox) => {
        if (newBox.width < 10 || newBox.height < 10) {
          return oldBox
        }
        return newBox
      }
    })

    if (layer.value) {
      layer.value.add(transformer)
      transformer.attachTo(node)
      layer.value.batchDraw()
    }

    return transformer
  }

  function removeNode(node: Konva.Node | undefined): void {
    node?.destroy()
    if (layer.value) {
      layer.value.batchDraw()
    }
  }

  function getNodesByType(type: string): Konva.Node[] {
    return layer.value?.find(`.${type}`) || []
  }

  function clear(): void {
    if (layer.value) {
      layer.value.destroyChildren()
      layer.value.batchDraw()
    }
  }

  function toJSON(): string {
    return stage.value?.toJSON() || ''
  }

  function loadJSON(json: string): Konva.Stage {
    return Konva.Node.create(json) as Konva.Stage
  }

  onMounted(() => {
    initCanvas()
  })

  onUnmounted(() => {
    destroyCanvas()
  })

  return {
    stage,
    layer,
    isReady,
    initCanvas,
    destroyCanvas,
    addImage,
    addRect,
    addTransformer,
    removeNode,
    getNodesByType,
    clear,
    toJSON,
    loadJSON
  }
}
