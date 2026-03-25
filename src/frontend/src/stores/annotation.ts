import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api'

interface Box {
  id: string
  x: number
  y: number
  width: number
  height: number
  label?: string
}

interface HistoryAction {
  action: 'add' | 'delete' | 'update' | 'clear'
  data?: unknown
  previousData?: unknown
}

export const useAnnotationStore = defineStore('annotation', () => {
  const testCases = ref<any[]>([])
  const currentTestCaseId = ref<number | null>(null)
  const annotations = ref<Record<number, { boxes: Box[]; history: HistoryAction[]; isDirty: boolean; lastSaved?: number }>>({})
  const history = ref<HistoryAction[]>([])
  const redoStack = ref<HistoryAction[]>([])
  const isDirty = ref(false)

  const currentAnnotations = computed(() => {
    if (!currentTestCaseId.value) return []
    return annotations.value[currentTestCaseId.value]?.boxes || []
  })

  async function fetchTestCases(defectId: number): Promise<void> {
    try {
      const data = await api.get<any>(`/api/defect/${defectId}`)
      if (data.defect?.test_cases) {
        testCases.value = data.defect.test_cases
      } else if (data.test_cases) {
        testCases.value = data.test_cases
      } else {
        testCases.value = []
      }
    } catch (error) {
      console.error('Failed to fetch test cases:', error)
    }
  }

  async function selectTestCase(testCaseId: number): Promise<void> {
    if (currentTestCaseId.value === testCaseId) return

    if (currentTestCaseId.value) {
      saveToCache(currentTestCaseId.value)
    }

    currentTestCaseId.value = testCaseId
    await loadAnnotations(testCaseId)
  }

  function saveToCache(testCaseId: number): void {
    if (!annotations.value[testCaseId]) {
      annotations.value[testCaseId] = { boxes: [], history: [], isDirty: false }
    }
    annotations.value[testCaseId].isDirty = true
    annotations.value[testCaseId].lastSaved = Date.now()
  }

  function loadFromCache(testCaseId: number): void {
    if (!annotations.value[testCaseId]) {
      annotations.value[testCaseId] = { boxes: [], history: [], isDirty: false }
    }
  }

  function addBox(box: Box): void {
    if (!currentTestCaseId.value) return

    if (!annotations.value[currentTestCaseId.value]) {
      annotations.value[currentTestCaseId.value] = { boxes: [], history: [], isDirty: false }
    }

    annotations.value[currentTestCaseId.value].boxes.push(box)
    history.value.push({ action: 'add', data: box })
    isDirty.value = true
  }

  function removeBox(boxId: string): void {
    if (!currentTestCaseId.value) return

    const boxes = annotations.value[currentTestCaseId.value].boxes
    const index = boxes.findIndex(b => b.id === boxId)
    if (index > -1) {
      const removed = boxes.splice(index, 1)[0]
      history.value.push({ action: 'delete', data: removed })
      isDirty.value = true
    }
  }

  function updateBox(updatedBox: Box): void {
    if (!currentTestCaseId.value) return

    const boxes = annotations.value[currentTestCaseId.value].boxes
    const index = boxes.findIndex(b => b.id === updatedBox.id)
    if (index > -1) {
      const previousBox = { ...boxes[index] }
      boxes[index] = { ...boxes[index], ...updatedBox }
      history.value.push({ action: 'update', data: updatedBox, previousData: previousBox })
      isDirty.value = true
    }
  }

  function clearAnnotations(): void {
    if (!currentTestCaseId.value) return

    if (!annotations.value[currentTestCaseId.value]) {
      annotations.value[currentTestCaseId.value] = { boxes: [], history: [], isDirty: false }
    }
    const previousBoxes = [...annotations.value[currentTestCaseId.value].boxes]
    annotations.value[currentTestCaseId.value].boxes = []
    history.value.push({ action: 'clear', data: [], previousData: previousBoxes })
    isDirty.value = true
  }

  function undo(): boolean {
    if (history.value.length === 0) return false
    const action = history.value.pop()!

    switch (action.action) {
      case 'add': {
        const box = action.data as Box
        if (currentTestCaseId.value && annotations.value[currentTestCaseId.value]) {
          const boxes = annotations.value[currentTestCaseId.value].boxes
          const index = boxes.findIndex(b => b.id === box.id)
          if (index > -1) boxes.splice(index, 1)
        }
        break
      }
      case 'delete': {
        const box = action.data as Box
        if (currentTestCaseId.value && annotations.value[currentTestCaseId.value]) {
          annotations.value[currentTestCaseId.value].boxes.push(box)
        }
        break
      }
      case 'update': {
        const previousData = action.previousData as Box
        if (currentTestCaseId.value && annotations.value[currentTestCaseId.value]) {
          const boxes = annotations.value[currentTestCaseId.value].boxes
          const index = boxes.findIndex(b => b.id === previousData.id)
          if (index > -1) boxes[index] = previousData
        }
        break
      }
      case 'clear': {
        const previousBoxes = action.previousData as Box[]
        if (currentTestCaseId.value && annotations.value[currentTestCaseId.value]) {
          annotations.value[currentTestCaseId.value].boxes = previousBoxes
        }
        break
      }
    }

    redoStack.value.push(action)
    isDirty.value = true
    return true
  }

  function redo(): boolean {
    if (redoStack.value.length === 0) return false
    const action = redoStack.value.pop()!

    switch (action.action) {
      case 'add': {
        const box = action.data as Box
        if (currentTestCaseId.value && annotations.value[currentTestCaseId.value]) {
          annotations.value[currentTestCaseId.value].boxes.push(box)
        }
        break
      }
      case 'delete': {
        const box = action.data as Box
        if (currentTestCaseId.value && annotations.value[currentTestCaseId.value]) {
          const boxes = annotations.value[currentTestCaseId.value].boxes
          const index = boxes.findIndex(b => b.id === box.id)
          if (index > -1) boxes.splice(index, 1)
        }
        break
      }
      case 'update': {
        const currentData = action.data as Box
        if (currentTestCaseId.value && annotations.value[currentTestCaseId.value]) {
          const boxes = annotations.value[currentTestCaseId.value].boxes
          const index = boxes.findIndex(b => b.id === currentData.id)
          if (index > -1) boxes[index] = currentData
        }
        break
      }
      case 'clear': {
        const clearedBoxes = action.data as Box[]
        if (currentTestCaseId.value && annotations.value[currentTestCaseId.value]) {
          annotations.value[currentTestCaseId.value].boxes = clearedBoxes
        }
        break
      }
    }

    history.value.push(action)
    isDirty.value = true
    return true
  }

  async function saveAnnotations(testCaseId: number): Promise<void> {
    if (!annotations.value[testCaseId]) return

    try {
      const boxes = annotations.value[testCaseId].boxes
      const boxesData = boxes.map(box => [
        Math.round(box.x),
        Math.round(box.y),
        Math.round(box.x + box.width),
        Math.round(box.y + box.height)
      ])
      await api.put(`/api/testcase/${testCaseId}/boxes`, { boxes: boxesData })
      annotations.value[testCaseId].isDirty = false
      isDirty.value = false
    } catch (error) {
      console.error('Failed to save annotations:', error)
    }
  }

  async function loadAnnotations(testCaseId: number): Promise<void> {
    try {
      const data = await api.get<any>(`/api/testcase/${testCaseId}/boxes`)
      const boxes: Box[] = (Array.isArray(data) ? data : []).map((item: any, index: number) => ({
        id: `box_${item.norm_box[0]}_${index}`,
        x: item.norm_box[0],
        y: item.norm_box[1],
        width: item.norm_box[2] - item.norm_box[0],
        height: item.norm_box[3] - item.norm_box[1],
        label: item.label || ''
      }))
      annotations.value[testCaseId] = { boxes, history: [], isDirty: false }
    } catch (error) {
      console.error('Failed to load annotations:', error)
      annotations.value[testCaseId] = { boxes: [], history: [], isDirty: false }
    }
  }

  return {
    testCases,
    currentTestCaseId,
    annotations,
    history,
    redoStack,
    isDirty,
    currentAnnotations,
    fetchTestCases,
    selectTestCase,
    addBox,
    removeBox,
    updateBox,
    clearAnnotations,
    undo,
    redo,
    saveAnnotations,
    loadAnnotations,
    saveToCache,
    loadFromCache
  }
})
