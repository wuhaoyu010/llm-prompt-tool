const NORM_MAX = 999

interface Annotation {
  id: string
  x: number
  y: number
  width: number
  height: number
  label?: string
  type?: string
}

interface ImageSize {
  width: number
  height: number
}

interface AnnotoriousAnnotation {
  id: string
  type: 'Annotation'
  body: Array<{
    type: 'TextualBody'
    value: string
    purpose: string
  }>
  target: {
    selector: {
      type: 'FragmentSelector'
      conformsTo: string
      value: string
    }
  }
}

export function toAnnotoriousFormat(annotations: Annotation[], imageSize: ImageSize): AnnotoriousAnnotation[] {
  if (!annotations || !imageSize) return []

  return annotations.map((anno, index) => {
    const { id, x, y, width, height, label, type = 'rectangle' } = anno

    const pixelX = (x / NORM_MAX) * imageSize.width
    const pixelY = (y / NORM_MAX) * imageSize.height
    const pixelW = (width / NORM_MAX) * imageSize.width
    const pixelH = (height / NORM_MAX) * imageSize.height

    const annotoriousAnno: AnnotoriousAnnotation = {
      id: id || `anno_${Date.now()}_${index}`,
      type: 'Annotation',
      body: [
        {
          type: 'TextualBody',
          value: label || '',
          purpose: 'tagging'
        }
      ],
      target: {
        selector: {
          type: 'FragmentSelector',
          conformsTo: 'http://www.w3.org/TR/media-frags/',
          value: `xywh=pixel:${pixelX},${pixelY},${pixelW},${pixelH}`
        }
      }
    }

    return annotoriousAnno
  })
}

export function fromAnnotoriousFormat(annotations: AnnotoriousAnnotation[], imageSize: ImageSize): Annotation[] {
  if (!annotations || !imageSize) return []

  return annotations.map(anno => {
    const { id, body, target } = anno

    const selector = target?.selector
    let x = 0, y = 0, width = 0, height = 0

    if (selector?.type === 'FragmentSelector') {
      const value = selector.value
      const match = value.match(/xywh=pixel:(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/)
      if (match) {
        x = parseFloat(match[1])
        y = parseFloat(match[2])
        width = parseFloat(match[3])
        height = parseFloat(match[4])
      }
    }

    let label = ''
    if (body && body.length > 0) {
      const textBody = body.find(b => b.type === 'TextualBody')
      if (textBody) {
        label = textBody.value
      }
    }

    const normX = Math.round((x / imageSize.width) * NORM_MAX)
    const normY = Math.round((y / imageSize.height) * NORM_MAX)
    const normW = Math.round((width / imageSize.width) * NORM_MAX)
    const normH = Math.round((height / imageSize.height) * NORM_MAX)

    return {
      id,
      x: normX,
      y: normY,
      width: normW,
      height: normH,
      label,
      type: 'rectangle'
    }
  })
}

export function singleFromAnnotorious(anno: AnnotoriousAnnotation, imageSize: ImageSize): Annotation | null {
  if (!anno || !imageSize) return null

  const { id, body, target } = anno

  const selector = target?.selector
  let x = 0, y = 0, width = 0, height = 0

  if (selector?.type === 'FragmentSelector') {
    const value = selector.value
    const match = value.match(/xywh=pixel:(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/)
    if (match) {
      x = parseFloat(match[1])
      y = parseFloat(match[2])
      width = parseFloat(match[3])
      height = parseFloat(match[4])
    }
  }

  let label = ''
  if (body && body.length > 0) {
    const textBody = body.find(b => b.type === 'TextualBody')
    if (textBody) {
      label = textBody.value
    }
  }

  const normX = Math.round((x / imageSize.width) * NORM_MAX)
  const normY = Math.round((y / imageSize.height) * NORM_MAX)
  const normW = Math.round((width / imageSize.width) * NORM_MAX)
  const normH = Math.round((height / imageSize.height) * NORM_MAX)

  return {
    id: id || `box_${Date.now()}`,
    x: normX,
    y: normY,
    width: normW,
    height: normH,
    label,
    type: 'rectangle'
  }
}

export function toApiFormat(annotations: Annotation[]): Annotation[] {
  if (!annotations) return []

  return annotations.map(anno => ({
    id: anno.id,
    x: anno.x,
    y: anno.y,
    width: anno.width,
    height: anno.height,
    label: anno.label || '',
    type: anno.type || 'rectangle'
  }))
}

export function fromApiFormat(apiAnnotations: any[]): Annotation[] {
  if (!apiAnnotations) return []

  return apiAnnotations.map(anno => ({
    id: anno.id,
    x: anno.x,
    y: anno.y,
    width: anno.width,
    height: anno.height,
    label: anno.label || '',
    type: anno.type || 'rectangle'
  }))
}
