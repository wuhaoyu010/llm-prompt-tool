export const FILTER_TYPES = {
  ALL: 'all',
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  ANNOTATED: 'annotated',
  UNANNOTATED: 'unannotated'
}

export const SORT_OPTIONS = {
  DEFAULT: 'default',
  NAME: 'name',
  TIME: 'time',
  ANNOTATIONS: 'annotations'
}

export const VIEW_MODES = {
  GRID: 'grid',
  LIST: 'list'
}

export const SAMPLE_STATUS = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative'
}

export const BATCH_OPERATIONS = {
  ANNOTATE: 'annotate',
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  DELETE: 'delete'
}

export const MESSAGE_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
}

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
}

export const API_TIMEOUT = 30000

export const REGRESSION_STATUS = {
  CORRECT: 'correct',
  WRONG: 'wrong',
  ERROR: 'error'
}

export const DEFECT_FIELDS = {
  DEFECT_CN: 'defect_cn',
  DEFECT_CLASS: 'defect_class',
  JUDGMENT_POINTS: 'judgment_points',
  EXCLUSIONS: 'exclusions'
}

export const DEFAULT_MODELS = [
  'Qwen/Qwen2.5-7B-Instruct',
  'Qwen/Qwen2.5-14B-Instruct',
  'Qwen/Qwen2.5-32B-Instruct',
  'Qwen/Qwen2.5-72B-Instruct',
  'deepseek-ai/DeepSeek-V2.5',
  'THUDM/glm-4-9b-chat'
]

export const SERVICE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  CHECKING: 'checking',
  DISABLED: 'disabled',
  UNKNOWN: 'unknown'
}
