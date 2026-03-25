<template>
  <aside class="sidebar glass" :class="{ collapsed }" role="navigation" :aria-label="collapsed ? '缺陷列表导航 (已折叠)' : '缺陷列表导航'">
    <div class="sidebar-header">
      <h3 id="sidebar-title">缺陷列表</h3>
      <button class="toggle-sidebar-btn" @click="collapsed = !collapsed" :aria-expanded="!collapsed" :aria-controls="'defect-nav'" :aria-label="collapsed ? '展开侧边栏' : '折叠侧边栏'">
        <span class="material-icons" aria-hidden="true">{{ collapseIcon }}</span>
      </button>
    </div>

    <div v-if="!collapsed" class="sidebar-search">
      <label for="defect-search" class="visually-hidden">搜索缺陷</label>
      <span class="material-icons" aria-hidden="true">search</span>
      <input
        id="defect-search"
        type="text"
        v-model="searchQuery"
        placeholder="搜索缺陷名称..."
        @input="handleSearch"
        aria-label="搜索缺陷名称"
      />
    </div>

    <nav v-if="!collapsed" id="defect-nav" class="defect-list" aria-labelledby="sidebar-title">
      <a
        v-for="defect in filteredDefects"
        :key="defect.id"
        href="#"
        :class="{ active: defect.id === currentDefectId }"
        @click.prevent="selectDefect(defect.id)"
        :aria-current="defect.id === currentDefectId ? 'page' : undefined"
      >
        {{ defect.name }}
      </a>
    </nav>

    <div v-if="!collapsed" class="sidebar-footer">
      <div class="sidebar-actions">
        <button class="btn btn-secondary btn-sm" title="批量导入缺陷定义" @click="uiStore.openImportDefectsModal()" aria-label="批量导入缺陷定义">
          <span class="material-icons" aria-hidden="true">upload_file</span>
        </button>
        <button class="btn btn-secondary btn-sm" title="导出全部" @click="$emit('export')" aria-label="导出全部缺陷定义">
          <span class="material-icons" aria-hidden="true">download</span>
        </button>
      </div>
      <button class="btn btn-primary full-width" @click="$emit('add')" aria-label="添加新的缺陷类别">
        + 添加新类别
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDefectStore } from '../stores/defect'
import { useUIStore } from '../stores/ui'

defineEmits(['export', 'add'])

const uiStore = useUIStore()

const defectStore = useDefectStore()
const searchQuery = ref('')
const collapsed = ref(false)

const collapseIcon = computed(() => collapsed.value ? 'chevron_right' : 'chevron_left')

onMounted(async () => {
  await defectStore.fetchDefects()
})

const filteredDefects = computed(() => {
  if (!searchQuery.value) return defectStore.defects
  const query = searchQuery.value.toLowerCase()
  return defectStore.defects.filter(d => 
    d.name.toLowerCase().includes(query)
  )
})

const currentDefectId = computed(() => defectStore.currentDefect?.id)

function selectDefect(id) {
  defectStore.selectDefect(id)
}

function handleSearch() {
  // Implement search
}
</script>

<style scoped>
.sidebar {
  width: 280px;
  min-height: calc(100vh - 64px);
  padding: 20px;
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
}

.sidebar.collapsed {
  width: 60px;
  padding: 20px 10px;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.sidebar-header h3 {
  font-size: 16px;
  color: var(--text-primary);
}

.toggle-sidebar-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
}

.sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--input-bg);
  border-radius: 10px;
  margin-bottom: 16px;
}

.sidebar-search input {
  flex: 1;
  background: none;
  border: none;
  color: var(--text-primary);
  outline: none;
}

.defect-list {
  flex: 1;
  overflow-y: auto;
}

.defect-list a {
  display: block;
  padding: 10px 12px;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s;
}

.defect-list a:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.defect-list a.active {
  background: var(--primary-color);
  color: white;
}

.sidebar-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-actions {
  display: flex;
  gap: 8px;
  width: 100%;
}

.sidebar-actions .btn {
  flex: 1;
}

.full-width {
  width: 100%;
}
</style>
