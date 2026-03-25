<template>
  <div class="app-container">
    <!-- 无障碍：跳转到主内容 -->
    <a href="#main-content" class="skip-link">跳转到主内容</a>
    <TopNav />
    <div class="main-container">
      <Sidebar @import="handleImport" @export="handleExport" @add="handleAddDefect" />
      <main id="main-content" class="main-content" role="main">
        <router-view />
      </main>
    </div>
    <Notification />
    <Loading />
    <BatchImportModal />
    <ImportDefectsModal />
    <ConfirmDialog />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import TopNav from './components/TopNav.vue'
import Sidebar from './components/Sidebar.vue'
import Notification from './components/Notification.vue'
import Loading from './components/Loading.vue'
import BatchImportModal from './components/BatchImportModal.vue'
import ImportDefectsModal from './components/ImportDefectsModal.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useUIStore } from './stores/ui'
import { useDefectStore } from './stores/defect'
import { api } from './api'

const theme = ref('dark')
const uiStore = useUIStore()
const defectStore = useDefectStore()

// 监听主题变化并应用到html元素
watch(theme, (newTheme) => {
  document.documentElement.setAttribute('data-theme', newTheme)
})

onMounted(() => {
  theme.value = localStorage.getItem('theme') || 'dark'
  // 初始化时设置主题
  document.documentElement.setAttribute('data-theme', theme.value)
})

function handleImport() {
  uiStore.openBatchImportModal()
}

async function handleExport() {
  try {
    const result = await api.post('/api/defects/export', { defect_ids: [] })

    if (result.success) {
      // 下载文件
      const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', result.filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      uiStore.notify(`已导出 ${result.count} 条缺陷定义`, 'success', '导出成功')
    } else {
      uiStore.notify('导出失败: ' + (result.error || '未知错误'), 'error', '错误')
    }
  } catch (error) {
    uiStore.notify('导出失败: ' + error.message, 'error', '错误')
  }
}

async function handleAddDefect() {
  const name = prompt('请输入新缺陷类别名称:')
  if (!name || !name.trim()) return

  const defect_cn = prompt('请输入缺陷中文名称:')
  if (!defect_cn || !defect_cn.trim()) {
    uiStore.notify('中文名称不能为空', 'error', '错误')
    return
  }

  try {
    await api.post('/api/defect', {
      name: name.trim(),
      defect_cn: defect_cn.trim()
    })
    await defectStore.fetchDefects()
    uiStore.notify('新类别添加成功', 'success', '成功')
  } catch (error) {
    uiStore.notify('添加失败: ' + error.message, 'error', '错误')
  }
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
}

.main-container {
  display: flex;
  padding-top: 64px;
  min-height: calc(100vh - 64px);
}
</style>
