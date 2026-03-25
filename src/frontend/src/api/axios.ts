import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiErrorResponse } from '../types/api'

const BASE_URL = ''

const DEFAULT_TIMEOUT = 30000

export class ApiError extends Error {
  code?: string
  status: number

  constructor(message: string, status: number = 0, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export class NetworkError extends Error {
  cause?: Error

  constructor(message: string, cause?: Error) {
    super(message)
    this.name = 'NetworkError'
    this.cause = cause
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (error?: Error) => void
}> = []

function processQueue(error: Error | null) {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
  failedQueue = []
}

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // 让 FormData 自动设置正确的 Content-Type（包含 boundary）
    if (config.data instanceof FormData) {
      config.headers.delete('Content-Type')
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

axiosInstance.interceptors.response.use(
  (response) => {
    return response
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (!originalRequest) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => {
          return axiosInstance(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          const response = await axios.post(`${BASE_URL}/api/auth/refresh`, {
            refresh_token: refreshToken
          })

          const { token, refresh_token: newRefreshToken } = response.data
          localStorage.setItem('auth_token', token)
          if (newRefreshToken) {
            localStorage.setItem('refresh_token', newRefreshToken)
          }

          processQueue(null)
          return axiosInstance(originalRequest)
        }
      } catch (refreshError) {
        processQueue(refreshError as Error)
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
        window.dispatchEvent(new CustomEvent('auth:expired'))
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    const responseData = error.response?.data as any
    const message = responseData?.error ||
      responseData?.message ||
      getHttpStatusMessage(error.response?.status)

    const apiError = new ApiError(
      message,
      error.response?.status || 0,
      responseData?.code
    )

    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('api:unauthorized', { detail: apiError }))
    } else if (error.response?.status && error.response.status >= 500) {
      window.dispatchEvent(new CustomEvent('api:server-error', { detail: apiError }))
    }

    return Promise.reject(apiError)
  }
)

function getHttpStatusMessage(status?: number): string {
  const statusMessages: Record<number, string> = {
    400: '请求参数错误',
    401: '未授权，请重新登录',
    403: '没有权限访问此资源',
    404: '请求的资源不存在',
    500: '服务器内部错误',
    502: '网关错误',
    503: '服务暂时不可用',
    504: '网关超时'
  }
  return status ? (statusMessages[status] || `HTTP ${status}`) : '网络错误'
}

export { axiosInstance }

window.addEventListener('api:unauthorized', () => {
  console.warn('API: Unauthorized - 可能需要重新登录')
})

window.addEventListener('api:server-error', (e) => {
  console.error('API: Server Error', (e as CustomEvent).detail)
})

window.addEventListener('auth:expired', () => {
  console.warn('Auth: Session expired - 请重新登录')
})
