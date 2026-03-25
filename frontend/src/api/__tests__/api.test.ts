import { describe, it, expect } from 'vitest'
import { ApiError, TimeoutError, NetworkError } from '../index'

describe('API Error Classes', () => {
  describe('ApiError', () => {
    it('should create ApiError with correct properties', () => {
      const error = new ApiError('Test error', 400, 'BAD_REQUEST')
      expect(error.message).toBe('Test error')
      expect(error.status).toBe(400)
      expect(error.code).toBe('BAD_REQUEST')
      expect(error.name).toBe('ApiError')
    })

    it('should create ApiError with default values', () => {
      const error = new ApiError('Test error')
      expect(error.message).toBe('Test error')
      expect(error.status).toBe(0)
      expect(error.code).toBeUndefined()
    })
  })

  describe('TimeoutError', () => {
    it('should create TimeoutError', () => {
      const error = new TimeoutError('Request timeout after 30s')
      expect(error.message).toBe('Request timeout after 30s')
      expect(error.name).toBe('TimeoutError')
    })
  })

  describe('NetworkError', () => {
    it('should create NetworkError with cause', () => {
      const cause = new Error('Connection refused')
      const error = new NetworkError('Network error', cause)
      expect(error.message).toBe('Network error')
      expect(error.cause).toBe(cause)
      expect(error.name).toBe('NetworkError')
    })

    it('should create NetworkError without cause', () => {
      const error = new NetworkError('Network error')
      expect(error.message).toBe('Network error')
      expect(error.name).toBe('NetworkError')
    })
  })
})
