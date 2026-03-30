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
  data?: Box | Box[]
  previousData?: Box | Box[]
  timestamp: number
}

// 单个测试用例的标注数据（新结构：暂存区模式）
interface TestCaseAnnotation {
  savedBoxes: Box[]           // 已保存到后端的数据（只读）
  stagingBoxes: Box[]         // 暂存区数据（编辑中）
  stagingHistory: HistoryAction[]  // 暂存区操作历史
  stagingRedoStack: HistoryAction[]  // 暂存区重做栈
  isStaging: boolean          // 是否正在使用暂存区
  isDirty: boolean            // 是否有未保存修改
  lastSaved?: number          // 最后保存时间
  lastModified?: number       // 最后修改时间
}

// 创建空的测试用例标注数据
function createEmptyAnnotation(): TestCaseAnnotation {
  return {
    savedBoxes: [],
    stagingBoxes: [],
    stagingHistory: [],
    stagingRedoStack: [],
    isStaging: false,
    isDirty: false
  }
}

// 检查暂存区数据是否与已保存数据相同
function isStagingSameAsSaved(tcData: TestCaseAnnotation): boolean {
  if (tcData.savedBoxes.length !== tcData.stagingBoxes.length) return false
  // 简单比较，如果长度相同且没有任何修改历史，认为相同
  return tcData.stagingHistory.length === 0
}

