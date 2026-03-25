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

export interface DefectDetail {
  defect: Defect
  versions: DefectVersion[]
  current_version?: DefectVersion
}

export interface TestCase {
  id: number
  defect_id: number
  filename: string
  filepath: string
  preview_url: string
  is_positive: boolean
  annotation_count: number
  bounding_boxes?: BoundingBox[]
  created_at: string
}

export interface BoundingBox {
  id: number
  test_case_id: number
  norm_x_min: number
  norm_y_min: number
  norm_x_max: number
  norm_y_max: number
  label?: string
  confidence?: number
}

export interface BoxData {
  norm_box: [number, number, number, number]
  label?: string
}

export interface LLMConfig {
  id: number
  api_key: string
  api_url: string
  default_model: string
  temperature: number
  max_tokens: number
}

export interface Trueno3Config {
  id: number
  enabled: boolean
  code_path: string
  ssh_host: string
  ssh_port: number
  ssh_username: string
  ssh_password: string
  service_host: string
  service_port: number
  api_path: string
  callback_host: string
  callback_port: number
}

export interface ServiceStatus {
  configured: boolean
  enabled?: boolean
  status: 'online' | 'offline' | 'disabled' | 'checking' | 'unknown'
  message: string
  details?: string
  service_host?: string
  service_port?: number
}

export interface ServiceStatusResponse {
  llm: ServiceStatus
  trueno3: ServiceStatus
}

export interface InferenceResult {
  status: 'Y' | 'N' | 'U' | 'E'
  reason?: string
  message?: string
}

export interface RegressionTestResult {
  test_case_id: number
  filename: string
  is_positive: boolean
  expected: 'Y' | 'N'
  predicted: 'Y' | 'N' | 'U' | 'E'
  result: 'correct' | 'wrong' | 'error'
  results?: InferenceResult[]
}

export interface RegressionSummary {
  total_cases: number
  correct_predictions: number
  accuracy: number
  positive_count: number
  negative_count: number
  positive_accuracy: number
  negative_accuracy: number
  tp: number
  tn: number
  fp: number
  fn: number
}

export interface RegressionReport {
  summary: RegressionSummary
  details: RegressionTestResult[]
}

export interface ModelInfo {
  id: string
  owned_by: string
  object?: string
}

export interface ModelsResponse {
  models: ModelInfo[]
  default_model?: string
  error?: string
}

export interface BatchOperationRequest {
  test_case_ids: number[]
  clear_existing_boxes?: boolean
}

export interface BatchOperationResponse {
  success: boolean
  processed: number
  failed: number
  results?: Array<{
    test_case_id: number
    success: boolean
    error?: string
  }>
}

export interface AutoAnnotateTask {
  task_id: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'ERROR'
  result?: any
  error?: string
}

export interface ApiErrorResponse {
  error: string
  code?: string
  details?: string
}
