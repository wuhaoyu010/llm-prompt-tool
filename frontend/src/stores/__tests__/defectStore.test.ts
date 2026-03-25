import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDefectStore } from '../defect'

describe('DefectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should initialize with empty state', () => {
    const store = useDefectStore()
    expect(store.defects).toEqual([])
    expect(store.currentDefect).toBeNull()
    expect(store.currentVersionId).toBeNull()
    expect(store.versions).toEqual([])
    expect(store.isLoading).toBe(false)
  })

  it('should set current version', () => {
    const store = useDefectStore()
    store.setVersion(5)
    expect(store.currentVersionId).toBe(5)
  })
})
