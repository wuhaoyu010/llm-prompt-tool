import { describe, it, expect } from 'vitest'
import {
  FILTER_TYPES,
  SORT_OPTIONS,
  VIEW_MODES,
  SAMPLE_STATUS,
  BATCH_OPERATIONS,
  MESSAGE_TYPES,
  HTTP_STATUS,
  API_TIMEOUT,
  REGRESSION_STATUS,
  DEFECT_FIELDS,
  DEFAULT_MODELS,
  SERVICE_STATUS
} from '../constants'

describe('Constants', () => {
  describe('FILTER_TYPES', () => {
    it('should have all required filter types', () => {
      expect(FILTER_TYPES.ALL).toBe('all')
      expect(FILTER_TYPES.POSITIVE).toBe('positive')
      expect(FILTER_TYPES.NEGATIVE).toBe('negative')
      expect(FILTER_TYPES.ANNOTATED).toBe('annotated')
      expect(FILTER_TYPES.UNANNOTATED).toBe('unannotated')
    })
  })

  describe('SORT_OPTIONS', () => {
    it('should have all required sort options', () => {
      expect(SORT_OPTIONS.DEFAULT).toBe('default')
      expect(SORT_OPTIONS.NAME).toBe('name')
      expect(SORT_OPTIONS.TIME).toBe('time')
      expect(SORT_OPTIONS.ANNOTATIONS).toBe('annotations')
    })
  })

  describe('VIEW_MODES', () => {
    it('should have grid and list modes', () => {
      expect(VIEW_MODES.GRID).toBe('grid')
      expect(VIEW_MODES.LIST).toBe('list')
    })
  })

  describe('SAMPLE_STATUS', () => {
    it('should have positive and negative status', () => {
      expect(SAMPLE_STATUS.POSITIVE).toBe('positive')
      expect(SAMPLE_STATUS.NEGATIVE).toBe('negative')
    })
  })

  describe('BATCH_OPERATIONS', () => {
    it('should have all batch operation types', () => {
      expect(BATCH_OPERATIONS.ANNOTATE).toBe('annotate')
      expect(BATCH_OPERATIONS.POSITIVE).toBe('positive')
      expect(BATCH_OPERATIONS.NEGATIVE).toBe('negative')
      expect(BATCH_OPERATIONS.DELETE).toBe('delete')
    })
  })

  describe('MESSAGE_TYPES', () => {
    it('should have all message types', () => {
      expect(MESSAGE_TYPES.SUCCESS).toBe('success')
      expect(MESSAGE_TYPES.ERROR).toBe('error')
      expect(MESSAGE_TYPES.WARNING).toBe('warning')
      expect(MESSAGE_TYPES.INFO).toBe('info')
    })
  })

  describe('HTTP_STATUS', () => {
    it('should have correct status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200)
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400)
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401)
      expect(HTTP_STATUS.FORBIDDEN).toBe(403)
      expect(HTTP_STATUS.NOT_FOUND).toBe(404)
      expect(HTTP_STATUS.SERVER_ERROR).toBe(500)
    })
  })

  describe('API_TIMEOUT', () => {
    it('should be 30000ms', () => {
      expect(API_TIMEOUT).toBe(30000)
    })
  })

  describe('REGRESSION_STATUS', () => {
    it('should have all regression statuses', () => {
      expect(REGRESSION_STATUS.CORRECT).toBe('correct')
      expect(REGRESSION_STATUS.WRONG).toBe('wrong')
      expect(REGRESSION_STATUS.ERROR).toBe('error')
    })
  })

  describe('DEFECT_FIELDS', () => {
    it('should have all defect field keys', () => {
      expect(DEFECT_FIELDS.DEFECT_CN).toBe('defect_cn')
      expect(DEFECT_FIELDS.DEFECT_CLASS).toBe('defect_class')
      expect(DEFECT_FIELDS.JUDGMENT_POINTS).toBe('judgment_points')
      expect(DEFECT_FIELDS.EXCLUSIONS).toBe('exclusions')
    })
  })

  describe('DEFAULT_MODELS', () => {
    it('should have Qwen models', () => {
      expect(DEFAULT_MODELS).toContain('Qwen/Qwen2.5-7B-Instruct')
      expect(DEFAULT_MODELS).toContain('Qwen/Qwen2.5-14B-Instruct')
      expect(DEFAULT_MODELS).toContain('Qwen/Qwen2.5-32B-Instruct')
      expect(DEFAULT_MODELS).toContain('Qwen/Qwen2.5-72B-Instruct')
    })

    it('should have DeepSeek model', () => {
      expect(DEFAULT_MODELS).toContain('deepseek-ai/DeepSeek-V2.5')
    })

    it('should have GLM model', () => {
      expect(DEFAULT_MODELS).toContain('THUDM/glm-4-9b-chat')
    })
  })

  describe('SERVICE_STATUS', () => {
    it('should have all service status values', () => {
      expect(SERVICE_STATUS.ONLINE).toBe('online')
      expect(SERVICE_STATUS.OFFLINE).toBe('offline')
      expect(SERVICE_STATUS.CHECKING).toBe('checking')
      expect(SERVICE_STATUS.DISABLED).toBe('disabled')
      expect(SERVICE_STATUS.UNKNOWN).toBe('unknown')
    })
  })
})
