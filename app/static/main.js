
document.addEventListener('DOMContentLoaded', () => {
    // --- 全局状态管理 ---
    const state = {
        currentDefectId: null,
        currentVersionId: null,
        currentTestCaseId: null,
        currentImage: {
            file: null,
            element: null,
            originalWidth: 0,
            originalHeight: 0,
            scaleFactor: 1,
        },
        defectVersions: [],
        testCases: [],
        fabricCanvas: null,
        isDrawingMode: false,
        history: [],
        pollingInterval: null,
        galleryPage: 1,
        galleryPageSize: 6,
        NORM_MAX: 999,
        isLoading: false,  // 全局 loading 状态
        hasUnsavedChanges: false,  // 编辑器是否有未保存的修改
        defects: [],  // 所有缺陷列表
        batchSelectedIds: [],  // 批量选中的测试用例ID
        batchImportFiles: [],  // 批量导入的文件列表
        boxLabels: {},  // 标注框标签 { boxId: label }
    };
    
    // --- Loading 管理 ---
    const Loading = {
        show(message = '加载中...') {
            state.isLoading = true;
            let overlay = document.getElementById('loading-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'loading-overlay';
                overlay.innerHTML = `
                    <div class="loading-content">
                        <div class="loading-spinner"></div>
                        <div class="loading-message">${message}</div>
                    </div>
                `;
                document.body.appendChild(overlay);
            }
            overlay.querySelector('.loading-message').textContent = message;
            overlay.style.display = 'flex';
        },
        
        hide() {
            state.isLoading = false;
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        },
        
        async wrap(promise, message = '加载中...') {
            this.show(message);
            try {
                return await promise;
            } finally {
                this.hide();
            }
        }
    };

    // --- 玻璃拟态通知系统 ---
    const Notification = {
        container: null,
        
        init() {
            this.container = document.getElementById('notification-container');
        },
        
        show(message, type = 'info', title = '', duration = 3000) {
            if (!this.container) this.init();
            
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };
            
            const titles = {
                success: '成功',
                error: '错误',
                warning: '警告',
                info: '提示'
            };
            
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <div class="notification-content">
                    <span class="notification-icon">${icons[type]}</span>
                    <div class="notification-body">
                        <div class="notification-title">${title || titles[type]}</div>
                        <div class="notification-message">${message}</div>
                    </div>
                    <button class="notification-close">×</button>
                </div>
                <div class="notification-progress"></div>
            `;
            
            this.container.appendChild(notification);
            
            // 动画进入
            requestAnimationFrame(() => {
                notification.classList.add('show');
            });
            
            // 进度条动画
            const progress = notification.querySelector('.notification-progress');
            progress.style.width = '100%';
            progress.style.transition = `width ${duration}ms linear`;
            requestAnimationFrame(() => {
                progress.style.width = '0%';
            });
            
            // 关闭按钮
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.onclick = () => this.close(notification);
            
            // 自动关闭
            const timer = setTimeout(() => {
                this.close(notification);
            }, duration);
            
            // 鼠标悬停时暂停
            notification.addEventListener('mouseenter', () => {
                clearTimeout(timer);
                progress.style.transition = 'none';
            });
            
            notification.addEventListener('mouseleave', () => {
                progress.style.transition = `width 1000ms linear`;
                progress.style.width = '0%';
                setTimeout(() => this.close(notification), 1000);
            });
            
            return notification;
        },
        
        close(notification) {
            notification.classList.remove('show');
            notification.classList.add('hide');
            setTimeout(() => {
                notification.remove();
            }, 400);
        },
        
        success(message, title, duration) {
            return this.show(message, 'success', title, duration);
        },
        
        error(message, title, duration) {
            return this.show(message, 'error', title, duration);
        },
        
        warning(message, title, duration) {
            return this.show(message, 'warning', title, duration);
        },
        
        info(message, title, duration) {
            return this.show(message, 'info', title, duration);
        }
    };

    // --- DOM 元素缓存 ---
    const dom = {
        defectList: document.getElementById('defect-list'),
        defectSearch: document.getElementById('defect-search'),
        defectTitle: document.getElementById('defect-title'),
        defectVersionTag: document.getElementById('defect-version-tag'),
        versionDropdown: document.getElementById('version-dropdown'),
        publishVersionBtn: document.getElementById('publish-version-btn'),
        editorGrid: document.getElementById('defect-editor-grid'),
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        runInferenceBtn: document.getElementById('run-inference-btn'),
        saveVersionBtn: document.getElementById('save-version-btn'),
        modelSelector: document.getElementById('model-selector'),
        
        canvasWrapper: document.getElementById('canvas-wrapper'),
        annotationCanvas: document.getElementById('annotation-canvas'),
        uploadPlaceholder: document.getElementById('upload-placeholder'),
        imageUploadInput: document.getElementById('image-upload-input'),
        
        testCaseList: document.getElementById('test-case-list'),
        drawBoxBtn: document.getElementById('draw-box-btn'),
        undoBtn: document.getElementById('undo-btn'),
        addTestCaseBtn: document.getElementById('add-test-case-btn'),
        updateAnnotationBtn: document.getElementById('update-annotation-btn'),
        clearCanvasBtn: document.getElementById('clear-canvas-btn'),

        tabs: document.querySelectorAll('.tab-link'),
        tabContents: document.querySelectorAll('.tab-content'),
        comparisonContainer: document.getElementById('comparison-container'),
        historyTableBody: document.querySelector('#history-table tbody'),
        
        modalBackdrop: document.getElementById('modal-backdrop'),
        globalTemplateModal: document.getElementById('global-template-modal'),
        addDefectModal: document.getElementById('add-defect-modal'),
        importDefectsModal: document.getElementById('import-defects-modal'),
        settingsModal: document.getElementById('settings-modal'),

        addDefectBtn: document.getElementById('add-defect-btn'),
        importDefectsBtn: document.getElementById('import-defects-btn'),
        exportDefectsBtn: document.getElementById('export-defects-btn'),
        editGlobalTemplateBtn: document.getElementById('edit-global-template-btn'),
        runRegressionBtn: document.getElementById('run-regression-btn'),
        runComparisonBtn: document.getElementById('run-comparison-btn'),
        themeToggle: document.getElementById('theme-toggle'),
        settingsBtn: document.getElementById('settings-btn'),
        sidebar: document.getElementById('sidebar'),
        toggleSidebarBtn: document.getElementById('toggle-sidebar-btn'),

        // 新的缩略图容器
        thumbnailContainer: document.getElementById('thumbnail-container'),
        thumbnailScrollWrapper: document.getElementById('thumbnail-scroll-wrapper'),

        // 批量操作相关
        batchImportBtn: document.getElementById('batch-import-btn'),
        batchImportModal: document.getElementById('batch-import-modal'),
        selectAllThumbnails: document.getElementById('select-all-thumbnails'),
        batchActions: document.getElementById('batch-actions'),
        batchDeleteBtn: document.getElementById('batch-delete-btn'),
        batchSetPositiveBtn: document.getElementById('batch-set-positive-btn'),
        batchSetNegativeBtn: document.getElementById('batch-set-negative-btn'),
        shortcutToggle: document.getElementById('shortcut-toggle'),
        shortcutsPanel: document.getElementById('shortcuts-panel'),
        boxLabelEditor: document.getElementById('box-label-editor'),
        boxLabelInput: document.getElementById('box-label-input'),
        boxLabelSave: document.getElementById('box-label-save'),
    };

    // --- API 封装（带错误处理）---
    const api = {
        async get(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                Notification.error(`请求失败: ${error.message}`, '网络错误');
                throw error;
            }
        },
        
        async post(url, data) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                Notification.error(`请求失败: ${error.message}`, '网络错误');
                throw error;
            }
        },
        
        async upload(url, formData) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    body: formData,
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                Notification.error(`上传失败: ${error.message}`, '网络错误');
                throw error;
            }
        },
        
        async delete(url) {
            try {
                const response = await fetch(url, { method: 'DELETE' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                Notification.error(`删除失败: ${error.message}`, '网络错误');
                throw error;
            }
        },
        
        async put(url, data) {
            try {
                const response = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                Notification.error(`更新失败: ${error.message}`, '网络错误');
                throw error;
            }
        },
    };

    // --- App 主逻辑 ---
    const App = {
        init() {
            this.initTheme();
            this.initCanvas();
            this.bindEventListeners();
            this.loadDefects();
            this.loadModels();
            this.checkLLMHealth();
            // 每30秒检查一次健康状态
            setInterval(() => this.checkLLMHealth(), 30000);
        },

        // --- 主题切换 ---
        initTheme() {
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.body.setAttribute('data-theme', savedTheme);
            this.updateThemeIcon(savedTheme);
        },

        toggleTheme() {
            const currentTheme = document.body.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            this.updateThemeIcon(newTheme);
        },

        toggleSidebar() {
            if (dom.sidebar) {
                dom.sidebar.classList.toggle('collapsed');
            }
        },

        updateThemeIcon(theme) {
            if (dom.themeToggle) {
                dom.themeToggle.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
            }
        },

        showInitialState() {
            dom.defectTitle.textContent = '请选择一个缺陷类别';
            dom.defectVersionTag.textContent = '';
            dom.editorGrid.innerHTML = '<p class="placeholder-text">从左侧选择一个缺陷类别以开始。</p>';
            if (dom.testCaseList) dom.testCaseList.innerHTML = '';
            dom.versionDropdown.innerHTML = '';
            dom.comparisonContainer.innerHTML = '';
            dom.historyTableBody.innerHTML = '<tr><td colspan="4">选择一个缺陷类别以查看历史记录。</td></tr>';
            this.clearCanvas();
        },

        // --- 核心渲染方法 ---
        async loadDefects() {
            const defects = await api.get('/api/defects');
            state.defects = defects;  // 保存到状态
            dom.defectList.innerHTML = defects.map(d =>
                `<a href="#" data-id="${d.id}">${d.name}</a>`
            ).join('');
            this.showInitialState();
        },

        async loadModels() {
            try {
                const result = await api.get('/api/models');
                const models = result.models || [];

                dom.modelSelector.innerHTML = '';

                if (models.length === 0) {
                    dom.modelSelector.innerHTML = '<option value="">无可用模型</option>';
                    return;
                }

                // 获取默认模型
                const defaultModel = result.default_model || models[0].id;

                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name || model.id;
                    dom.modelSelector.appendChild(option);
                });

                // 设置默认选中
                dom.modelSelector.value = defaultModel;
            } catch (error) {
                console.error('加载模型列表失败:', error);
                dom.modelSelector.innerHTML = '<option value="">加载失败</option>';
            }
        },

        async checkLLMHealth() {
            const indicator = document.getElementById('llm-status-indicator');
            if (!indicator) return;

            const statusDot = indicator.querySelector('.status-dot');
            const statusText = indicator.querySelector('.status-text');

            // 设置检查中状态
            indicator.className = 'llm-status-indicator checking';
            statusText.textContent = '检查中...';

            try {
                const result = await fetch('/api/llm_health').then(r => r.json());

                if (result.status === 'online') {
                    indicator.className = 'llm-status-indicator online';
                    statusText.textContent = result.message;
                    indicator.title = result.details;
                } else {
                    indicator.className = 'llm-status-indicator offline';
                    statusText.textContent = result.message;
                    indicator.title = result.details;
                }
            } catch (error) {
                indicator.className = 'llm-status-indicator offline';
                statusText.textContent = '检查失败';
                indicator.title = error.message;
            }
        },

        renderHistoryTable() {
            dom.historyTableBody.innerHTML = state.defectVersions.map(v => `
                <tr>
                    <td>${v.version}</td>
                    <td>${v.modifier}</td>
                    <td>${v.summary}</td>
                    <td>${new Date(v.created_at).toLocaleString()}</td>
                </tr>
            `).join('') || '<tr><td colspan="4">没有历史记录</td></tr>';
        },

        async selectDefect(defectId, force = false) {
            if (state.currentDefectId === defectId) return;

            // 检查是否有未保存的修改
            if (state.hasUnsavedChanges && !force) {
                if (!confirm('当前有未保存的修改，切换后将丢失。确定要切换吗？')) {
                    return;
                }
            }

            state.currentDefectId = defectId;
            state.hasUnsavedChanges = false;  // 重置状态

            document.querySelectorAll('#defect-list a').forEach(a => {
                a.classList.toggle('active', a.dataset.id == defectId);
            });

            const data = await api.get(`/api/defect/${defectId}`);
            state.defectVersions = data.versions;
            state.testCases = data.test_cases;

            dom.defectTitle.textContent = data.versions[0]?.defect_cn || data.defect.name;
            this.renderVersionDropdown();
            this.renderTestCases();
            this.selectVersion(data.versions[0]?.id);
            this.renderHistoryTable();
            this.clearCanvas(); // 切换缺陷时，清空画布
        },

        selectVersion(versionId, force = false) {
            if (!versionId) {
                this.clearEditor();
                return;
            }

            // 检查是否有未保存的修改
            if (state.hasUnsavedChanges && !force) {
                if (!confirm('当前有未保存的修改，切换后将丢失。确定要切换吗？')) {
                    dom.versionDropdown.value = state.currentVersionId;
                    return;
                }
            }

            state.currentVersionId = versionId;
            state.hasUnsavedChanges = false;  // 重置状态
            state.galleryPage = 1; // 重置分页
            dom.versionDropdown.value = versionId;
            const version = state.defectVersions.find(v => v.id == versionId);
            if (version) {
                this.renderDefectVersion(version);
                dom.defectVersionTag.textContent = `v${version.version}`;
                this.bindEditorChangeListeners();  // 绑定编辑器变化监听
            }
        },

        bindEditorChangeListeners() {
            const fields = ['defect_cn', 'defect_class', 'judgment_points', 'exclusions'];
            fields.forEach(field => {
                const textarea = document.getElementById(`editor-${field}`);
                if (textarea) {
                    textarea.addEventListener('input', () => {
                        state.hasUnsavedChanges = true;
                    });
                }
            });
        },

        // 搜索过滤缺陷列表
        filterDefects(keyword) {
            const searchLower = keyword.toLowerCase().trim();
            const items = dom.defectList.querySelectorAll('a');

            items.forEach(item => {
                const name = item.textContent.toLowerCase();
                if (searchLower === '' || name.includes(searchLower)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        },

        renderDefectVersion(version) {
            const fields = [
                { key: 'defect_cn', title: '中文名称' },
                { key: 'defect_class', title: '缺陷分类' },
                { key: 'judgment_points', title: '判断点' },
                { key: 'exclusions', title: '排除项' },
            ];
            dom.editorGrid.innerHTML = fields.map(field => `
                <div class="editor-card">
                    <h4>${field.title}</h4>
                    <textarea id="editor-${field.key}" rows="4">${version[field.key] || ''}</textarea>
                </div>
            `).join('');
        },

        clearEditor() {
            dom.editorGrid.innerHTML = '<p>此缺陷尚无版本信息。</p>';
            dom.defectVersionTag.textContent = '';
        },

        renderVersionDropdown() {
            dom.versionDropdown.innerHTML = state.defectVersions.map(v => 
                `<option value="${v.id}">版本 ${v.version} (${v.modifier} @ ${new Date(v.created_at).toLocaleDateString()})</option>`
            ).join('');
        },

        renderTestCases() {
            // 更新统计信息
            this.updateAnnotationStats();

            // 渲染新的缩略图条
            if (dom.thumbnailContainer) {
                dom.thumbnailContainer.innerHTML = state.testCases.map((tc, index) => `
                    <div class="thumbnail-item ${tc.is_positive === false ? 'negative-sample' : 'positive-sample'} ${tc.id == state.currentTestCaseId ? 'selected' : ''} ${state.batchSelectedIds.includes(tc.id) ? 'batch-selected' : ''}"
                         data-id="${tc.id}"
                         data-index="${index}"
                         title="${tc.filename}">
                        <div class="checkbox-overlay" data-id="${tc.id}"></div>
                        <img src="/${tc.preview_url}" alt="Test Case ${tc.id}">
                        <span class="sample-badge ${tc.is_positive === false ? 'negative' : 'positive'}">${tc.is_positive === false ? '✗ 反例' : '✓ 正例'}</span>
                        <button class="delete-test-case-btn" data-id="${tc.id}" title="删除此测试用例">&times;</button>
                    </div>
                `).join('');

                // 滚动到选中的缩略图
                const selectedThumb = dom.thumbnailContainer.querySelector('.thumbnail-item.selected');
                if (selectedThumb) {
                    selectedThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            }

            // 兼容旧的 testCaseList
            if (dom.testCaseList) {
                dom.testCaseList.innerHTML = state.testCases.map(tc => `
                    <div class="test-case-item ${tc.is_positive === false ? 'negative-sample' : 'positive-sample'}">
                        <img src="/${tc.preview_url}" data-id="${tc.id}" alt="Test Case ${tc.id}" title="${tc.filename}">
                        <span class="sample-badge ${tc.is_positive === false ? 'negative' : 'positive'}">${tc.is_positive === false ? '✗ 反例' : '✓ 正例'}</span>
                        <button class="delete-test-case-btn" data-id="${tc.id}" title="删除此测试用例">&times;</button>
                    </div>
                `).join('');
            }

            // 更新全选状态
            this.updateSelectAllState();
        },

        // 更新标注统计信息
        updateAnnotationStats() {
            const total = state.testCases.length;
            const positive = state.testCases.filter(tc => tc.is_positive !== false).length;
            const negative = state.testCases.filter(tc => tc.is_positive === false).length;

            document.getElementById('stat-total').textContent = total;
            document.getElementById('stat-positive').textContent = positive;
            document.getElementById('stat-negative').textContent = negative;
        },

        // 更新全选状态
        updateSelectAllState() {
            if (dom.selectAllThumbnails) {
                const allSelected = state.testCases.length > 0 &&
                    state.testCases.every(tc => state.batchSelectedIds.includes(tc.id));
                dom.selectAllThumbnails.checked = allSelected;
            }
            // 显示/隐藏批量操作按钮
            if (dom.batchActions) {
                dom.batchActions.style.display = state.batchSelectedIds.length > 0 ? 'flex' : 'none';
            }
        },

        // 切换缩略图选择
        toggleThumbnailSelection(testCaseId, ctrlKey = false) {
            const index = state.batchSelectedIds.indexOf(testCaseId);
            if (index > -1) {
                state.batchSelectedIds.splice(index, 1);
            } else {
                if (!ctrlKey) {
                    // 如果没有按Ctrl，清空其他选择
                    state.batchSelectedIds = [];
                }
                state.batchSelectedIds.push(testCaseId);
            }
            this.renderTestCases();
        },

        // 全选/取消全选
        toggleSelectAll() {
            if (state.batchSelectedIds.length === state.testCases.length) {
                state.batchSelectedIds = [];
            } else {
                state.batchSelectedIds = state.testCases.map(tc => tc.id);
            }
            this.renderTestCases();
        },
        
        // 切换到指定索引的测试用例
        navigateToTestCase(index) {
            if (state.testCases.length === 0) return;
            
            // 循环导航
            if (index < 0) index = state.testCases.length - 1;
            if (index >= state.testCases.length) index = 0;
            
            const tc = state.testCases[index];
            if (tc) {
                this.loadTestCase(tc.id);
            }
        },
        
        // 上一张
        prevTestCase() {
            const currentIndex = state.testCases.findIndex(tc => tc.id == state.currentTestCaseId);
            this.navigateToTestCase(currentIndex - 1);
        },
        
        // 下一张
        nextTestCase() {
            const currentIndex = state.testCases.findIndex(tc => tc.id == state.currentTestCaseId);
            this.navigateToTestCase(currentIndex + 1);
        },

        async loadTestCase(testCaseId) {
            if (state.currentTestCaseId === testCaseId) return;
            state.currentTestCaseId = testCaseId;
            state.currentImage.file = null;

            // 更新旧的选择器
            document.querySelectorAll('.test-case-item img').forEach(img => {
                img.classList.toggle('selected', img.dataset.id == testCaseId);
            });
            
            // 更新新的缩略图选中状态
            document.querySelectorAll('.thumbnail-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.id == testCaseId);
                if (item.dataset.id == testCaseId) {
                    item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            });
            
            const testCase = state.testCases.find(tc => tc.id == testCaseId);
            if (testCase) {
                await this.loadImageOnCanvas(`/${testCase.filepath}`);
                // loadImageOnCanvas 是 Promise，await 后图片已加载完成，直接渲染标注框
                this.renderBoxesOnCanvas(testCaseId);
            }
        },
        
        // 渲染标注框到画布
        async renderBoxesOnCanvas(testCaseId) {
            if (!state.fabricCanvas) return;
            
            state.fabricCanvas.remove(...state.fabricCanvas.getObjects('rect'));
            
            const boxes = await api.get(`/api/testcase/${testCaseId}/boxes`);
            const bgImage = state.fabricCanvas.backgroundImage;
            
            if (!bgImage || !boxes || boxes.length === 0) return;
            
            const imgLeft = bgImage.left;
            const imgTop = bgImage.top;
            const imgWidth = bgImage.getScaledWidth();
            const imgHeight = bgImage.getScaledHeight();
            
            boxes.forEach(box => {
                const normBox = box.norm_box || [box.norm_x_min, box.norm_y_min, box.norm_x_max, box.norm_y_max];
                const [xMin, yMin, xMax, yMax] = normBox;
                
                const ratioX = xMin / state.NORM_MAX;
                const ratioY = yMin / state.NORM_MAX;
                const ratioW = (xMax - xMin) / state.NORM_MAX;
                const ratioH = (yMax - yMin) / state.NORM_MAX;
                
                const rect = new fabric.Rect({
                    left: imgLeft + ratioX * imgWidth,
                    top: imgTop + ratioY * imgHeight,
                    width: ratioW * imgWidth,
                    height: ratioH * imgHeight,
                    fill: 'rgba(255, 0, 0, 0.2)',
                    stroke: 'red',
                    strokeWidth: 2,
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                });
                state.fabricCanvas.add(rect);
            });
            
            state.fabricCanvas.renderAll();
        },

        // --- 画布与标注 ---
        initCanvas() {
            const canvasEl = dom.annotationCanvas;
            const wrapper = dom.canvasWrapper;
            
            const setCanvasSize = () => {
                canvasEl.width = wrapper.clientWidth;
                canvasEl.height = wrapper.clientHeight;
                if (state.fabricCanvas) {
                    state.fabricCanvas.setWidth(wrapper.clientWidth);
                    state.fabricCanvas.setHeight(wrapper.clientHeight);
                    state.fabricCanvas.renderAll();
                }
            };

            state.fabricCanvas = new fabric.Canvas(canvasEl, {
                backgroundColor: 'transparent',
            });

            setCanvasSize();
            window.addEventListener('resize', setCanvasSize);
            
            // 矩形绘制模式变量
            let isDrawingRect = false;
            let rectStartPoint = null;
            let tempRect = null;
            
            // 鼠标按下 - 开始绘制
            state.fabricCanvas.on('mouse:down', (e) => {
                if (!state.isDrawingMode || !state.currentImage.element) return;
                
                isDrawingRect = true;
                const pointer = state.fabricCanvas.getPointer(e.e);
                rectStartPoint = pointer;
                
                // 创建临时矩形（实时预览）
                tempRect = new fabric.Rect({
                    left: pointer.x,
                    top: pointer.y,
                    width: 0,
                    height: 0,
                    fill: 'rgba(66, 133, 244, 0.2)',
                    stroke: '#4285F4',
                    strokeWidth: 2,
                    selectable: false,
                    evented: false,
                });
                state.fabricCanvas.add(tempRect);
            });
            
            // 鼠标移动 - 实时更新矩形大小
            state.fabricCanvas.on('mouse:move', (e) => {
                if (!isDrawingRect || !tempRect) return;
                
                const pointer = state.fabricCanvas.getPointer(e.e);
                const width = Math.abs(pointer.x - rectStartPoint.x);
                const height = Math.abs(pointer.y - rectStartPoint.y);
                const left = Math.min(pointer.x, rectStartPoint.x);
                const top = Math.min(pointer.y, rectStartPoint.y);
                
                tempRect.set({
                    left: left,
                    top: top,
                    width: width,
                    height: height,
                });
                state.fabricCanvas.renderAll();
            });
            
            // 鼠标释放 - 完成绘制
            state.fabricCanvas.on('mouse:up', async (e) => {
                if (!isDrawingRect || !tempRect) return;

                isDrawingRect = false;

                // 检查矩形大小，太小的不保存
                if (tempRect.width < 10 || tempRect.height < 10) {
                    state.fabricCanvas.remove(tempRect);
                    tempRect = null;
                    return;
                }

                // 将临时矩形转换为正式的标注框
                const finalRect = new fabric.Rect({
                    left: tempRect.left,
                    top: tempRect.top,
                    width: tempRect.width,
                    height: tempRect.height,
                    fill: 'rgba(234, 67, 53, 0.2)',
                    stroke: '#ea4335',
                    strokeWidth: 2,
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                });

                state.fabricCanvas.remove(tempRect);
                state.fabricCanvas.add(finalRect);
                tempRect = null;

                // 显示成功提示
                Notification.success('标注框已添加', '标注成功', 2000);

                // 自动保存标注到当前测试用例
                if (state.currentTestCaseId) {
                    await this.autoSaveAnnotation();
                }
            });
            
            // 双击删除标注框
            state.fabricCanvas.on('mouse:dblclick', async (e) => {
                const target = e.target;
                if (target && target.type === 'rect') {
                    state.fabricCanvas.remove(target);
                    Notification.success('标注框已删除', '删除成功', 2000);

                    // 自动保存标注到当前测试用例
                    if (state.currentTestCaseId) {
                        await this.autoSaveAnnotation();
                    }
                }
            });
            
            // 选中时的样式
            state.fabricCanvas.on('selection:created', (e) => {
                const target = e.selected[0];
                if (target && target.type === 'rect') {
                    target.set({
                        stroke: '#fbbc05',
                        strokeWidth: 3,
                    });
                    state.fabricCanvas.renderAll();
                }
            });
            
            // 取消选中时恢复样式
            state.fabricCanvas.on('selection:cleared', (e) => {
                const target = e.deselected[0];
                if (target && target.type === 'rect') {
                    target.set({
                        stroke: '#ea4335',
                        strokeWidth: 2,
                    });
                    state.fabricCanvas.renderAll();
                }
            });
            
            // 标注框被修改时显示更新按钮
            state.fabricCanvas.on('object:modified', (e) => {
                if (state.currentTestCaseId && dom.updateAnnotationBtn) {
                    dom.updateAnnotationBtn.style.display = 'block';
                }
            });
        },

        async loadImageOnCanvas(src) {
            return new Promise((resolve) => {
                fabric.Image.fromURL(src, (img) => {
                    const canvas = state.fabricCanvas;
                    const wrapper = dom.canvasWrapper;
                    
                    const scale = Math.min(wrapper.clientWidth / img.width, wrapper.clientHeight / img.height);
                    img.scale(scale);
                    
                    img.set({
                        left: (wrapper.clientWidth - img.width * scale) / 2,
                        top: (wrapper.clientHeight - img.height * scale) / 2,
                        selectable: false,
                        evented: false,
                    });

                    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
                    dom.uploadPlaceholder.style.display = 'none';
                    wrapper.classList.add('has-image');

                    state.currentImage.element = img;
                    state.currentImage.originalWidth = img.width;
                    state.currentImage.originalHeight = img.height;
                    state.currentImage.scaleFactor = scale;
                    resolve();
                });
            });
        },

        clearCanvas() {
            const hasContent = state.fabricCanvas.getObjects().length > 0 || state.currentImage.file;
            if (hasContent && !confirm('确定要清空画布吗？未保存的标注将丢失。')) return;
            
            state.fabricCanvas.clear();
            state.fabricCanvas.setBackgroundImage(null, state.fabricCanvas.renderAll.bind(state.fabricCanvas));

            dom.uploadPlaceholder.style.display = 'flex';
            dom.canvasWrapper.classList.remove('has-image');

            state.currentImage.file = null;
            state.currentImage.element = null;
            state.currentTestCaseId = null;

            document.querySelectorAll('.test-case-item img').forEach(img => {
                img.classList.remove('selected');
            });
            
            document.querySelectorAll('.thumbnail-item').forEach(item => {
                item.classList.remove('selected');
            });
        },

        startDrawingMode() {
            if (!state.currentImage.element) {
                Notification.warning('请先上传一张图片！', '提示');
                return;
            }
            state.isDrawingMode = true;
            // 禁用画布上所有对象的选择，避免干扰绘制
            state.fabricCanvas.selection = false;
            state.fabricCanvas.forEachObject((obj) => {
                obj.selectable = false;
                obj.evented = false;
            });
            // 改变鼠标样式
            dom.canvasWrapper.style.cursor = 'crosshair';
            dom.drawBoxBtn.classList.add('active');
            Notification.info('按住鼠标左键拖拽绘制矩形框', '绘制模式', 3000);
        },

        stopDrawingMode() {
            state.isDrawingMode = false;
            // 恢复画布上所有对象的选择
            state.fabricCanvas.selection = true;
            state.fabricCanvas.forEachObject((obj) => {
                obj.selectable = true;
                obj.evented = true;
            });
            // 恢复鼠标样式
            dom.canvasWrapper.style.cursor = 'default';
            dom.drawBoxBtn.classList.remove('active');
        },
        
        undoLastBox() {
            const objects = state.fabricCanvas.getObjects('rect');
            if (objects.length > 0) {
                state.fabricCanvas.remove(objects[objects.length - 1]);
            }
        },

        getNormalizedBoxes() {
            const boxes = [];
            const img = state.currentImage.element;
            if (!img) return boxes;

            const imgLeft = img.left;
            const imgTop = img.top;
            const imgWidth = img.width * img.scaleX;
            const imgHeight = img.height * img.scaleY;

            state.fabricCanvas.getObjects('rect').forEach(rect => {
                const x_min = (rect.left - imgLeft) / imgWidth * 1000;
                const y_min = (rect.top - imgTop) / imgHeight * 1000;
                const x_max = (rect.left + rect.width - imgLeft) / imgWidth * 1000;
                const y_max = (rect.top + rect.height - imgTop) / imgHeight * 1000;
                boxes.push([
                    Math.max(0, Math.round(x_min)),
                    Math.max(0, Math.round(y_min)),
                    Math.min(999, Math.round(x_max)),
                    Math.min(999, Math.round(y_max)),
                ]);
            });
            return boxes;
        },

        // --- 事件绑定 ---
        bindEventListeners() {
            // 键盘快捷键
            document.addEventListener('keydown', (e) => {
                // Ctrl/Cmd + S: 保存当前版本
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    if (state.currentVersionId) this.saveCurrentVersion();
                }
                // Ctrl/Cmd + D: 画框模式
                if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                    e.preventDefault();
                    if (state.isDrawingMode) this.stopDrawingMode();
                    else this.startDrawingMode();
                }
                // Ctrl/Cmd + Z: 撤销
                if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                    e.preventDefault();
                    this.undoLastBox();
                }
                // Delete: 删除选中框
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    const activeObject = state.fabricCanvas.getActiveObject();
                    if (activeObject && activeObject.type === 'rect') {
                        state.fabricCanvas.remove(activeObject);
                        Notification.success('标注框已删除', '删除成功', 2000);
                    }
                }
                // ESC: 关闭模态框或退出绘制模式
                if (e.key === 'Escape') {
                    // 优先关闭模态框
                    if (dom.modalBackdrop.style.display === 'block') {
                        this.hideModals();
                    } else if (state.isDrawingMode) {
                        this.stopDrawingMode();
                    }
                }
                // D: 上一张测试用例
                if (e.key === 'd' || e.key === 'D') {
                    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                        this.prevTestCase();
                    }
                }
                // F: 下一张测试用例
                if (e.key === 'f' || e.key === 'F') {
                    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                        this.nextTestCase();
                    }
                }
                // 左箭头: 上一张
                if (e.key === 'ArrowLeft') {
                    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                        this.prevTestCase();
                    }
                }
                // 右箭头: 下一张
                if (e.key === 'ArrowRight') {
                    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                        this.nextTestCase();
                    }
                }
                // Home: 第一张
                if (e.key === 'Home') {
                    if (state.testCases.length > 0) {
                        e.preventDefault();
                        this.loadTestCase(state.testCases[0].id);
                    }
                }
                // End: 最后一张
                if (e.key === 'End') {
                    if (state.testCases.length > 0) {
                        e.preventDefault();
                        this.loadTestCase(state.testCases[state.testCases.length - 1].id);
                    }
                }
                // Ctrl/Cmd + A: 全选测试用例
                if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                    // 只在缩略图区域聚焦时生效
                    if (document.activeElement === document.body ||
                        dom.thumbnailContainer?.contains(document.activeElement)) {
                        e.preventDefault();
                        this.toggleSelectAll();
                    }
                }
            });

            // 左侧缺陷列表
            dom.defectList.addEventListener('click', (e) => {
                e.preventDefault();
                if (e.target.tagName === 'A') {
                    this.selectDefect(e.target.dataset.id);
                }
            });

            // 搜索过滤
            if (dom.defectSearch) {
                dom.defectSearch.addEventListener('input', (e) => {
                    this.filterDefects(e.target.value);
                });
            }

            // 版本下拉菜单
            dom.versionDropdown.addEventListener('change', () => {
                this.selectVersion(dom.versionDropdown.value);
            });

            // 模块一按钮
            dom.cancelEditBtn.onclick = () => this.selectVersion(state.currentVersionId);
            dom.runInferenceBtn.onclick = () => this.runComparisonWithConfirm();
            dom.saveVersionBtn.onclick = () => this.saveCurrentVersion();
            dom.publishVersionBtn.onclick = () => this.saveAsNewVersion();

            // 模块二（标注工具）
            dom.canvasWrapper.onclick = (e) => {
                if (dom.uploadPlaceholder.style.display !== 'none') {
                    dom.imageUploadInput.click();
                }
            };
            dom.imageUploadInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    state.currentImage.file = file;
                    const reader = new FileReader();
                    reader.onload = (event) => this.loadImageOnCanvas(event.target.result);
                    reader.readAsDataURL(file);
                }
            };
            dom.canvasWrapper.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dom.canvasWrapper.classList.add('dragover');
            });
            dom.canvasWrapper.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dom.canvasWrapper.classList.remove('dragover');
            });
            dom.canvasWrapper.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dom.canvasWrapper.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    state.currentImage.file = file;
                    const reader = new FileReader();
                    reader.onload = (event) => this.loadImageOnCanvas(event.target.result);
                    reader.readAsDataURL(file);
                }
            });

            dom.drawBoxBtn.onclick = (e) => {
                e.stopPropagation();
                if (state.isDrawingMode) this.stopDrawingMode();
                else this.startDrawingMode();
            };
            dom.undoBtn.onclick = () => this.undoLastBox();
            dom.addTestCaseBtn.onclick = () => this.addTestCase();
            if (dom.updateAnnotationBtn) {
                dom.updateAnnotationBtn.onclick = () => this.updateAnnotation();
            }
            dom.clearCanvasBtn.onclick = () => this.clearCanvas();
            
            // 旧的 testCaseList 点击事件
            if (dom.testCaseList) {
                dom.testCaseList.addEventListener('click', (e) => {
                    const target = e.target;
                    if (target.tagName === 'IMG') {
                        this.loadTestCase(target.dataset.id);
                    } else if (target.classList.contains('delete-test-case-btn')) {
                        this.deleteTestCase(target.dataset.id);
                    }
                });
            }
            
            // 新的缩略图条点击事件
            if (dom.thumbnailContainer) {
                dom.thumbnailContainer.addEventListener('click', (e) => {
                    const target = e.target;
                    // 点击复选框
                    if (target.classList.contains('checkbox-overlay')) {
                        this.toggleThumbnailSelection(parseInt(target.dataset.id), e.ctrlKey || e.metaKey);
                        return;
                    }
                    // 点击缩略图
                    const thumbnailItem = target.closest('.thumbnail-item');
                    if (thumbnailItem && !target.classList.contains('delete-test-case-btn')) {
                        // Ctrl+点击进行多选
                        if (e.ctrlKey || e.metaKey) {
                            this.toggleThumbnailSelection(parseInt(thumbnailItem.dataset.id), true);
                        } else {
                            this.loadTestCase(thumbnailItem.dataset.id);
                        }
                    }
                    // 点击删除按钮
                    if (target.classList.contains('delete-test-case-btn')) {
                        this.deleteTestCase(target.dataset.id);
                    }
                });
            }

            // 缩略图滚动区域拖动和滚轮滚动
            if (dom.thumbnailScrollWrapper) {
                let isDragging = false;
                let startX;
                let scrollLeft;
                let dragStarted = false;

                // 鼠标按下开始拖动
                dom.thumbnailScrollWrapper.addEventListener('mousedown', (e) => {
                    // 如果点击的是缩略图或按钮，不启动拖动
                    if (e.target.closest('.thumbnail-item') || e.target.closest('button')) {
                        return;
                    }
                    isDragging = true;
                    dragStarted = false;
                    startX = e.clientX;
                    scrollLeft = dom.thumbnailScrollWrapper.scrollLeft;
                    dom.thumbnailScrollWrapper.style.cursor = 'grabbing';
                });

                // 鼠标移动拖动
                dom.thumbnailScrollWrapper.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    const x = e.clientX;
                    const walk = x - startX;
                    if (Math.abs(walk) > 3) {
                        dragStarted = true;
                    }
                    if (dragStarted) {
                        e.preventDefault();
                        dom.thumbnailScrollWrapper.scrollLeft = scrollLeft - walk;
                    }
                });

                // 鼠标释放停止拖动
                dom.thumbnailScrollWrapper.addEventListener('mouseup', () => {
                    isDragging = false;
                    dom.thumbnailScrollWrapper.style.cursor = 'grab';
                    // 延迟重置 dragStarted，避免点击事件冲突
                    setTimeout(() => { dragStarted = false; }, 50);
                });

                // 鼠标离开停止拖动
                dom.thumbnailScrollWrapper.addEventListener('mouseleave', () => {
                    isDragging = false;
                    dragStarted = false;
                    dom.thumbnailScrollWrapper.style.cursor = 'grab';
                });

                // 阻止拖动时的点击冒泡
                dom.thumbnailScrollWrapper.addEventListener('click', (e) => {
                    if (dragStarted) {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }, true);

                // 滚轮水平滚动（按住Shift或直接使用滚轮）
                dom.thumbnailScrollWrapper.addEventListener('wheel', (e) => {
                    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                        // 垂直滚动转换为水平滚动
                        e.preventDefault();
                        dom.thumbnailScrollWrapper.scrollLeft += e.deltaY;
                    } else {
                        // 水平滚轮直接处理
                        e.preventDefault();
                        dom.thumbnailScrollWrapper.scrollLeft += e.deltaX;
                    }
                }, { passive: false });
            }

            // 全选复选框
            if (dom.selectAllThumbnails) {
                dom.selectAllThumbnails.onchange = () => this.toggleSelectAll();
            }

            // 批量删除
            if (dom.batchDeleteBtn) {
                dom.batchDeleteBtn.onclick = () => this.batchDeleteTestCases();
            }

            // 批量设为正例
            if (dom.batchSetPositiveBtn) {
                dom.batchSetPositiveBtn.onclick = () => this.batchSetSampleType(true);
            }

            // 批量设为反例
            if (dom.batchSetNegativeBtn) {
                dom.batchSetNegativeBtn.onclick = () => this.batchSetSampleType(false);
            }

            // 批量导入按钮
            if (dom.batchImportBtn) {
                dom.batchImportBtn.onclick = () => this.showBatchImportModal();
            }

            // 快捷键面板切换
            if (dom.shortcutToggle) {
                dom.shortcutToggle.onclick = () => {
                    dom.shortcutsPanel.classList.toggle('expanded');
                };
            }

            // 顶部按钮
            dom.addDefectBtn.onclick = () => this.showAddDefectModal();
            dom.importDefectsBtn.onclick = () => this.showImportModal();
            dom.exportDefectsBtn.onclick = () => this.exportDefects();
            dom.editGlobalTemplateBtn.onclick = () => this.showGlobalTemplateModal();
            if (dom.settingsBtn) {
                dom.settingsBtn.onclick = () => this.showSettingsModal();
            }
            dom.runRegressionBtn.onclick = () => this.runRegressionTest();
            dom.runComparisonBtn.onclick = () => this.runComparisonWithConfirm();
            if (dom.themeToggle) {
                dom.themeToggle.onclick = () => this.toggleTheme();
            }
            if (dom.toggleSidebarBtn) {
                dom.toggleSidebarBtn.onclick = () => this.toggleSidebar();
            }

            // 导出历史按钮
            const exportHistoryBtn = document.getElementById('export-history-btn');
            if (exportHistoryBtn) {
                exportHistoryBtn.onclick = () => this.exportHistoryCSV();
            }

            // 批量导入模态框事件
            this.initBatchImportEvents();
        },

        // --- 批量操作方法 ---
        async batchDeleteTestCases() {
            if (state.batchSelectedIds.length === 0) {
                Notification.warning('请先选择要删除的测试用例', '提示');
                return;
            }

            if (!confirm(`确定要删除选中的 ${state.batchSelectedIds.length} 个测试用例吗？此操作不可撤销。`)) {
                return;
            }

            Loading.show(`正在删除 ${state.batchSelectedIds.length} 个测试用例...`);
            let successCount = 0;
            let failCount = 0;

            for (const id of state.batchSelectedIds) {
                try {
                    const result = await api.delete(`/api/testcase/${id}`);
                    if (result.success) {
                        successCount++;
                        state.testCases = state.testCases.filter(tc => tc.id != id);
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    failCount++;
                }
            }

            Loading.hide();

            if (successCount > 0) {
                Notification.success(`成功删除 ${successCount} 个测试用例`, '删除完成');
                state.batchSelectedIds = [];
                this.renderTestCases();
                if (state.batchSelectedIds.includes(state.currentTestCaseId)) {
                    this.clearCanvas();
                }
            }

            if (failCount > 0) {
                Notification.warning(`${failCount} 个测试用例删除失败`, '部分失败');
            }
        },

        async batchSetSampleType(isPositive) {
            if (state.batchSelectedIds.length === 0) {
                Notification.warning('请先选择要修改的测试用例', '提示');
                return;
            }

            Loading.show(`正在修改 ${state.batchSelectedIds.length} 个测试用例类型...`);
            let successCount = 0;

            for (const id of state.batchSelectedIds) {
                try {
                    const result = await api.put(`/api/testcase/${id}/type`, { is_positive: isPositive });
                    if (result.success) {
                        successCount++;
                        const tc = state.testCases.find(t => t.id == id);
                        if (tc) tc.is_positive = isPositive;
                    }
                } catch (error) {
                    console.error('修改失败:', error);
                }
            }

            Loading.hide();

            if (successCount > 0) {
                Notification.success(`成功将 ${successCount} 个测试用例设为${isPositive ? '正例' : '反例'}`, '修改完成');
                this.renderTestCases();
            }
        },

        // --- 批量导入相关方法 ---
        initBatchImportEvents() {
            const modal = dom.batchImportModal;
            if (!modal) return;

            const dropArea = document.getElementById('batch-import-drop');
            const fileInput = document.getElementById('batch-import-input');
            const selectFilesBtn = document.getElementById('batch-select-files-btn');
            const selectFolderBtn = document.getElementById('batch-select-folder-btn');
            const clearBtn = document.getElementById('batch-clear-btn');
            const executeBtn = document.getElementById('batch-import-execute-btn');

            // 关闭按钮
            modal.querySelector('.modal-close').onclick = () => this.hideBatchImportModal();
            modal.querySelector('.modal-cancel').onclick = () => this.hideBatchImportModal();

            // 选择文件
            if (selectFilesBtn) {
                selectFilesBtn.onclick = () => {
                    fileInput.removeAttribute('webkitdirectory');
                    fileInput.removeAttribute('directory');
                    fileInput.click();
                };
            }

            // 选择文件夹
            if (selectFolderBtn) {
                selectFolderBtn.onclick = () => {
                    fileInput.setAttribute('webkitdirectory', '');
                    fileInput.setAttribute('directory', '');
                    fileInput.click();
                };
            }

            // 文件选择变化
            if (fileInput) {
                fileInput.onchange = (e) => this.handleBatchFiles(e.target.files);
            }

            // 拖拽
            if (dropArea) {
                dropArea.ondragover = (e) => {
                    e.preventDefault();
                    dropArea.classList.add('dragover');
                };
                dropArea.ondragleave = () => dropArea.classList.remove('dragover');
                dropArea.ondrop = (e) => {
                    e.preventDefault();
                    dropArea.classList.remove('dragover');
                    this.handleBatchFiles(e.dataTransfer.files);
                };
            }

            // 清空
            if (clearBtn) {
                clearBtn.onclick = () => {
                    state.batchImportFiles = [];
                    this.renderBatchPreview();
                };
            }

            // 执行导入
            if (executeBtn) {
                executeBtn.onclick = () => this.executeBatchImport();
            }
        },

        showBatchImportModal() {
            if (!state.currentDefectId) {
                Notification.warning('请先选择一个缺陷类别', '提示');
                return;
            }
            state.batchImportFiles = [];
            this.renderBatchPreview();
            dom.batchImportModal.style.display = 'block';
            dom.modalBackdrop.style.display = 'block';
        },

        hideBatchImportModal() {
            dom.batchImportModal.style.display = 'none';
            dom.modalBackdrop.style.display = 'none';
            state.batchImportFiles = [];
        },

        handleBatchFiles(files) {
            const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
            if (imageFiles.length === 0) {
                Notification.warning('未找到有效的图片文件', '提示');
                return;
            }

            state.batchImportFiles = [...state.batchImportFiles, ...imageFiles];
            this.renderBatchPreview();
            Notification.info(`已添加 ${imageFiles.length} 张图片`, '导入准备');
        },

        renderBatchPreview() {
            const preview = document.getElementById('batch-import-preview');
            const grid = document.getElementById('batch-preview-grid');
            const count = document.getElementById('batch-count');
            const executeBtn = document.getElementById('batch-import-execute-btn');

            if (state.batchImportFiles.length === 0) {
                preview.style.display = 'none';
                executeBtn.disabled = true;
                return;
            }

            preview.style.display = 'block';
            count.textContent = state.batchImportFiles.length;
            executeBtn.disabled = false;

            grid.innerHTML = state.batchImportFiles.map((file, index) => {
                const url = URL.createObjectURL(file);
                return `
                    <div class="preview-item" data-index="${index}">
                        <img src="${url}" alt="${file.name}">
                        <button class="remove-btn" data-index="${index}">&times;</button>
                    </div>
                `;
            }).join('');

            // 删除按钮事件
            grid.querySelectorAll('.remove-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.index);
                    state.batchImportFiles.splice(index, 1);
                    this.renderBatchPreview();
                };
            });
        },

        async executeBatchImport() {
            if (state.batchImportFiles.length === 0 || !state.currentDefectId) return;

            const progress = document.getElementById('batch-import-progress');
            const progressFill = document.getElementById('batch-progress-fill');
            const progressText = document.getElementById('batch-progress-text');
            const executeBtn = document.getElementById('batch-import-execute-btn');
            const isPositive = document.querySelector('input[name="batch-sample-type"]:checked')?.value === 'positive';
            const autoAnnotate = document.getElementById('batch-auto-annotate')?.checked;

            if (!progress || !executeBtn) return;

            progress.style.display = 'block';
            executeBtn.disabled = true;

            let successCount = 0;
            let failCount = 0;
            const total = state.batchImportFiles.length;

            for (let i = 0; i < total; i++) {
                const file = state.batchImportFiles[i];
                progressText.textContent = `正在处理 ${i + 1}/${total}: ${file.name}`;
                progressFill.style.width = `${((i + 1) / total) * 100}%`;

                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('defect_id', state.currentDefectId);
                    formData.append('boxes', JSON.stringify([])); // 暂时没有标注
                    formData.append('is_positive', isPositive);

                    const result = await api.upload('/api/testcase', formData);
                    if (result.id) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    failCount++;
                }
            }

            progress.style.display = 'none';
            executeBtn.disabled = false;

            // 刷新测试用例列表
            const data = await api.get(`/api/defect/${state.currentDefectId}`);
            state.testCases = data.test_cases;
            this.renderTestCases();

            this.hideBatchImportModal();

            if (successCount > 0) {
                Notification.success(`成功导入 ${successCount} 张图片，请为每张图片添加标注框`, '导入完成', 5000);

                // 自动加载第一个测试用例并进入标注模式
                const autoAnnotate = document.getElementById('batch-auto-annotate')?.checked;
                if (autoAnnotate && state.testCases.length > 0) {
                    // 找到第一个新导入的测试用例（最后导入的）
                    const firstNewCase = state.testCases[0];
                    if (firstNewCase) {
                        setTimeout(() => {
                            this.loadTestCase(firstNewCase.id);
                            // 显示提示引导用户开始标注
                            Notification.info('请点击"画框"按钮开始标注，标注会自动保存', '开始标注', 5000);
                        }, 500);
                    }
                }
            }
            if (failCount > 0) {
                Notification.warning(`${failCount} 张图片导入失败`, '部分失败');
            }
        },

        // --- 功能方法 ---
        async saveCurrentVersion() {
            if (!state.currentVersionId) {
                Notification.warning('请先选择一个版本', '提示');
                return;
            }

            const data = {
                defect_cn: document.getElementById('editor-defect_cn').value,
                defect_class: document.getElementById('editor-defect_class').value,
                judgment_points: document.getElementById('editor-judgment_points').value,
                exclusions: document.getElementById('editor-exclusions').value,
            };

            try {
                const result = await api.put(`/api/defect_version/${state.currentVersionId}`, data);
                if (result.id) {
                    state.hasUnsavedChanges = false;  // 保存成功，重置状态
                    let message = '版本保存成功！';

                    // 显示Trueno3同步结果
                    if (result.trueno3_sync) {
                        if (result.trueno3_sync.success) {
                            message += '\n\n✓ Trueno3同步: ' + result.trueno3_sync.message;
                        } else {
                            message += '\n\n✗ Trueno3同步失败: ' + result.trueno3_sync.error;
                        }
                    }

                    Notification.success(message, '保存成功', 5000);
                    // 更新版本下拉列表中的显示（不重新加载编辑器内容）
                    await this.updateVersionDropdown();
                }
            } catch (error) {
                Notification.error('保存失败: ' + error.message, '保存失败');
            }
        },

        async updateVersionDropdown() {
            // 只更新版本下拉列表，不重新填充编辑器
            const data = await api.get(`/api/defect/${state.currentDefectId}`);
            const versions = data.versions || [];

            dom.versionDropdown.innerHTML = versions.map(v =>
                `<option value="${v.id}" ${v.id == state.currentVersionId ? 'selected' : ''}>
                    V${v.version} - ${v.summary || 'No summary'} (${v.modifier})
                </option>`
            ).join('');
        },

        async saveAsNewVersion() {
            if (!state.currentDefectId) { Notification.warning('请先选择一个缺陷', '提示'); return; }
            const data = {
                defect_id: state.currentDefectId,
                defect_cn: document.getElementById('editor-defect_cn').value,
                defect_class: document.getElementById('editor-defect_class').value,
                judgment_points: document.getElementById('editor-judgment_points').value,
                exclusions: document.getElementById('editor-exclusions').value,
                summary: prompt('请输入本次版本的更新摘要:', 'UI优化和功能调整'),
            };
            if (!data.summary) return;

            const newVersion = await api.post('/api/defect_version', data);
            if (newVersion.id) {
                state.hasUnsavedChanges = false;  // 保存成功，重置状态
                let message = '新版本发布成功！';

                // 显示Trueno3同步结果
                if (newVersion.trueno3_sync) {
                    if (newVersion.trueno3_sync.success) {
                        message += '\n\n✓ Trueno3同步: ' + newVersion.trueno3_sync.message;
                    } else {
                        message += '\n\n✗ Trueno3同步失败: ' + newVersion.trueno3_sync.error;
                    }
                }

                Notification.success(message, '发布成功', 5000);
                await this.selectDefect(state.currentDefectId, true);  // 强制切换
                this.selectVersion(newVersion.id, true);  // 强制切换
            } else {
                Notification.error('发布失败: ' + (newVersion.error || '未知错误'), '发布失败');
            }
        },
        
        async addTestCase(silent = false) {
            const file = state.currentImage.file;
            const boxes = this.getNormalizedBoxes();
            if (!file || boxes.length === 0) {
                if (!silent) Notification.warning('请上传图片并至少绘制一个标注框！', '提示');
                return null;
            }
            
            if (!state.currentDefectId) {
                if (!silent) Notification.warning('请先选择一个缺陷类别！', '提示');
                return null;
            }
            
            const sampleType = document.querySelector('input[name="sample-type"]:checked');
            const isPositive = sampleType ? sampleType.value === 'positive' : true;
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('defect_id', state.currentDefectId);
            formData.append('boxes', JSON.stringify(boxes));
            formData.append('is_positive', isPositive);

            const result = await api.upload('/api/testcase', formData);
            if (result.id) {
                if (!silent) Notification.success(`测试用例添加成功！(${isPositive ? '正例' : '反例'})`, '成功');
                const defectId = result.defect_id || state.currentDefectId;
                const data = await api.get(`/api/defect/${defectId}`);
                state.testCases = data.test_cases;
                this.renderTestCases();
                this.loadTestCase(result.id);
                return result.id;
            } else {
                if (!silent) Notification.error('添加失败: ' + (result.error || '未知错误'), '添加失败');
                return null;
            }
        },
        
        async updateAnnotation() {
            if (!state.currentTestCaseId) {
                Notification.warning('请先选择一个测试用例', '提示');
                return;
            }
            
            const boxes = this.getNormalizedBoxes();
            if (boxes.length === 0) {
                Notification.warning('请至少绘制一个标注框', '提示');
                return;
            }
            
            Loading.show('正在更新标注...');
            const result = await api.put(`/api/testcase/${state.currentTestCaseId}/boxes`, { boxes });
            Loading.hide();
            
            if (result.success) {
                Notification.success('标注已更新', '更新成功');
                // 更新预览图
                const testCase = state.testCases.find(tc => tc.id == state.currentTestCaseId);
                if (testCase) {
                    testCase.preview_url = testCase.filepath + '?t=' + Date.now();
                    this.renderTestCases();
                }
                // 隐藏更新按钮
                if (dom.updateAnnotationBtn) {
                    dom.updateAnnotationBtn.style.display = 'none';
                }
            } else {
                Notification.error('更新失败: ' + (result.error || '未知错误'), '更新失败');
            }
        },

        // 自动保存标注（静默保存，不显示加载提示）
        async autoSaveAnnotation() {
            if (!state.currentTestCaseId) return;

            const boxes = this.getNormalizedBoxes();
            if (boxes.length === 0) return;

            try {
                const result = await api.put(`/api/testcase/${state.currentTestCaseId}/boxes`, { boxes });
                if (result.success) {
                    // 静默更新预览图，不刷新整个列表以避免干扰用户
                    const testCase = state.testCases.find(tc => tc.id == state.currentTestCaseId);
                    if (testCase) {
                        testCase.preview_url = testCase.filepath + '?t=' + Date.now();
                    }
                    // 显示一个微妙的提示
                    Notification.success('标注已自动保存', '保存成功', 1500);
                }
            } catch (error) {
                console.error('自动保存失败:', error);
            }
        },

        async deleteTestCase(testCaseId) {
            if (!confirm('确定要删除这个测试用例吗？此操作不可撤销。')) return;

            const result = await api.delete(`/api/testcase/${testCaseId}`);
            if (result.success) {
                Notification.success('测试用例已删除', '删除成功');
                state.testCases = state.testCases.filter(tc => tc.id != testCaseId);
                this.renderTestCases();
                if (state.currentTestCaseId == testCaseId) {
                    this.clearCanvas();
                }
            } else {
                Notification.error('删除失败: ' + (result.error || '未知错误'), '删除失败');
            }
        },

        // 直接运行对比（使用真实API）
        async runComparisonWithConfirm() {
            if (!state.currentTestCaseId) {
                Notification.warning('请先选择一个测试用例', '提示');
                return;
            }
            await this.runComparison(true);
            // 滚动到对比结果区域
            document.getElementById('comparison-container').scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        },

        async runComparison(useRealLLM = false) {
            let testCaseId = state.currentTestCaseId;

            if (!testCaseId && state.currentImage.file) {
                Loading.show('正在自动保存新图片为测试用例...');
                testCaseId = await this.addTestCase(true);
                Loading.hide();
                if (!testCaseId) {
                    Notification.error('自动保存测试用例失败，请重试', '保存失败');
                    return;
                }
            }

            if (!state.currentVersionId || !testCaseId) {
                Notification.warning('请选择一个版本和一个测试用例，或上传新图片并标注', '提示');
                return;
            }

            const editedParams = {
                defect_cn: document.getElementById('editor-defect_cn').value,
                defect_class: document.getElementById('editor-defect_class').value,
                judgment_points: document.getElementById('editor-judgment_points').value,
                exclusions: document.getElementById('editor-exclusions').value,
            };
            const payload = {
                saved_version_id: state.currentVersionId,
                edited_params: editedParams,
                test_case_id: testCaseId,
                use_real_llm: useRealLLM,
                model_name: dom.modelSelector.value,
            };
            
            Loading.show(useRealLLM ? '正在调用大模型推理...' : '正在运行模拟对比...');
            const initialResponse = await api.post('/api/compare', payload);
            Loading.hide();

            if (initialResponse.task_id) {
                dom.comparisonContainer.innerHTML = '<p>AI正在思考中，请稍候... (任务ID: ' + initialResponse.task_id + ')</p>';
                this.pollTask(initialResponse.task_id);
            } else {
                dom.comparisonContainer.innerHTML = `<p class="error">启动对比任务失败: ${initialResponse.error || '未知错误'}</p>`;
            }
        },

        pollTask(taskId) {
            if (state.pollingInterval) {
                clearInterval(state.pollingInterval);
            }

            state.pollingInterval = setInterval(async () => {
                const statusResponse = await api.get(`/api/task/${taskId}`);
                if (statusResponse.status === 'COMPLETE') {
                    clearInterval(state.pollingInterval);
                    state.pollingInterval = null;
                    this.renderComparisonResults(statusResponse.result);
                } else if (statusResponse.status === 'ERROR') {
                    clearInterval(state.pollingInterval);
                    state.pollingInterval = null;
                    dom.comparisonContainer.innerHTML = `<p class="error">任务失败: ${statusResponse.error}</p>`;
                }
                // if PENDING or PROCESSING, do nothing and wait for the next poll
            }, 2000); // Poll every 2 seconds
        },

        renderComparisonResults(result) {
            // 辅助函数：解析框结果（支持数组或对象）
            const parseBoxResults = (results) => {
                if (!results) return [];
                if (Array.isArray(results)) return results;
                // 如果是单个对象，包装成数组
                if (typeof results === 'object' && results !== null) return [results];
                return [];
            };

            const renderBoxResult = (boxResult, index) => {
                const statusClass = boxResult.status === 'Y' ? 'status-yes' :
                                   boxResult.status === 'N' ? 'status-no' : 'status-error';
                const statusText = boxResult.status === 'Y' ? '✓ 通过' :
                                  boxResult.status === 'N' ? '✗ 未通过' : '⚠ 错误';
                const boxId = boxResult.box_id !== undefined ? boxResult.box_id : index;
                return `
                    <div class="box-result-item ${statusClass}">
                        <div class="box-result-header">
                            <span class="box-id">框 #${boxId}</span>
                            <span class="box-status">${statusText}</span>
                        </div>
                        <div class="box-reason">${boxResult.reason || '-'}</div>
                    </div>
                `;
            };

            const renderVersionCard = (title, results, prompt) => {
                const boxResults = parseBoxResults(results);
                const passedCount = boxResults.filter(r => r.status === 'Y').length;
                return `
                <div class="comparison-card">
                    <div class="comparison-card-header">
                        <h4>${title}</h4>
                        <span class="result-count">
                            ${passedCount}/${boxResults.length} 通过
                        </span>
                    </div>
                    <div class="comparison-card-body">
                        <div class="box-results-grid">
                            ${boxResults.map((r, i) => renderBoxResult(r, i)).join('')}
                        </div>
                    </div>
                    <div class="comparison-card-footer">
                        <details>
                            <summary>查看完整 Prompt</summary>
                            <pre class="prompt-text">${prompt || '无'}</pre>
                        </details>
                    </div>
                </div>
            `;
            };

            const savedResults = parseBoxResults(result.saved_version_results);
            const editedResults = parseBoxResults(result.edited_version_results);

            dom.comparisonContainer.innerHTML = `
                <div class="comparison-layout">
                    ${renderVersionCard('📦 已保存版本', savedResults, result.prompt_used?.saved)}
                    ${renderVersionCard('✏️ 当前编辑版本', editedResults, result.prompt_used?.edited)}
                </div>
                <div class="comparison-summary">
                    <h4>📊 对比总结</h4>
                    <div class="summary-stats">
                        <div class="stat-item">
                            <span class="stat-label">保存版本通过率</span>
                            <span class="stat-value">${savedResults.length > 0 ? Math.round(savedResults.filter(r => r.status === 'Y').length / savedResults.length * 100) : 0}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">编辑版本通过率</span>
                            <span class="stat-value">${editedResults.length > 0 ? Math.round(editedResults.filter(r => r.status === 'Y').length / editedResults.length * 100) : 0}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">差异数</span>
                            <span class="stat-value">${savedResults.filter((r, i) => r.status !== editedResults[i]?.status).length}</span>
                        </div>
                    </div>
                </div>
            `;
        },
        
        async runRegressionTest() {
            if (!state.currentVersionId) { Notification.warning('请选择一个版本', '提示'); return; }

            // 直接使用真实API
            const payload = {
                version_id: state.currentVersionId,
                use_real_llm: true,
                model_name: dom.modelSelector.value,
            };
            
            const regressionContainer = document.getElementById('regression-report-container');
            regressionContainer.innerHTML = '<div class="loading-indicator">正在运行回归测试...</div>';
            const response = await api.post('/api/regression_test', payload);
            
            const summary = response.summary;
            const details = response.details;
            
            regressionContainer.innerHTML = `
                <div class="regression-report-header">
                    <h4>📊 回归测试报告</h4>
                    <button class="btn btn-secondary btn-sm" onclick="app.exportRegressionReport()">导出报告</button>
                </div>
                
                <div class="accuracy-summary">
                    <div class="accuracy-card main-accuracy">
                        <div class="accuracy-value">${summary.accuracy}%</div>
                        <div class="accuracy-label">总体准确率</div>
                        <div class="accuracy-detail">${summary.correct_predictions}/${summary.total_cases}</div>
                    </div>
                    <div class="accuracy-card positive-accuracy">
                        <div class="accuracy-value">${summary.positive_accuracy}%</div>
                        <div class="accuracy-label">正例准确率</div>
                        <div class="accuracy-detail">${summary.tp}/${summary.positive_count}</div>
                    </div>
                    <div class="accuracy-card negative-accuracy">
                        <div class="accuracy-value">${summary.negative_accuracy}%</div>
                        <div class="accuracy-label">反例准确率</div>
                        <div class="accuracy-detail">${summary.tn}/${summary.negative_count}</div>
                    </div>
                </div>
                
                <div class="confusion-matrix">
                    <h5>混淆矩阵</h5>
                    <table class="matrix-table">
                        <tr>
                            <td></td>
                            <td>预测: 有缺陷</td>
                            <td>预测: 无缺陷</td>
                        </tr>
                        <tr>
                            <td>实际: 正例</td>
                            <td class="tp">${summary.tp} (TP)</td>
                            <td class="fn">${summary.fn} (FN)</td>
                        </tr>
                        <tr>
                            <td>实际: 反例</td>
                            <td class="fp">${summary.fp} (FP)</td>
                            <td class="tn">${summary.tn} (TN)</td>
                        </tr>
                    </table>
                </div>
                
                <table class="regression-table">
                    <thead>
                        <tr>
                            <th>测试用例ID</th>
                            <th>类型</th>
                            <th>预期</th>
                            <th>实际</th>
                            <th>结果</th>
                            <th>详细结果</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${details.map(res => `
                            <tr class="${res.result === 'correct' ? 'row-correct' : (res.result === 'wrong' ? 'row-wrong' : 'row-error')}">
                                <td>${res.test_case_id}</td>
                                <td>${res.is_positive ? '✓ 正例' : '✗ 反例'}</td>
                                <td>${res.expected}</td>
                                <td>${res.predicted}</td>
                                <td>${res.result === 'correct' ? '✓' : (res.result === 'wrong' ? '✗' : '⚠')}</td>
                                <td><pre>${JSON.stringify(res.results, null, 2)}</pre></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        },
        
        // 自定义确认弹窗
        showConfirmModal(title, message, confirmText = '确认', cancelText = '取消') {
            return new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.className = 'custom-modal';
                modal.innerHTML = `
                    <div class="custom-modal-content">
                        <div class="custom-modal-header">
                            <h4>${title}</h4>
                        </div>
                        <div class="custom-modal-body">
                            <p>${message}</p>
                        </div>
                        <div class="custom-modal-footer">
                            <button class="btn btn-secondary" id="modal-cancel">${cancelText}</button>
                            <button class="btn btn-primary" id="modal-confirm">${confirmText}</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                // 显示动画
                requestAnimationFrame(() => {
                    modal.classList.add('show');
                });
                
                // 绑定事件
                modal.querySelector('#modal-cancel').onclick = () => {
                    modal.classList.remove('show');
                    setTimeout(() => modal.remove(), 300);
                    resolve(null);
                };
                
                modal.querySelector('#modal-confirm').onclick = () => {
                    modal.classList.remove('show');
                    setTimeout(() => modal.remove(), 300);
                    resolve(true);
                };
                
                // 点击背景关闭
                modal.onclick = (e) => {
                    if (e.target === modal) {
                        modal.classList.remove('show');
                        setTimeout(() => modal.remove(), 300);
                        resolve(null);
                    }
                };
            });
        },
        
        // 导出回归测试报告
        exportRegressionReport() {
            const table = document.querySelector('.regression-table');
            if (!table) return;
            
            let csv = '测试用例ID,类型,预期,实际,结果,详细结果\n';
            table.querySelectorAll('tbody tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 6) {
                    csv += `${cells[0].textContent},${cells[1].textContent},${cells[2].textContent},${cells[3].textContent},${cells[4].textContent},"${cells[5].textContent.replace(/"/g, '""')}"\n`;
                }
            });
            
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `回归测试报告_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            
            Notification.success('报告已导出', '导出成功');
        },

        // --- 模态框方法 ---
        showModals() { dom.modalBackdrop.style.display = 'block'; },
        hideModals() {
            dom.modalBackdrop.style.display = 'none';
            dom.globalTemplateModal.style.display = 'none';
            dom.addDefectModal.style.display = 'none';
            dom.importDefectsModal.style.display = 'none';
            dom.settingsModal.style.display = 'none';
            if (dom.batchImportModal) dom.batchImportModal.style.display = 'none';
        },

        async showGlobalTemplateModal() {
            const template = await api.get('/api/global_template');
            dom.globalTemplateModal.innerHTML = `
                <div class="modal-header">编辑全局 Prompt 模板</div>
                <div class="modal-body">
                    <textarea id="global-template-editor" rows="15">${template.template_text}</textarea>
                </div>
                <div class="modal-footer">
                    <button id="cancel-template-btn" class="btn-secondary">取消</button>
                    <button id="save-template-btn" class="btn-primary">保存</button>
                </div>
            `;
            this.showModals();
            dom.globalTemplateModal.style.display = 'block';
            document.getElementById('cancel-template-btn').onclick = () => this.hideModals();
            document.getElementById('save-template-btn').onclick = async () => {
                const newText = document.getElementById('global-template-editor').value;
                await api.post('/api/global_template', { template_text: newText });
                this.hideModals();
                Notification.success('全局模板已更新！', '保存成功');
            };
        },

        showAddDefectModal() {
            dom.addDefectModal.innerHTML = `
                <div class="modal-header">创建新缺陷类别</div>
                <div class="modal-body">
                    <div class="form-item"><label>缺陷英文名 (唯一标识)</label><input type="text" id="new-defect-name"></div>
                    <div class="form-item"><label>缺陷中文名</label><input type="text" id="new-defect-cn"></div>
                    <div class="form-item"><label>缺陷分类</label><textarea id="new-defect-class" rows="2"></textarea></div>
                    <div class="form-item"><label>判断点</label><textarea id="new-defect-points" rows="3"></textarea></div>
                    <div class="form-item"><label>排除项</label><textarea id="new-defect-exclusions" rows="3"></textarea></div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-defect-btn" class="btn-secondary">取消</button>
                    <button id="save-defect-btn" class="btn-primary">创建</button>
                </div>
            `;
            this.showModals();
            dom.addDefectModal.style.display = 'block';
            document.getElementById('cancel-defect-btn').onclick = () => this.hideModals();
            document.getElementById('save-defect-btn').onclick = async () => {
                const data = {
                    name: document.getElementById('new-defect-name').value,
                    defect_cn: document.getElementById('new-defect-cn').value,
                    defect_class: document.getElementById('new-defect-class').value,
                    judgment_points: document.getElementById('new-defect-points').value,
                    exclusions: document.getElementById('new-defect-exclusions').value,
                };
                if (!data.name || !data.defect_cn) { Notification.warning('英文名和中文名不能为空!', '验证失败'); return; }
                const result = await api.post('/api/defect', data);
                if (result.id) {
                    this.hideModals();
                    await this.loadDefects();
                    await this.selectDefect(result.id);
                    Notification.success('缺陷类别创建成功！', '创建成功');
                } else { Notification.error('创建失败: ' + (result.error || '未知错误'), '创建失败'); }
            };
        },

        // --- 批量导入导出 ---
        showImportModal() {
            const modal = dom.importDefectsModal;
            modal.style.display = 'block';
            this.showModals();

            // 切换标签
            modal.querySelectorAll('.import-tab').forEach(tab => {
                tab.onclick = () => {
                    modal.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
                    modal.querySelectorAll('.import-tab-content').forEach(c => c.classList.remove('active'));
                    tab.classList.add('active');
                    const tabName = tab.dataset.tab;
                    document.getElementById(`import-${tabName}-tab`).classList.add('active');
                };
            });

            // 文件上传
            const fileDrop = document.getElementById('import-file-drop');
            const fileInput = document.getElementById('import-file-input');
            const fileNameDisplay = document.getElementById('import-file-name');

            fileDrop.onclick = () => fileInput.click();
            fileDrop.ondragover = (e) => { e.preventDefault(); fileDrop.classList.add('dragover'); };
            fileDrop.ondragleave = () => fileDrop.classList.remove('dragover');
            fileDrop.ondrop = (e) => {
                e.preventDefault();
                fileDrop.classList.remove('dragover');
                if (e.dataTransfer.files[0]) {
                    fileInput.files = e.dataTransfer.files;
                    fileNameDisplay.textContent = e.dataTransfer.files[0].name;
                }
            };
            fileInput.onchange = () => {
                if (fileInput.files[0]) {
                    fileNameDisplay.textContent = fileInput.files[0].name;
                }
            };

            // 执行导入
            document.getElementById('import-execute-btn').onclick = () => this.executeImport();

            // 关闭按钮
            modal.querySelector('.modal-close').onclick = () => this.hideModals();
            modal.querySelector('.modal-cancel').onclick = () => this.hideModals();
        },

        async executeImport() {
            const activeTab = document.querySelector('.import-tab.active').dataset.tab;
            const resultDiv = document.getElementById('import-result');

            let importText = '';

            if (activeTab === 'paste') {
                importText = document.getElementById('import-text').value;
            } else {
                const fileInput = document.getElementById('import-file-input');
                if (!fileInput.files[0]) {
                    Notification.warning('请选择文件', '提示');
                    return;
                }
                const file = fileInput.files[0];
                importText = await file.text();
            }

            if (!importText.trim()) {
                Notification.warning('导入内容不能为空', '提示');
                return;
            }

            try {
                const result = await api.post('/api/defects/batch_import', { import_text: importText });

                resultDiv.style.display = 'block';
                document.getElementById('import-success-count').textContent = result.summary.imported_count;
                document.getElementById('import-skipped-count').textContent = result.summary.skipped_count;
                document.getElementById('import-error-count').textContent = result.summary.error_count;

                // 显示详细结果列表
                const detailsDiv = document.getElementById('import-details');
                const detailsList = document.getElementById('import-details-list');

                if (result.details && result.details.length > 0) {
                    detailsDiv.style.display = 'block';
                    detailsList.innerHTML = result.details.map(item => {
                        const statusClass = item.status === 'imported' ? 'success' :
                                           item.status === 'skipped' ? 'skipped' : 'error';
                        const statusIcon = item.status === 'imported' ? '✓' :
                                          item.status === 'skipped' ? '→' : '✗';
                        return `<div class="import-detail-item ${statusClass}">
                            <span class="name">${statusIcon} ${item.name}</span>
                            ${item.message ? `<span class="msg">${item.message}</span>` : ''}
                        </div>`;
                    }).join('');
                } else {
                    detailsDiv.style.display = 'none';
                }

                if (result.summary.imported_count > 0) {
                    await this.loadDefects();
                    Notification.success(`成功导入 ${result.summary.imported_count} 条缺陷定义`, '导入完成');
                } else if (result.summary.error_count > 0) {
                    Notification.warning('导入完成，但有错误，请查看详情', '提示');
                }

                if (result.summary.error_count > 0 && result.errors && result.errors.length > 0) {
                    console.error('Import errors:', result.errors);
                }
            } catch (error) {
                Notification.error('导入失败: ' + error.message, '错误');
            }
        },

        async exportDefects() {
            if (!state.defects || state.defects.length === 0) {
                Notification.warning('没有可导出的缺陷', '提示');
                return;
            }

            try {
                const result = await api.post('/api/defects/export', { defect_ids: [] });

                if (result.success) {
                    // 下载文件
                    const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = result.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    Notification.success(`已导出 ${result.count} 条缺陷定义`, '导出成功');
                }
            } catch (error) {
                Notification.error('导出失败: ' + error.message, '错误');
            }
        },

        // --- 导出历史CSV ---
        exportHistoryCSV() {
            const table = document.getElementById('history-table');
            if (!table || !table.querySelector('tbody').children.length) {
                Notification.warning('没有可导出的历史数据', '提示');
                return;
            }
            
            let csv = '版本号,修改人,修改摘要,时间\n';
            table.querySelectorAll('tbody tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 4) {
                    csv += `${cells[0].textContent},${cells[1].textContent},${cells[2].textContent},${cells[3].textContent}\n`;
                }
            });
            
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `提示词修改历史_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            
            Notification.success('历史记录已导出', '导出成功');
        },

        // --- 系统设置模态框 ---
        async showSettingsModal() {
            try {
                const [template, llmConfig, trueno3Config] = await Promise.all([
                    api.get('/api/global_template'),
                    api.get('/api/llm_config'),
                    api.get('/api/trueno3_config')
                ]);
                
                // 确保有默认值
                const safeTemplate = template || { template_text: '' };
                const safeLlmConfig = llmConfig || {
                    api_key: '',
                    api_url: 'https://api.siliconflow.cn/v1/chat/completions',
                    default_model: 'Pro/Qwen/Qwen2.5-VL-7B-Instruct',
                    temperature: 0.7,
                    max_tokens: 1000
                };
                const safeTrueno3Config = trueno3Config || {
                    enabled: false,
                    code_path: '/home/user/trueno3/src/algorithm/vlm_qwen3_server',
                    ssh_host: '',
                    ssh_port: 22,
                    ssh_username: '',
                    ssh_password: ''
                };
            
            dom.settingsModal.innerHTML = `
                <div class="modal-header">⚙️ 系统设置</div>
                <div class="modal-body">
                    <div class="settings-tabs">
                        <button class="settings-tab active" data-settings-tab="prompt">全局Prompt模板</button>
                        <button class="settings-tab" data-settings-tab="llm">大模型配置</button>
                        <button class="settings-tab" data-settings-tab="trueno3">Trueno3同步</button>
                    </div>
                    
                    <!-- Prompt模板设置 -->
                    <div id="settings-prompt" class="settings-tab-content active">
                        <div class="form-item">
                            <label>全局 Prompt 模板</label>
                            <textarea id="settings-template-editor" rows="12">${safeTemplate.template_text || ''}</textarea>
                        </div>
                    </div>
                    
                    <!-- 大模型配置 -->
                    <div id="settings-llm" class="settings-tab-content">
                        <div class="form-item">
                            <label>API Key <span class="hint">（SiliconFlow API密钥）</span></label>
                            <input type="password" id="settings-api-key" value="${safeLlmConfig.api_key || ''}" placeholder="sk-xxxxxxxxxxxxxxxx">
                        </div>
                        <div class="form-item">
                            <label>API URL</label>
                            <input type="text" id="settings-api-url" value="${safeLlmConfig.api_url || 'https://api.siliconflow.cn/v1/chat/completions'}" placeholder="https://api.siliconflow.cn/v1/chat/completions">
                        </div>
                        <div class="form-item">
                            <label>默认模型</label>
                            <select id="settings-default-model">
                                <option value="Pro/Qwen/Qwen2.5-VL-7B-Instruct" ${safeLlmConfig.default_model === 'Pro/Qwen/Qwen2.5-VL-7B-Instruct' ? 'selected' : ''}>Qwen2.5-VL-7B-Instruct</option>
                                <option value="Qwen/Qwen3-VL-8B-Instruct" ${safeLlmConfig.default_model === 'Qwen/Qwen3-VL-8B-Instruct' ? 'selected' : ''}>Qwen3-VL-8B-Instruct</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-item">
                                <label>Temperature <span class="hint">（0-2，越小越确定）</span></label>
                                <input type="number" id="settings-temperature" value="${safeLlmConfig.temperature !== undefined ? safeLlmConfig.temperature : 0.7}" min="0" max="2" step="0.1">
                            </div>
                            <div class="form-item">
                                <label>Max Tokens <span class="hint">（最大输出长度）</span></label>
                                <input type="number" id="settings-max-tokens" value="${safeLlmConfig.max_tokens !== undefined ? safeLlmConfig.max_tokens : 1000}" min="100" max="4000" step="100">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Trueno3配置 -->
                    <div id="settings-trueno3" class="settings-tab-content">
                        <div class="form-item">
                            <label>
                                <input type="checkbox" id="settings-trueno3-enabled" ${safeTrueno3Config.enabled ? 'checked' : ''}>
                                启用Trueno3自动同步
                            </label>
                            <p class="hint">发布新版本时自动同步到Trueno3服务器的defect_definitions.py</p>
                        </div>
                        <div class="form-item">
                            <label>代码目录路径</label>
                            <input type="text" id="settings-trueno3-path" value="${safeTrueno3Config.code_path || '/home/user/trueno3/src/algorithm/vlm_qwen3_server'}" placeholder="/home/user/trueno3/src/algorithm/vlm_qwen3_server">
                        </div>
                        <div class="form-row">
                            <div class="form-item">
                                <label>SSH主机</label>
                                <input type="text" id="settings-trueno3-host" value="${safeTrueno3Config.ssh_host || ''}" placeholder="192.168.1.100">
                            </div>
                            <div class="form-item">
                                <label>SSH端口</label>
                                <input type="number" id="settings-trueno3-port" value="${safeTrueno3Config.ssh_port || 22}" min="1" max="65535">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-item">
                                <label>SSH用户名</label>
                                <input type="text" id="settings-trueno3-username" value="${safeTrueno3Config.ssh_username || ''}" placeholder="root">
                            </div>
                            <div class="form-item">
                                <label>SSH密码</label>
                                <input type="password" id="settings-trueno3-password" value="${safeTrueno3Config.ssh_password || ''}" placeholder="密码">
                            </div>
                        </div>
                        <div class="form-item">
                            <button id="test-trueno3-btn" class="btn-secondary">🧪 测试SSH连接</button>
                            <span id="trueno3-test-result" class="hint"></span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-settings-btn" class="btn-secondary">取消</button>
                    <button id="save-settings-btn" class="btn-primary">保存设置</button>
                </div>
            `;
            
            this.showModals();
            dom.settingsModal.style.display = 'block';
            
            // 绑定设置标签切换
            document.querySelectorAll('.settings-tab').forEach(tab => {
                tab.onclick = () => {
                    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
                    tab.classList.add('active');
                    document.getElementById(`settings-${tab.dataset.settingsTab}`).classList.add('active');
                };
            });
            
            // 测试SSH连接（使用当前输入框内的配置）
            document.getElementById('test-trueno3-btn').onclick = async () => {
                const resultSpan = document.getElementById('trueno3-test-result');
                resultSpan.textContent = ' 测试中...';
                resultSpan.style.color = 'var(--text-secondary)';
                
                // 获取当前输入框内的配置
                const testConfig = {
                    code_path: document.getElementById('settings-trueno3-path').value,
                    ssh_host: document.getElementById('settings-trueno3-host').value,
                    ssh_port: parseInt(document.getElementById('settings-trueno3-port').value),
                    ssh_username: document.getElementById('settings-trueno3-username').value,
                    ssh_password: document.getElementById('settings-trueno3-password').value,
                };
                
                // 验证必填项
                if (!testConfig.ssh_host || !testConfig.ssh_username) {
                    resultSpan.textContent = ' ✗ 请填写SSH主机和用户名';
                    resultSpan.style.color = '#ea4335';
                    return;
                }
                
                try {
                    const result = await api.post('/api/trueno3_test', testConfig);
                    if (result.success) {
                        resultSpan.textContent = ' ✓ ' + result.message;
                        resultSpan.style.color = 'var(--success-color)';
                    } else {
                        resultSpan.textContent = ' ✗ ' + result.error;
                        resultSpan.style.color = '#ea4335';
                    }
                } catch (error) {
                    resultSpan.textContent = ' ✗ 测试失败: ' + error.message;
                    resultSpan.style.color = '#ea4335';
                }
            };
            
            document.getElementById('cancel-settings-btn').onclick = () => this.hideModals();
            document.getElementById('save-settings-btn').onclick = async () => {
                // 保存Prompt模板
                const templateText = document.getElementById('settings-template-editor').value;
                await api.post('/api/global_template', { template_text: templateText });
                
                // 保存LLM配置
                const llmData = {
                    api_key: document.getElementById('settings-api-key').value,
                    api_url: document.getElementById('settings-api-url').value,
                    default_model: document.getElementById('settings-default-model').value,
                    temperature: parseFloat(document.getElementById('settings-temperature').value),
                    max_tokens: parseInt(document.getElementById('settings-max-tokens').value),
                };
                await api.post('/api/llm_config', llmData);
                
                // 保存Trueno3配置
                const trueno3Data = {
                    enabled: document.getElementById('settings-trueno3-enabled').checked,
                    code_path: document.getElementById('settings-trueno3-path').value,
                    ssh_host: document.getElementById('settings-trueno3-host').value,
                    ssh_port: parseInt(document.getElementById('settings-trueno3-port').value),
                    ssh_username: document.getElementById('settings-trueno3-username').value,
                    ssh_password: document.getElementById('settings-trueno3-password').value,
                };
                await api.post('/api/trueno3_config', trueno3Data);

                // 刷新模型选择器
                await this.loadModels();
                await this.checkLLMHealth();

                this.hideModals();
                Notification.success('设置已保存！', '保存成功');
            };
            
            } catch (error) {
                console.error('加载设置失败:', error);
                Notification.error('加载设置失败，请检查网络连接或刷新页面重试', '加载失败');
            }
        }
    };

    App.init();
});