export const useAnnotationStore = defineStore('annotation', () => {
  const testCases = ref<any[]>([])
  const currentTestCaseId = ref<number | null>(null)
  const annotations = ref<Record<number, TestCaseAnnotation>>({})

  // 兼容旧 API 的全局 isDirty
  const isDirty = computed(() => {
    if (!currentTestCaseId.value) return false
    return annotations.value[currentTestCaseId.value]?.isDirty || false
  })

  // 当前测试用例是否有未保存修改
  const currentIsDirty = computed(() => {
    if (!currentTestCaseId.value) return false
    return annotations.value[currentTestCaseId.value]?.isDirty || false
  })

  // 当前标注数据（优先返回暂存区数据）
  const currentAnnotations = computed(() => {
    if (!currentTestCaseId.value) return []
    const tcData = annotations.value[currentTestCaseId.value]
    if (!tcData) return []

    // 如果正在暂存，返回暂存区数据
    if (tcData.isStaging) {
      return tcData.stagingBoxes || []
    }

    // 否则返回已保存数据
    // 添加fallback确保永远返回数组，防止undefined导致Konva渲染失败
    return tcData.savedBoxes || []
  })

  // 所有有未保存修改的测试用例ID列表
  const dirtyTestCaseIds = computed(() => {
    return Object.entries(annotations.value)
      .filter(([_, data]) => data.isDirty)
      .map(([id, _]) => Number(id))
  })

  // 未保存修改总数
  const totalUnsavedCount = computed(() => {
    return dirtyTestCaseIds.value.length
  })

  // 操作历史（兼容旧 API，返回当前测试用例的历史）
  const history = computed(() => {
    if (!currentTestCaseId.value) return []
    return annotations.value[currentTestCaseId.value]?.stagingHistory || []
  })

  // 重做栈（兼容旧 API）
  const redoStack = computed(() => {
    if (!currentTestCaseId.value) return []
    return annotations.value[currentTestCaseId.value]?.stagingRedoStack || []
  })

  // 获取有未保存修改的测试用例详情列表
  function getUnsavedItems(): Array<{ id: number; boxCount: number; filename: string; thumbnail: string }> {
    return dirtyTestCaseIds.value.map(id => {
      const tc = testCases.value.find(t => t.id === id)
      const tcData = annotations.value[id]
      return {
        id,
        boxCount: tcData?.isStaging ? tcData.stagingBoxes.length : tcData?.savedBoxes.length || 0,
        filename: tc?.filename || tc?.name || `测试用例 #${id}`,
        thumbnail: tc?.preview_url || ''
      }
    })
  }

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

      // 清理已删除测试用例的标注数据
      const validIds = new Set(testCases.value.map(tc => tc.id))
      Object.keys(annotations.value).forEach(id => {
        if (!validIds.has(Number(id))) {
          delete annotations.value[Number(id)]
        }
      })
    } catch (error) {
      console.error('Failed to fetch test cases:', error)
    }
  }

  // 切换测试用例（同步操作，避免竞态条件）
  function selectTestCase(testCaseId: number): void {
    if (currentTestCaseId.value === testCaseId) return

    // 立即更新当前测试用例ID（同步）
    currentTestCaseId.value = testCaseId

    // 如果新测试用例数据不存在，初始化并从后端加载
    if (!annotations.value[testCaseId]) {
      annotations.value[testCaseId] = createEmptyAnnotation()
      loadAnnotations(testCaseId)
    }
  }

  // 为指定测试用例进入暂存模式
  function enterStagingModeForId(tcId: number): void {
    const tcData = annotations.value[tcId]
    if (!tcData) return

    if (!tcData.isStaging) {
      // 首次修改：从 savedBoxes 复制到 stagingBoxes
      tcData.stagingBoxes = [...tcData.savedBoxes]
      tcData.stagingHistory = []
      tcData.stagingRedoStack = []
      tcData.isStaging = true
    }
  }

  function addBox(box: Box): void {
    // 关键：在函数开始时捕获当前测试用例ID，防止竞态条件
    const targetTestCaseId = currentTestCaseId.value
    if (!targetTestCaseId) return

    // 确保数据结构存在
    if (!annotations.value[targetTestCaseId]) {
      annotations.value[targetTestCaseId] = createEmptyAnnotation()
    }

    // 进入暂存模式
    enterStagingModeForId(targetTestCaseId)

    const tcData = annotations.value[targetTestCaseId]

    // 添加到暂存区
    tcData.stagingBoxes.push(box)

    // 记录操作历史
    tcData.stagingHistory.push({
      action: 'add',
      data: box,
      timestamp: Date.now()
    })

    // 清空重做栈
    tcData.stagingRedoStack = []

    // 标记为脏
    tcData.isDirty = true
    tcData.lastModified = Date.now()
  }

  function removeBox(boxId: string): void {
    const targetTestCaseId = currentTestCaseId.value
    if (!targetTestCaseId) return

    const tcData = annotations.value[targetTestCaseId]
    if (!tcData) return

    // 进入暂存模式
    enterStagingModeForId(targetTestCaseId)

    const index = tcData.stagingBoxes.findIndex(b => b.id === boxId)
    if (index > -1) {
      const removed = tcData.stagingBoxes[index]

      // 使用filter创建新数组，而不是splice直接修改（Vue响应式要求）
      tcData.stagingBoxes = tcData.stagingBoxes.filter((_, i) => i !== index)

      // 记录操作历史
      tcData.stagingHistory.push({
        action: 'delete',
        data: removed,
        timestamp: Date.now()
      })

      tcData.stagingRedoStack = []
      tcData.isDirty = true
      tcData.lastModified = Date.now()
    }
  }

  function updateBox(updatedBox: Box): void {
    const targetTestCaseId = currentTestCaseId.value
    if (!targetTestCaseId) return

    const tcData = annotations.value[targetTestCaseId]
    if (!tcData) return

    // 进入暂存模式
    enterStagingModeForId(targetTestCaseId)

    const boxes = tcData.stagingBoxes
    const index = boxes.findIndex(b => b.id === updatedBox.id)
    if (index > -1) {
      const previousBox = { ...boxes[index] }
      boxes[index] = { ...boxes[index], ...updatedBox }

      // 记录操作历史
      tcData.stagingHistory.push({
        action: 'update',
        data: updatedBox,
        previousData: previousBox,
        timestamp: Date.now()
      })

      tcData.stagingRedoStack = []
      tcData.isDirty = true
      tcData.lastModified = Date.now()
    }
  }

  function clearAnnotations(): void {
    const targetTestCaseId = currentTestCaseId.value
    if (!targetTestCaseId) return

    if (!annotations.value[targetTestCaseId]) {
      annotations.value[targetTestCaseId] = createEmptyAnnotation()
    }

    // 进入暂存模式
    enterStagingModeForId(targetTestCaseId)

    const tcData = annotations.value[targetTestCaseId]
    const previousBoxes = [...tcData.stagingBoxes]

    tcData.stagingBoxes = []

    tcData.stagingHistory.push({
      action: 'clear',
      data: [],
      previousData: previousBoxes,
      timestamp: Date.now()
    })

    tcData.stagingRedoStack = []
    tcData.isDirty = true
    tcData.lastModified = Date.now()
  }

  // 撤销操作的辅助函数
  function applyUndoAction(boxes: Box[], action: HistoryAction): void {
    switch (action.action) {
      case 'add': {
        const box = action.data as Box
        const index = boxes.findIndex(b => b.id === box.id)
        if (index > -1) boxes.splice(index, 1)
        break
      }
      case 'delete': {
        const box = action.data as Box
        boxes.push(box)
        break
      }
      case 'update': {
        const previousData = action.previousData as Box
        const index = boxes.findIndex(b => b.id === previousData.id)
        if (index > -1) boxes[index] = previousData
        break
      }
      case 'clear': {
        const previousBoxes = action.previousData as Box[]
        boxes.length = 0
        boxes.push(...previousBoxes)
        break
      }
    }
  }

  // 重做操作的辅助函数
  function applyRedoAction(boxes: Box[], action: HistoryAction): void {
    switch (action.action) {
      case 'add': {
        const box = action.data as Box
        boxes.push(box)
        break
      }
      case 'delete': {
        const box = action.data as Box
        const index = boxes.findIndex(b => b.id === box.id)
        if (index > -1) boxes.splice(index, 1)
        break
      }
      case 'update': {
        const currentData = action.data as Box
        const index = boxes.findIndex(b => b.id === currentData.id)
        if (index > -1) boxes[index] = currentData
        break
      }
      case 'clear': {
        boxes.length = 0
        break
      }
    }
  }

  function undo(): boolean {
    const tcId = currentTestCaseId.value
    if (!tcId) return false

    const tcData = annotations.value[tcId]
    if (!tcData || !tcData.isStaging || tcData.stagingHistory.length === 0) {
      return false
    }

    const action = tcData.stagingHistory.pop()!

    // 执行反向操作
    applyUndoAction(tcData.stagingBoxes, action)

    // 推入重做栈
    tcData.stagingRedoStack.push(action)

    // 检查是否还有修改
    tcData.isDirty = !isStagingSameAsSaved(tcData)
    tcData.lastModified = Date.now()

    return true
  }

  function redo(): boolean {
    const tcId = currentTestCaseId.value
    if (!tcId) return false

    const tcData = annotations.value[tcId]
    if (!tcData || tcData.stagingRedoStack.length === 0) {
      return false
    }

    const action = tcData.stagingRedoStack.pop()!

    // 执行正向操作
    applyRedoAction(tcData.stagingBoxes, action)

    // 推入历史栈
    tcData.stagingHistory.push(action)

    tcData.isDirty = true
    tcData.lastModified = Date.now()

    return true
  }

  // 保存到后端
  async function saveAnnotations(testCaseId?: number): Promise<void> {
    const targetId = testCaseId || currentTestCaseId.value
    if (!targetId) return

    const tcData = annotations.value[targetId]
    if (!tcData) return

    try {
      const boxes = tcData.isStaging ? tcData.stagingBoxes : tcData.savedBoxes
      const boxesData = boxes.map(box => [
        Math.round(box.x),
        Math.round(box.y),
        Math.round(box.x + box.width),
        Math.round(box.y + box.height)
      ])

      await api.put(`/api/testcase/${targetId}/boxes`, { boxes: boxesData })

      // 更新已保存数据
      tcData.savedBoxes = [...boxes]
      tcData.isDirty = false
      tcData.lastSaved = Date.now()

    } catch (error) {
      console.error('Failed to save annotations:', error)
      throw error
    }
  }

  // 从后端加载
  async function loadAnnotations(testCaseId: number): Promise<void> {
    // 先初始化空数据，确保不会有旧数据残留
    annotations.value[testCaseId] = createEmptyAnnotation()

    try {
      const data = await api.get<any>(`/api/testcase/${testCaseId}/boxes`)

      // 关键：验证返回数据时，testCaseId 仍然是被选中的（防止竞态条件）
      if (currentTestCaseId.value !== testCaseId) {
        console.log('[loadAnnotations] 数据已过期，当前测试用例已切换')
        return
      }

      // 处理 API 返回数据
      let rawData = data
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        rawData = data.boxes || data.data || []
      }

      const boxes: Box[] = Array.isArray(rawData) ? rawData.map((item: any, index: number) => {
        const normBox = item.norm_box || item.normBox || [0, 0, 10, 10]
        return {
          id: `box_${testCaseId}_${index}_${Date.now()}`,
          x: normBox[0] || 0,
          y: normBox[1] || 0,
          width: (normBox[2] || 10) - (normBox[0] || 0),
          height: (normBox[3] || 10) - (normBox[1] || 0),
          label: item.label || ''
        }
      }) : []

      // 更新已保存数据（不进入暂存模式）
      annotations.value[testCaseId].savedBoxes = boxes
      annotations.value[testCaseId].isDirty = false

    } catch (error) {
      console.error('Failed to load annotations for test case', testCaseId, ':', error)
      // 保持空的标注数据
      annotations.value[testCaseId] = createEmptyAnnotation()
    }
  }

  // 放弃暂存区修改
  function discardChanges(testCaseId?: number): void {
    const targetId = testCaseId || currentTestCaseId.value
    if (!targetId) return

    const tcData = annotations.value[targetId]
    if (!tcData) return

    // 清空暂存区
    tcData.stagingBoxes = []
    tcData.stagingHistory = []
    tcData.stagingRedoStack = []
    tcData.isStaging = false
    tcData.isDirty = false
  }

  // 保存所有未保存的修改
  async function saveAllAnnotations(): Promise<void> {
    const dirtyIds = dirtyTestCaseIds.value
    await Promise.all(dirtyIds.map(id => saveAnnotations(id)))
  }

  // 放弃所有未保存的修改
  function discardAllChanges(): void {
    const dirtyIds = dirtyTestCaseIds.value
    dirtyIds.forEach(id => discardChanges(id))
  }

  // 兼容旧 API
  function saveToCache(testCaseId: number): void {
    if (!annotations.value[testCaseId]) {
      annotations.value[testCaseId] = createEmptyAnnotation()
    }
    annotations.value[testCaseId].isDirty = true
    annotations.value[testCaseId].lastSaved = Date.now()
  }

  function loadFromCache(testCaseId: number): void {
    if (!annotations.value[testCaseId]) {
      annotations.value[testCaseId] = createEmptyAnnotation()
    }
  }

  return {
    testCases,
    currentTestCaseId,
    annotations,
    history,
    redoStack,
    isDirty,
    currentIsDirty,
    currentAnnotations,
    dirtyTestCaseIds,
    totalUnsavedCount,
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
    discardChanges,
    saveAllAnnotations,
    discardAllChanges,
    getUnsavedItems,
    saveToCache,
    loadFromCache
  }
})