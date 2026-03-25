import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnnotationStore } from '../annotation'

describe('AnnotationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should initialize with empty state', () => {
    const store = useAnnotationStore()
    expect(store.testCases).toEqual([])
    expect(store.currentTestCaseId).toBeNull()
    expect(store.annotations).toEqual({})
    expect(store.isDirty).toBe(false)
  })

  it('should add a box', () => {
    const store = useAnnotationStore()
    store.currentTestCaseId = 1

    store.addBox({
      id: 'box_1',
      x: 10,
      y: 10,
      width: 100,
      height: 100
    })

    expect(store.annotations[1]).toBeDefined()
    expect(store.annotations[1].boxes).toHaveLength(1)
    expect(store.isDirty).toBe(true)
  })

  it('should remove a box', () => {
    const store = useAnnotationStore()
    store.currentTestCaseId = 1
    store.annotations[1] = {
      boxes: [{ id: 'box_1', x: 10, y: 10, width: 100, height: 100 }],
      history: [],
      isDirty: false
    }

    store.removeBox('box_1')

    expect(store.annotations[1].boxes).toHaveLength(0)
    expect(store.isDirty).toBe(true)
  })

  it('should clear annotations', () => {
    const store = useAnnotationStore()
    store.currentTestCaseId = 1
    store.annotations[1] = {
      boxes: [{ id: 'box_1', x: 10, y: 10, width: 100, height: 100 }],
      history: [],
      isDirty: false
    }

    store.clearAnnotations()

    expect(store.annotations[1].boxes).toHaveLength(0)
    expect(store.isDirty).toBe(true)
  })

  it('should undo action', () => {
    const store = useAnnotationStore()
    store.history = [{ action: 'add', data: { id: 'box_1' } }]

    const action = store.undo()

    expect(action).toEqual({ action: 'add', data: { id: 'box_1' } })
    expect(store.redoStack).toHaveLength(1)
  })

  it('should redo action', () => {
    const store = useAnnotationStore()
    store.redoStack = [{ action: 'add', data: { id: 'box_1' } }]

    const action = store.redo()

    expect(action).toEqual({ action: 'add', data: { id: 'box_1' } })
    expect(store.history).toHaveLength(1)
  })
})
