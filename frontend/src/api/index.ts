import { axiosInstance, ApiError, TimeoutError, NetworkError } from './axios'
import type { AxiosError } from 'axios'

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error
    }
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message
    }
    if (typeof axiosError.response?.data === 'string') {
      return axiosError.response.data
    }
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as Error).message
  }
  return 'Unknown error'
}

async function handleResponse<T>(response: any): Promise<T> {
  if (response && response.error) {
    throw new ApiError(response.error)
  }
  if (response && response.data !== undefined) {
    return response.data as T
  }
  return response as T
}

export const api = {
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await axiosInstance.get<any>(url, { params })
      return handleResponse<T>(response.data)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async post<T>(url: string, data?: unknown, config?: { timeout?: number; headers?: Record<string, unknown> }): Promise<T> {
    try {
      const axiosConfig: any = {}
      if (config?.timeout) axiosConfig.timeout = config.timeout
      if (config?.headers) axiosConfig.headers = config.headers
      const response = await axiosInstance.post<any>(url, data, axiosConfig)
      return handleResponse<T>(response.data)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async put<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response = await axiosInstance.put<any>(url, data)
      return handleResponse<T>(response.data)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  async delete<T>(url: string): Promise<T> {
    try {
      const response = await axiosInstance.delete<any>(url)
      return handleResponse<T>(response.data)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  },

  defects: {
    getAll: () => api.get<any[]>('/api/defects'),
    getDetail: (id: number) => api.get<any>(`/api/defect/${id}`),
    create: (data: { name: string; defect_cn: string }) =>
      api.post<any>('/api/defect', data),
    createVersion: (data: any) =>
      api.post<any>('/api/defect_version', data),
    updateVersion: (versionId: number, data: any) =>
      api.put<any>(`/api/defect_version/${versionId}`, data),
    batchImport: (importText: string) =>
      api.post<any>('/api/defects/batch_import', { import_text: importText }),
    export: (defectIds?: number[]) =>
      api.post<any>('/api/defects/export', { defect_ids: defectIds })
  },

  testcases: {
    getByDefect: (defectId: number) =>
      api.get<any>(`/api/defect/${defectId}`),
    getBoxes: (testCaseId: number) =>
      api.get<any>(`/api/testcase/${testCaseId}/boxes`),
    updateBoxes: (testCaseId: number, boxes: number[][]) =>
      api.put<any>(`/api/testcase/${testCaseId}/boxes`, { boxes }),
    delete: (testCaseId: number) => api.delete<any>(`/api/testcase/${testCaseId}`),
    batchDelete: (testCaseIds: number[]) =>
      api.post<any>('/api/testcases/batch-delete', { ids: testCaseIds }),
    batchSetType: (testCaseIds: number[], isPositive: boolean) =>
      api.post<any>('/api/testcases/batch-set-type', {
        ids: testCaseIds,
        is_positive: isPositive
      })
  },

  models: {
    getAll: () => api.get<any>('/api/models'),
    test: (apiKey: string, apiUrl: string, modelName: string) =>
      api.post<any>('/api/models/test', {
        api_key: apiKey,
        api_url: apiUrl,
        model_name: modelName
      }),
    preview: (apiKey: string, apiUrl: string) =>
      api.post<any>('/api/models/preview', {
        api_key: apiKey,
        api_url: apiUrl
      })
  },

  llm: {
    getConfig: () => api.get<any>('/api/llm_config'),
    updateConfig: (config: any) =>
      api.post<any>('/api/llm_config', config),
    checkHealth: (model?: string) =>
      api.get<any>('/api/llm_health', { model })
  },

  trueno3: {
    getConfig: () => api.get<any>('/api/trueno3_config'),
    updateConfig: (config: any) =>
      api.post<any>('/api/trueno3_config', config),
    test: (serviceHost?: string, servicePort?: number) =>
      api.post<any>('/api/trueno3_test', {
        service_host: serviceHost,
        service_port: servicePort
      }),
    testService: (serviceHost?: string, servicePort?: number) =>
      api.post<any>('/api/trueno3_service_test', {
        service_host: serviceHost,
        service_port: servicePort
      })
  },

  inference: {
    run: (defectId: number, testCaseId: number, model?: string) =>
      api.post<any>(`/api/defect/${defectId}/inference`, {
        test_case_id: testCaseId,
        model
      })
  },

  regression: {
    run: (defectId: number, versionId?: number, useRealLlm?: boolean, modelName?: string) =>
      api.post<any>('/api/regression_test', {
        defect_id: defectId,
        version_id: versionId,
        use_real_llm: useRealLlm,
        model_name: modelName
      })
  },

  autoAnnotate: {
    run: (defectId: number, testCaseIds: number[], clearExisting?: boolean) =>
      api.post<any>(`/api/auto_annotate/defect/${defectId}`, {
        test_case_ids: testCaseIds,
        clear_existing_boxes: clearExisting
      }),
    getTask: (taskId: string) =>
      api.get<any>(`/api/auto_annotate/task/${taskId}`),
    getAllTasks: () =>
      api.get<any[]>('/api/auto_annotate/tasks'),
    batchRun: (defectIds: number[], testCaseIds: number[]) =>
      api.post<any>('/api/auto_annotate/batch_defects', {
        defect_ids: defectIds,
        test_case_ids: testCaseIds
      })
  },

  config: {
    getLLM: () => api.get<any>('/api/llm_config'),
    updateLLM: (config: any) =>
      api.post<any>('/api/llm_config', config),
    getGlobalTemplate: () =>
      api.get<any>('/api/global_template'),
    updateGlobalTemplate: (templateText: string) =>
      api.post<any>('/api/global_template', { template_text: templateText }),
    getServiceStatus: () =>
      api.get<any>('/api/service_status')
  },

  tasks: {
    get: (taskId: string) =>
      api.get<any>(`/api/task/${taskId}`)
  }
}

export { ApiError, TimeoutError, NetworkError }
