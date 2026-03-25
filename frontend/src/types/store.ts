export interface Defect {
  id: number
  name: string
  defect_cn: string
  defect_class: string
  judgment_points: string
  exclusions: string
  created_at: string
  updated_at?: string
}

export interface DefectVersion {
  id: number
  defect_id: number
  version: number
  defect_cn: string
  defect_class: string
  judgment_points: string
  exclusions: string
  modifier: string
  summary: string
  created_at: string
}

export interface TestCase {
  id: number
  defect_id: number
  filename: string
  filepath: string
  preview_url: string
  is_positive: boolean
  annotation_count: number
  bounding_boxes?: unknown[]
  created_at: string
}

export interface DefectState {
  defects: Defect[]
  currentDefect: Defect | null
  currentVersionId: number | null
  versions: DefectVersion[]
  isLoading: boolean
}

export interface DefectActions {
  fetchDefects: () => Promise<void>
  selectDefect: (defectId: number) => Promise<void>
  fetchVersions: (defectId: number) => Promise<void>
  saveVersion: (defectId: number, versionData: Partial<DefectVersion>) => Promise<DefectVersion>
  setVersion: (versionId: number) => void
}

export type DefectStore = DefectState & DefectActions

export interface AnnotationState {
  testCases: TestCase[]
  currentTestCaseId: number | null
  annotations: Record<number, AnnotationData>
  history: HistoryAction[]
  redoStack: HistoryAction[]
  isDirty: boolean
}

export interface AnnotationData {
  boxes: Box[]
  history: HistoryAction[]
  isDirty: boolean
  lastSaved?: number
}

export interface Box {
  id: string
  x: number
  y: number
  width: number
  height: number
  label?: string
}

export interface HistoryAction {
  action: 'add' | 'delete' | 'update' | 'clear'
  data?: unknown
  previousData?: unknown
}

export interface AnnotationActions {
  fetchTestCases: (defectId: number) => Promise<void>
  selectTestCase: (testCaseId: number) => Promise<void>
  addBox: (box: Box) => void
  removeBox: (boxId: string) => void
  updateBox: (updatedBox: Box) => void
  clearAnnotations: () => void
  undo: () => HistoryAction | null
  redo: () => HistoryAction | null
  saveAnnotations: (testCaseId: number) => Promise<void>
  loadAnnotations: (testCaseId: number) => Promise<void>
  saveToCache: (testCaseId: number) => void
  loadFromCache: (testCaseId: number) => void
}

export type AnnotationStore = AnnotationState & AnnotationActions

export interface AuthState {
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  expiresAt: number | null
}

export interface AuthActions {
  setToken: (token: string, refreshToken?: string, expiresIn?: number) => void
  clearToken: () => void
  isTokenExpired: () => boolean
  getToken: () => string | null
}

export type AuthStore = AuthState & AuthActions

export interface UIState {
  theme: 'light' | 'dark'
  isLoading: boolean
  loadingMessage: string
  notifications: Notification[]
  showSettingsModal: boolean
  showGlobalTemplateModal: boolean
  showRegressionModal: boolean
  showRegressionTestModal: boolean
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  title?: string
  duration?: number
}

export interface ConfirmDialog {
  title: string
  message: string
  icon?: 'warning' | 'info' | 'danger'
  onConfirm: () => void
  onCancel?: () => void
}

export interface UIActions {
  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void
  showLoading: (message?: string) => void
  hideLoading: () => void
  notify: (message: string, type?: Notification['type'], title?: string, duration?: number) => void
  openSettingsModal: () => void
  closeSettingsModal: () => void
  openGlobalTemplateModal: () => void
  closeGlobalTemplateModal: () => void
  openRegressionTestModal: () => void
  closeRegressionTestModal: () => void
  showConfirm: (options: ConfirmDialog) => void
  hideConfirm: () => void
}

export type UIStore = UIState & UIActions
