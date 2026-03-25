import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface AuthState {
  token: string | null
  refreshToken: string | null
  expiresAt: number | null
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'))
  const expiresAt = ref<number | null>(
    localStorage.getItem('expires_at')
      ? parseInt(localStorage.getItem('expires_at')!, 10)
      : null
  )

  const isAuthenticated = computed(() => {
    if (!token.value) return false
    if (expiresAt.value && Date.now() >= expiresAt.value) return false
    return true
  })

  function setToken(newToken: string, newRefreshToken?: string, expiresInSeconds?: number) {
    token.value = newToken
    localStorage.setItem('auth_token', newToken)

    if (newRefreshToken) {
      refreshToken.value = newRefreshToken
      localStorage.setItem('refresh_token', newRefreshToken)
    }

    if (expiresInSeconds) {
      expiresAt.value = Date.now() + expiresInSeconds * 1000
      localStorage.setItem('expires_at', expiresAt.value.toString())
    }
  }

  function clearToken() {
    token.value = null
    refreshToken.value = null
    expiresAt.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('expires_at')
  }

  function isTokenExpired(): boolean {
    if (!expiresAt.value) return false
    return Date.now() >= expiresAt.value
  }

  function getToken(): string | null {
    return token.value
  }

  return {
    token,
    refreshToken,
    expiresAt,
    isAuthenticated,
    setToken,
    clearToken,
    isTokenExpired,
    getToken
  }
})
