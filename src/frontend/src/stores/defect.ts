import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'

export const useDefectStore = defineStore('defect', () => {
  const defects = ref<any[]>([])
  const currentDefect = ref<any | null>(null)
  const currentVersionId = ref<number | null>(null)
  const versions = ref<any[]>([])
  const isLoading = ref(false)

  async function fetchDefects(): Promise<void> {
    isLoading.value = true
    try {
      const response = await api.get<any>('/api/defects')
      const data = response as any
      if (Array.isArray(data)) {
        defects.value = data
      } else if (data && Array.isArray(data.defects)) {
        defects.value = data.defects
      } else if (data && Array.isArray(data.data)) {
        defects.value = data.data
      } else {
        defects.value = []
      }
    } catch (error) {
      console.error('Failed to fetch defects:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function selectDefect(defectId: number): Promise<void> {
    const defect = defects.value.find(d => d.id === defectId)
    if (!defect) return

    try {
      const detailData = await api.get<any>(`/api/defect/${defectId}`)
      const defectDetail = detailData.defect || defect
      const versionsData = detailData.versions || []
      const latestVersion = versionsData.length > 0 ? versionsData[0] : null

      currentDefect.value = {
        ...defect,
        defect_cn: latestVersion?.defect_cn || defectDetail.defect_cn || '',
        defect_class: latestVersion?.defect_class || '',
        judgment_points: latestVersion?.judgment_points || '',
        exclusions: latestVersion?.exclusions || ''
      }
    } catch (error) {
      console.error('Failed to fetch defect detail:', error)
      currentDefect.value = defect
    }

    await fetchVersions(defectId)
  }

  async function fetchVersions(defectId: number): Promise<void> {
    try {
      const data = await api.get<any>(`/api/defect/${defectId}`)
      versions.value = data.versions || []
      if (data.current_version) {
        currentVersionId.value = data.current_version.id
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error)
    }
  }

  async function saveVersion(defectId: number, versionData: any): Promise<any> {
    const result = await api.post<any>('/api/defect_version', {
      ...versionData,
      defect_id: defectId
    })
    await fetchVersions(defectId)
    return result
  }

  function setVersion(versionId: number): void {
    currentVersionId.value = versionId
  }

  function updateCurrentDefect(data: Partial<any>): void {
    if (currentDefect.value) {
      currentDefect.value = {
        ...currentDefect.value,
        ...data
      }
    }
  }

  return {
    defects,
    currentDefect,
    currentVersionId,
    versions,
    isLoading,
    fetchDefects,
    selectDefect,
    fetchVersions,
    saveVersion,
    setVersion,
    updateCurrentDefect
  }
})
