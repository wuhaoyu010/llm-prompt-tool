
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
        isPanningMode: false,  // 平移模式
        isContinuousDrawMode: true,  // 连续绘制模式（默认开启）
        canvasZoom: 1,  // 画布缩放比例
        canvasPan: { x: 0, y: 0 },  // 画布平移偏移
        lastPanPoint: null,  // 上次平移的点
        clipboardBox: null,  // 复制的单个标注框
        clipboardBoxes: null,  // 复制的多个标注框（用于跨图片复制）
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
<<<<<<< HEAD
        // 暂存区相关
        annotationCache: {},  // 暂存区 { testCaseId: { boxes, history, historyIndex, isDirty, lastSaved } }
        autoSaveInterval: 60000,  // 自动保存间隔(ms)，默认1分钟
        autoSaveTimer: null,  // 自动保存定时器
        redoStack: [],  // 重做栈
    };

    // 暴露到 window 用于测试（仅开发模式）
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        window.appState = state;
        window.appFabric = fabric;
        window.appRecordHistory = (action, data) => {
            state.redoStack = [];
            state.history.push({ action, data, timestamp: Date.now() });
            state.hasUnsavedChanges = true;
        };
        window.appUndo = () => {
            if (state.history.length === 0) return;
            const lastAction = state.history.pop();
            state.redoStack.push(lastAction);
            if (lastAction.action === 'add') {
                const rect = state.fabricCanvas.getObjects('rect').find(r =>
                    r.left === lastAction.data.left &&
                    r.top === lastAction.data.top &&
                    r.width === lastAction.data.width &&
                    r.height === lastAction.data.height
                );
                if (rect) state.fabricCanvas.remove(rect);
            } else if (lastAction.action === 'delete') {
                const rect = new fabric.Rect({
                    left: lastAction.data.left, top: lastAction.data.top,
                    width: lastAction.data.width, height: lastAction.data.height,
                    fill: lastAction.data.fill, stroke: lastAction.data.stroke,
                    strokeWidth: lastAction.data.strokeWidth,
                    selectable: true, evented: true, hasControls: true, hasBorders: true,
                });
                state.fabricCanvas.add(rect);
            }
            state.fabricCanvas.renderAll();
        };
        window.appRedo = () => {
            if (state.redoStack.length === 0) return;
            const action = state.redoStack.pop();
            state.history.push(action);
            if (action.action === 'add') {
                const rect = new fabric.Rect({
                    left: action.data.left, top: action.data.top,
                    width: action.data.width, height: action.data.height,
                    fill: action.data.fill, stroke: action.data.stroke,
                    strokeWidth: action.data.strokeWidth,
                    selectable: true, evented: true, hasControls: true, hasBorders: true,
                });
                state.fabricCanvas.add(rect);
            } else if (action.action === 'delete') {
                const rect = state.fabricCanvas.getObjects('rect').find(r =>
                    r.left === action.data.left &&
                    r.top === action.data.top &&
                    r.width === action.data.width &&
                    r.height === action.data.height
                );
                if (rect) state.fabricCanvas.remove(rect);
            }
            state.fabricCanvas.renderAll();
        };
    }

    // --- Loading 管理 ---
    const Loading = {
        _lastMessage: '',
        show(message = '加载中...') {
            // 避免重复更新相同的消息，减少重绘
            if (state.isLoading && Loading._lastMessage === message) {
                return;
            }

            state.isLoading = true;
            Loading._lastMessage = message;

=======
    };
    
    // --- Loading 管理 ---
    const Loading = {
        show(message = '加载中...') {
            state.isLoading = true;
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
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
<<<<<<< HEAD
            } else {
                overlay.querySelector('.loading-message').textContent = message;
            }
=======
            }
            overlay.querySelector('.loading-message').textContent = message;
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
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

    // --- 自定义确认弹框 ---
    const ConfirmDialog = {
        modal: null,
        resolvePromise: null,

        init() {
            this.modal = document.getElementById('confirm-modal');
            if (!this.modal) return;

            document.getElementById('confirm-cancel').onclick = () => this.close(false);
            document.getElementById('confirm-ok').onclick = () => this.close(true);
            this.modal.querySelector('.modal-close')?.addEventListener('click', () => this.close(false));
        },

        show(options) {
            return new Promise((resolve) => {
                this.resolvePromise = resolve;

                const {
                    title = '确认操作',
                    message = '',
                    icon = 'help_outline',
                    checkboxLabel = '',
                    checkboxChecked = false
                } = options;

                document.getElementById('confirm-title').textContent = title;
                document.getElementById('confirm-message').textContent = message;
                document.getElementById('confirm-icon').innerHTML = `<span class="material-icons">${icon}</span>`;

                const checkboxContainer = document.getElementById('confirm-options');
                const checkbox = document.getElementById('confirm-checkbox');
                const checkboxLabelEl = document.getElementById('confirm-checkbox-label');

                if (checkboxLabel) {
                    checkboxContainer.style.display = 'block';
                    checkbox.checked = checkboxChecked;
                    checkboxLabelEl.textContent = checkboxLabel;
                } else {
                    checkboxContainer.style.display = 'none';
                }

                this.modal.style.display = 'block';
                document.getElementById('modal-backdrop').style.display = 'block';
            });
        },

        close(result) {
            if (!this.modal) return;

            const checkbox = document.getElementById('confirm-checkbox');
            const checkboxContainer = document.getElementById('confirm-options');

            const checkboxValue = checkboxContainer.style.display !== 'none' ? checkbox.checked : null;

            this.modal.style.display = 'none';
            document.getElementById('modal-backdrop').style.display = 'none';

            if (this.resolvePromise) {
                this.resolvePromise({ confirmed: result, checkboxValue });
                this.resolvePromise = null;
            }
        },

        // 快捷方法：带复选框的确认
        async askWithCheckbox(message, checkboxLabel, checkboxChecked = true) {
            const result = await this.show({
                title: '确认操作',
                message,
                icon: 'help_outline',
                checkboxLabel,
                checkboxChecked
            });
            return result;
        },

        // 快捷方法：简单确认
        async ask(message, title = '确认操作') {
            const result = await this.show({
                title,
                message,
                icon: 'help_outline'
            });
            return result.confirmed;
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
<<<<<<< HEAD
        boxContextMenu: document.getElementById('box-context-menu'),
=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
        
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
        batchAutoAnnotateBtn: document.getElementById('batch-auto-annotate-btn'),
        batchDefectAutoAnnotateBtn: document.getElementById('batch-defect-auto-annotate-btn'),
        batchDefectAnnotateModal: document.getElementById('batch-defect-annotate-modal'),
<<<<<<< HEAD
        singleDefectAnnotateModal: document.getElementById('single-defect-annotate-modal'),
=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
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
    
    // --- 组合选择器组件 (Combo Select) ---
    class ComboSelect {
        constructor(options = {}) {
            this.options = {
                placeholder: '请选择模型...',
                searchPlaceholder: '搜索模型...',
                noResultsText: '没有找到匹配的模型',
                loadingText: '加载中...',
                allowCustom: true, // 允许自定义输入
                ...options
            };
            this.models = [];
            this.filteredModels = [];
            this.selectedValue = '';
            this.isOpen = false;
            this.container = null;
            this.input = null;
            this.dropdown = null;
            this.searchInput = null;
            this.onChange = options.onChange || (() => {});
        }
        
        create() {
            const wrapper = document.createElement('div');
            wrapper.className = 'combo-select-wrapper';
            
            wrapper.innerHTML = `
                <div class="combo-select-container">
                    <input type="text" class="combo-select-input" placeholder="${this.options.placeholder}" autocomplete="off">
                    <button type="button" class="combo-select-toggle" tabindex="-1">
                        <span class="material-icons">expand_more</span>
                    </button>
                </div>
                <div class="combo-select-dropdown">
                    <div class="combo-select-search">
                        <input type="text" placeholder="${this.options.searchPlaceholder}">
                    </div>
                    <div class="combo-select-options"></div>
                </div>
            `;
            
            this.container = wrapper.querySelector('.combo-select-container');
            this.input = wrapper.querySelector('.combo-select-input');
            this.dropdown = wrapper.querySelector('.combo-select-dropdown');
            this.searchInput = wrapper.querySelector('.combo-select-search input');
            this.optionsContainer = wrapper.querySelector('.combo-select-options');
            this.toggleBtn = wrapper.querySelector('.combo-select-toggle');
            
            this.bindEvents();
            return wrapper;
        }
        
        bindEvents() {
            // 点击输入框打开下拉
            this.input.addEventListener('focus', () => this.open());
            
            // 点击切换按钮
            this.toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.isOpen) {
                    this.close();
                } else {
                    this.open();
                }
            });
            
            // 输入框输入事件
            this.input.addEventListener('input', (e) => {
                const value = e.target.value;
                this.selectedValue = value;
                this.filterOptions(value);
                if (!this.isOpen) this.open();
            });
            
            // 搜索框输入事件
            this.searchInput.addEventListener('input', (e) => {
                this.filterOptions(e.target.value);
            });
            
            // 点击外部关闭
            document.addEventListener('click', (e) => {
                if (!this.container.parentElement.contains(e.target)) {
                    this.close();
                }
            });
            
            // 键盘事件
            this.input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.close();
                } else if (e.key === 'Enter' && this.filteredModels.length > 0) {
                    this.selectOption(this.filteredModels[0]);
                    this.close();
                }
            });
        }
        
        open() {
            this.isOpen = true;
            this.dropdown.classList.add('open');
            this.toggleBtn.classList.add('open');
            // 不自动聚焦搜索框，让用户可以直接在输入框中输入
            this.filterOptions(this.input.value);
        }

        close() {
            this.isOpen = false;
            this.dropdown.classList.remove('open');
            this.toggleBtn.classList.remove('open');
            this.searchInput.value = '';
        }
        
        setModels(models) {
            this.models = models || [];
            this.filteredModels = [...this.models];
            this.renderOptions();
        }

        setLoading(isLoading) {
            if (isLoading) {
                this.input.value = '';
                this.input.placeholder = this.options.loadingText;
                this.optionsContainer.innerHTML = `
                    <div class="combo-select-loading">
                        <span class="material-icons">sync</span>
                        <div>${this.options.loadingText}</div>
                    </div>
                `;
            } else {
                this.input.placeholder = this.options.placeholder;
            }
        }

        filterOptions(query) {
            const lowerQuery = query.toLowerCase();
            this.filteredModels = this.models.filter(model => 
                model.id.toLowerCase().includes(lowerQuery) ||
                (model.name && model.name.toLowerCase().includes(lowerQuery)) ||
                (model.owned_by && model.owned_by.toLowerCase().includes(lowerQuery))
            );
            this.renderOptions();
        }
        
        renderOptions() {
            if (this.models.length === 0) {
                this.optionsContainer.innerHTML = `
                    <div class="combo-select-loading">
                        <span class="material-icons">sync</span>
                        <div>${this.options.loadingText}</div>
                    </div>
                `;
                return;
            }
            
            if (this.filteredModels.length === 0) {
                this.optionsContainer.innerHTML = `
                    <div class="combo-select-empty">${this.options.noResultsText}</div>
                `;
                return;
            }
            
            this.optionsContainer.innerHTML = this.filteredModels.map(model => `
                <div class="combo-select-option ${model.id === this.selectedValue ? 'selected' : ''}" data-value="${model.id}">
                    <div class="model-name">${model.name || model.id}</div>
                    ${model.owned_by ? `<div class="model-owner">${model.owned_by}</div>` : ''}
                </div>
            `).join('');
            
            // 绑定选项点击事件
            this.optionsContainer.querySelectorAll('.combo-select-option').forEach(option => {
                option.addEventListener('click', () => {
                    const value = option.dataset.value;
                    const model = this.models.find(m => m.id === value);
                    this.selectOption(model);
                    this.close();
                });
            });
        }
        
        selectOption(model) {
            this.selectedValue = model.id;
            this.input.value = model.name || model.id;
            this.onChange(model);
            this.renderOptions();
        }
        
        getValue() {
            return this.input.value;
        }
        
        setValue(value) {
            this.selectedValue = value;
            this.input.value = value;
            const model = this.models.find(m => m.id === value);
            if (model) {
                this.input.value = model.name || model.id;
            }
        }
        
        setDisabled(disabled) {
            this.input.disabled = disabled;
            this.toggleBtn.disabled = disabled;
        }
    }

    // --- App 主逻辑 ---
    const App = {
        init() {
            ConfirmDialog.init();
            this.initTheme();
            this.initCanvas();
            this.bindEventListeners();
            this.loadDefects();
            this.initModelSelector();
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

        async initModelSelector() {
            // 初始化实时推理对比处的模型选择器
            const container = document.getElementById('model-selector-container');
            if (!container) return;

            this.modelSelectorCombo = new ComboSelect({
                placeholder: '选择推理模型...',
                searchPlaceholder: '搜索模型名称...',
                noResultsText: '没有找到匹配的模型',
                loadingText: '加载模型列表中...',
                onChange: (model) => {
                    console.log('Selected model for inference:', model);
                }
            });

            container.appendChild(this.modelSelectorCombo.create());

            // 加载模型列表
            try {
                const result = await api.get('/api/models');
                const models = result.models || [];

                this.modelSelectorCombo.setModels(models);

                // 设置默认值：优先使用数据库中的默认模型，其次使用第一个模型
                const defaultModel = result.default_model || (models.length > 0 ? models[0].id : null);
                if (defaultModel) {
                    this.modelSelectorCombo.setValue(defaultModel);
                }
            } catch (error) {
                console.error('加载模型列表失败:', error);
                // 显示错误提示
                this.modelSelectorCombo.input.value = '请先配置 API Key';
                this.modelSelectorCombo.input.disabled = true;
            }
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

        async loadModelsForCombo(comboSelect, defaultValue = null) {
            try {
                const result = await api.get('/api/models');
                const models = result.models || [];

                comboSelect.setModels(models);

                // 设置默认值：优先使用传入的默认值，其次使用API返回的第一个模型
                if (defaultValue) {
                    comboSelect.setValue(defaultValue);
                } else if (models.length > 0) {
                    comboSelect.selectOption(models[0]);
                }
            } catch (error) {
                console.error('加载模型列表失败:', error);
            }
        },

        async refreshInferenceModelSelector() {
            // 刷新实时推理对比处的模型选择器，使用全局配置中的默认模型
            if (!this.modelSelectorCombo) return;

            try {
                const result = await api.get('/api/models');
                const models = result.models || [];

                this.modelSelectorCombo.setModels(models);

                // 使用全局配置中的默认模型
                const defaultModel = result.default_model || (models.length > 0 ? models[0].id : null);
                if (defaultModel) {
                    this.modelSelectorCombo.setValue(defaultModel);
                }
            } catch (error) {
                console.error('刷新推理模型选择器失败:', error);
            }
        },

        async checkLLMHealth() {
            const indicator = document.getElementById('llm-status-indicator');
            if (!indicator) return;

<<<<<<< HEAD
            try {
                const result = await fetch('/api/llm_health').then(r => r.json());
                const newClass = result.status === 'online' ? 'online' : 'offline';
                const statusDot = indicator.querySelector('.status-dot');
                const statusText = indicator.querySelector('.status-text');

                // 只在状态变化时更新 DOM，减少重绘
                if (!indicator.classList.contains(newClass)) {
                    indicator.className = `llm-status-indicator ${newClass}`;
                }
                if (statusText.textContent !== result.message) {
                    statusText.textContent = result.message;
                }
                if (indicator.title !== result.details) {
                    indicator.title = result.details || '';
                }
            } catch (error) {
                // 网络错误时也要减少不必要的更新
                const newClass = 'offline';
                if (!indicator.classList.contains(newClass)) {
                    indicator.className = `llm-status-indicator ${newClass}`;
                }
                const statusText = indicator.querySelector('.status-text');
                if (statusText.textContent !== '检查失败') {
                    statusText.textContent = '检查失败';
                }
=======
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
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
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
                const confirmed = await ConfirmDialog.ask('当前有未保存的修改，切换后将丢失。确定要切换吗？');
                if (!confirmed) {
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

        async selectVersion(versionId, force = false) {
            if (!versionId) {
                this.clearEditor();
                return;
            }

            // 检查是否有未保存的修改
            if (state.hasUnsavedChanges && !force) {
                const confirmed = await ConfirmDialog.ask('当前有未保存的修改，切换后将丢失。确定要切换吗？');
                if (!confirmed) {
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
                        <button class="auto-annotate-btn" data-id="${tc.id}" title="单图自动标注">✨</button>
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

            // 统计已标注的测试用例（有标注框的）
            const annotated = state.testCases.filter(tc => tc.bounding_boxes && tc.bounding_boxes.length > 0).length;

            document.getElementById('stat-total').textContent = total;
            document.getElementById('stat-positive').textContent = positive;
            document.getElementById('stat-negative').textContent = negative;

            // 更新标注进度
            const statAnnotated = document.getElementById('stat-annotated');
            const statTotalCount = document.getElementById('stat-total-count');
            if (statAnnotated && statTotalCount) {
                statAnnotated.textContent = annotated;
                statTotalCount.textContent = total;
            }
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
<<<<<<< HEAD

            // 自动保存当前图片到暂存区（无弹框，类似 CVAT）
            if (state.currentTestCaseId) {
                this.saveToCache(state.currentTestCaseId);
            }

            state.currentTestCaseId = testCaseId;
            state.currentImage.file = null;
            state.redoStack = [];  // 切换图片时清空重做栈

            // 更新选择器
            document.querySelectorAll('.test-case-item img').forEach(img => {
                img.classList.toggle('selected', img.dataset.id == testCaseId);
            });
=======
            state.currentTestCaseId = testCaseId;
            state.currentImage.file = null;

            // 更新旧的选择器
            document.querySelectorAll('.test-case-item img').forEach(img => {
                img.classList.toggle('selected', img.dataset.id == testCaseId);
            });
            
            // 更新新的缩略图选中状态
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
            document.querySelectorAll('.thumbnail-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.id == testCaseId);
                if (item.dataset.id == testCaseId) {
                    item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            });
<<<<<<< HEAD

            // 尝试从暂存区加载
            const cache = state.annotationCache[testCaseId];
            const testCase = state.testCases.find(tc => tc.id == testCaseId);
            if (testCase) {
                await this.loadImageOnCanvas(`/${testCase.filepath}`);
                // 如果有缓存（包括空缓存），使用缓存
                if (cache && 'boxes' in cache) {
                    this.loadBoxesFromCache(testCaseId);
                } else {
                    this.renderBoxesOnCanvas(testCaseId);
                }
            }

            // 启动自动保存定时器
            this.startAutoSaveTimer();
=======
            
            const testCase = state.testCases.find(tc => tc.id == testCaseId);
            if (testCase) {
                await this.loadImageOnCanvas(`/${testCase.filepath}`);
                // loadImageOnCanvas 是 Promise，await 后图片已加载完成，直接渲染标注框
                this.renderBoxesOnCanvas(testCaseId);
            }
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
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

<<<<<<< HEAD
        // 保存当前标注到暂存区
        saveToCache(testCaseId) {
            if (!state.fabricCanvas || !testCaseId) return;

            const boxes = state.fabricCanvas.getObjects('rect').map(rect => ({
                left: rect.left,
                top: rect.top,
                width: rect.getScaledWidth(),
                height: rect.getScaledHeight(),
                fill: rect.fill,
                stroke: rect.stroke,
                strokeWidth: rect.strokeWidth,
            }));

            // 确保缓存已初始化，然后更新
            if (!state.annotationCache[testCaseId]) {
                state.annotationCache[testCaseId] = {};
            }
            state.annotationCache[testCaseId].boxes = boxes;
            state.annotationCache[testCaseId].history = [...state.history];
            state.annotationCache[testCaseId].isDirty = true;
            state.annotationCache[testCaseId].lastSaved = Date.now();
        },

        // 从暂存区加载标注
        loadBoxesFromCache(testCaseId) {
            const cache = state.annotationCache[testCaseId];
            if (!cache || !state.fabricCanvas) return;

            const bgImage = state.fabricCanvas.backgroundImage;
            if (!bgImage) {
                console.warn('[loadBoxesFromCache] 背景图片未加载，跳过渲染标注');
                return;
            }

            state.fabricCanvas.remove(...state.fabricCanvas.getObjects('rect'));
            state.history = [...cache.history];
            // 不要恢复 hasUnsavedChanges，暂存区加载不算修改

            cache.boxes.forEach(boxData => {
                const rect = new fabric.Rect({
                    left: boxData.left,
                    top: boxData.top,
                    width: boxData.width,
                    height: boxData.height,
                    fill: boxData.fill,
                    stroke: boxData.stroke,
                    strokeWidth: boxData.strokeWidth,
                    scaleX: 1,  // 使用固定 scaleX/Y，因为我们存的是实际缩放后的尺寸
                    scaleY: 1,
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                });
                state.fabricCanvas.add(rect);
            });

            state.fabricCanvas.renderAll();
        },

        // 启动自动保存定时器
        startAutoSaveTimer() {
            if (state.autoSaveTimer) {
                clearInterval(state.autoSaveTimer);
            }
            if (state.autoSaveInterval > 0) {
                state.autoSaveTimer = setInterval(() => {
                    if (state.currentTestCaseId && state.hasUnsavedChanges) {
                        this.autoSaveAnnotation();
                    }
                }, state.autoSaveInterval);
            }
        },

        // 设置自动保存间隔
        setAutoSaveInterval(intervalMs) {
            state.autoSaveInterval = intervalMs;
            this.startAutoSaveTimer();
        },

        // 更新保存状态 UI
        updateSaveStatus() {
            const saveStatus = document.getElementById('save-status');
            if (!saveStatus) return;

            if (state.hasUnsavedChanges) {
                saveStatus.textContent = '未保存';
                saveStatus.classList.add('dirty');
            } else {
                saveStatus.textContent = '已保存';
                saveStatus.classList.remove('dirty');
            }
        },

=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
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

            // 防抖处理resize事件，避免频繁重绘导致闪屏
            let resizeTimeout = null;
            const debouncedSetCanvasSize = () => {
                if (resizeTimeout) clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(setCanvasSize, 100);
            };

            state.fabricCanvas = new fabric.Canvas(canvasEl, {
                backgroundColor: 'transparent',
            });

            setCanvasSize();
            window.addEventListener('resize', debouncedSetCanvasSize);
            
            // 矩形绘制模式变量
            let isDrawingRect = false;
            let rectStartPoint = null;
            let tempRect = null;
            
            // 鼠标按下 - 开始绘制
            state.fabricCanvas.on('mouse:down', (e) => {
                // 平移模式和绘制模式互斥
                if (!state.isDrawingMode || state.isPanningMode || !state.currentImage.element) return;
                
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

<<<<<<< HEAD
                // 自动保存到暂存区（类似 CVAT）
                if (state.currentTestCaseId) {
                    this.saveToCache(state.currentTestCaseId);
=======
                // 自动保存标注到当前测试用例
                if (state.currentTestCaseId) {
                    await this.autoSaveAnnotation();
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
                }
            });
            
            // 双击删除标注框
            state.fabricCanvas.on('mouse:dblclick', async (e) => {
                const target = e.target;
                if (target && target.type === 'rect') {
                    state.fabricCanvas.remove(target);
                    Notification.success('标注框已删除', '删除成功', 2000);

<<<<<<< HEAD
                    // 自动保存到暂存区（类似 CVAT）
                    if (state.currentTestCaseId) {
                        this.saveToCache(state.currentTestCaseId);
=======
                    // 自动保存标注到当前测试用例
                    if (state.currentTestCaseId) {
                        await this.autoSaveAnnotation();
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
                    }
                }
            });
            
            // 选中时的样式
            state.fabricCanvas.on('selection:created', (e) => {
<<<<<<< HEAD
                const target = e.selected && e.selected[0];
=======
                const target = e.selected[0];
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
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
<<<<<<< HEAD
                const target = e.deselected && e.deselected[0];
=======
                const target = e.deselected[0];
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
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

            // --- 画布缩放功能（鼠标滚轮）---
            wrapper.addEventListener('wheel', (e) => {
                if (!state.currentImage.element) return;

                e.preventDefault();
                e.stopPropagation();

<<<<<<< HEAD
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newZoom = Math.max(0.5, Math.min(5, state.canvasZoom * delta));
                state.canvasZoom = newZoom;

                // 使用 Fabric.js 的 viewportTransform 实现统一缩放
                const center = state.fabricCanvas.getCenter();
                state.fabricCanvas.zoomToPoint({ x: center.left, y: center.top }, newZoom);

                this.updateZoomIndicator();
=======
                const delta = e.deltaY > 0 ? 0.9 : 1.1;  // 缩放因子
                const newZoom = Math.max(0.5, Math.min(5, state.canvasZoom * delta));
                state.canvasZoom = newZoom;

                this.applyCanvasTransform();
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
            }, { passive: false });

            // --- 画布平移功能（中键或空格+左键）---
            wrapper.addEventListener('mousedown', (e) => {
<<<<<<< HEAD
                if (e.button === 1 || (e.button === 0 && state.isPanningMode)) {
                    e.preventDefault();
                    state.lastPanPoint = { x: e.clientX, y: e.clientY };
                    state.isPanning = true;
=======
                // 中键平移 或 空格+左键平移
                if (e.button === 1 || (e.button === 0 && state.isPanningMode)) {
                    e.preventDefault();
                    state.lastPanPoint = { x: e.clientX, y: e.clientY };
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
                    wrapper.style.cursor = 'grabbing';
                }
            });

            wrapper.addEventListener('mousemove', (e) => {
                if (!state.lastPanPoint) return;

                const dx = e.clientX - state.lastPanPoint.x;
                const dy = e.clientY - state.lastPanPoint.y;

<<<<<<< HEAD
                // 使用 Fabric.js 的 viewportTransform 实现统一平移
                const vpt = state.fabricCanvas.viewportTransform;
                vpt[4] += dx;
                vpt[5] += dy;

                state.lastPanPoint = { x: e.clientX, y: e.clientY };
=======
                state.canvasPan.x += dx;
                state.canvasPan.y += dy;

                state.lastPanPoint = { x: e.clientX, y: e.clientY };
                this.applyCanvasTransform();
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
            });

            wrapper.addEventListener('mouseup', (e) => {
                if (state.lastPanPoint) {
                    state.lastPanPoint = null;
<<<<<<< HEAD
                    state.isPanning = false;
                    state.fabricCanvas.requestRenderAll();  // 仅在结束时渲染一次
=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
                    wrapper.style.cursor = state.isPanningMode ? 'grab' : 'default';
                }
            });

            wrapper.addEventListener('mouseleave', (e) => {
                if (state.lastPanPoint) {
                    state.lastPanPoint = null;
<<<<<<< HEAD
                    state.isPanning = false;
                    state.fabricCanvas.requestRenderAll();  // 仅在结束时渲染一次
=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
                    wrapper.style.cursor = 'default';
                }
            });
        },

        // 应用画布缩放和平移变换
        applyCanvasTransform() {
            const canvas = state.fabricCanvas;
            const img = state.currentImage.element;
            if (!canvas || !img) return;

            // 计算图片在画布中的居中位置
            const wrapper = dom.canvasWrapper;
<<<<<<< HEAD

            // 使用 Fabric.js viewportTransform 统一处理缩放和平移
            const baseScale = Math.min(wrapper.clientWidth / img.width, wrapper.clientHeight / img.height);

            // 设置 viewportTransform: [scaleX, 0, 0, scaleY, translateX, translateY]
            const vpt = canvas.viewportTransform;
            vpt[0] = state.canvasZoom * baseScale;  // scaleX
            vpt[3] = state.canvasZoom * baseScale;  // scaleY
            vpt[4] = state.canvasPan.x + (wrapper.clientWidth - img.width * baseScale * state.canvasZoom) / 2;
            vpt[5] = state.canvasPan.y + (wrapper.clientHeight - img.height * baseScale * state.canvasZoom) / 2;

            canvas.requestRenderAll();
=======
            const imgWidth = img.width * img.scaleX;
            const imgHeight = img.height * img.scaleY;

            // 应用缩放和平移
            img.scaleX = img.scaleX / img.scaleX * img.width * state.canvasZoom;
            img.scaleY = img.scaleY / img.scaleY * img.height * state.canvasZoom;

            // 重置缩放基准
            const baseScale = Math.min(wrapper.clientWidth / img.width, wrapper.clientHeight / img.height);
            img.scaleX = baseScale * state.canvasZoom;
            img.scaleY = baseScale * state.canvasZoom;

            // 居中位置 + 平移偏移
            img.left = (wrapper.clientWidth - img.width * img.scaleX) / 2 + state.canvasPan.x;
            img.top = (wrapper.clientHeight - img.height * img.scaleY) / 2 + state.canvasPan.y;

            canvas.renderAll();
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66

            // 更新缩放指示器
            this.updateZoomIndicator();
        },

        // 重置画布视图
        resetCanvasView() {
            state.canvasZoom = 1;
            state.canvasPan = { x: 0, y: 0 };
<<<<<<< HEAD
            // 重置 viewportTransform 到默认状态
            const canvas = state.fabricCanvas;
            if (canvas) {
                canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
                canvas.requestRenderAll();
            }
            this.updateZoomIndicator();
=======
            this.applyCanvasTransform();
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
        },

        // 更新缩放指示器
        updateZoomIndicator() {
            const indicator = document.getElementById('zoom-indicator');
            if (indicator) {
                indicator.textContent = `${Math.round(state.canvasZoom * 100)}%`;
            }
        },

        // 切换平移模式
        togglePanMode() {
            state.isPanningMode = !state.isPanningMode;
            dom.canvasWrapper.style.cursor = state.isPanningMode ? 'grab' : 'default';

            // 更新按钮状态
            const panBtn = document.getElementById('pan-btn');
            if (panBtn) {
                panBtn.classList.toggle('active', state.isPanningMode);
            }

            // 平移模式和绘制模式互斥
            if (state.isPanningMode && state.isDrawingMode) {
                this.stopDrawingMode();
            }

            if (state.isPanningMode) {
                Notification.info('按住左键拖拽平移画布，滚轮缩放', '平移模式', 3000);
            }
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

        clearCanvas(skipConfirm = false) {
            return new Promise(async (resolve) => {
                const hasContent = state.fabricCanvas.getObjects().length > 0 || state.currentImage.file;
                if (hasContent && !skipConfirm) {
                    const confirmed = await ConfirmDialog.ask('确定要清空画布吗？未保存的标注将丢失。', '清空画布');
                    if (!confirmed) {
                        resolve(false);
                        return;
                    }
                }

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

                resolve(true);
            });
        },

        startDrawingMode() {
            if (!state.currentImage.element) {
                Notification.warning('请先上传一张图片！', '提示');
                return;
            }
            // 平移模式和绘制模式互斥
            if (state.isPanningMode) {
                state.isPanningMode = false;
                const panBtn = document.getElementById('pan-btn');
                if (panBtn) panBtn.classList.remove('active');
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
        
<<<<<<< HEAD
        // 记录操作到历史
        recordToHistory(action, data) {
            // 撤销后新操作会清空 redo 栈
            state.redoStack = [];
            state.history.push({ action, data, timestamp: Date.now() });
            state.hasUnsavedChanges = true;
            this.updateSaveStatus();
        },

        // 撤销
        undo() {
            if (state.history.length === 0) {
                Notification.info('没有可撤销的操作', '提示', 2000);
                return;
            }
            const lastAction = state.history.pop();
            state.redoStack.push(lastAction);

            if (lastAction.action === 'add') {
                // 撤销添加 -> 删除
                const rect = state.fabricCanvas.getObjects('rect').find(r =>
                    r.left === lastAction.data.left &&
                    r.top === lastAction.data.top &&
                    r.width === lastAction.data.width &&
                    r.height === lastAction.data.height
                );
                if (rect) state.fabricCanvas.remove(rect);
            } else if (lastAction.action === 'delete') {
                // 撤销删除 -> 恢复
                const rect = new fabric.Rect({
                    left: lastAction.data.left,
                    top: lastAction.data.top,
                    width: lastAction.data.width,
                    height: lastAction.data.height,
                    fill: lastAction.data.fill,
                    stroke: lastAction.data.stroke,
                    strokeWidth: lastAction.data.strokeWidth,
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                });
                state.fabricCanvas.add(rect);
            }
            state.fabricCanvas.renderAll();
            Notification.success('已撤销', '撤销成功', 2000);
        },

        // 重做
        redo() {
            if (state.redoStack.length === 0) {
                Notification.info('没有可重做的操作', '提示', 2000);
                return;
            }
            const action = state.redoStack.pop();
            state.history.push(action);

            if (action.action === 'add') {
                const rect = new fabric.Rect({
                    left: action.data.left,
                    top: action.data.top,
                    width: action.data.width,
                    height: action.data.height,
                    fill: action.data.fill,
                    stroke: action.data.stroke,
                    strokeWidth: action.data.strokeWidth,
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                });
                state.fabricCanvas.add(rect);
            } else if (action.action === 'delete') {
                const rect = state.fabricCanvas.getObjects('rect').find(r =>
                    r.left === action.data.left &&
                    r.top === action.data.top &&
                    r.width === action.data.width &&
                    r.height === action.data.height
                );
                if (rect) state.fabricCanvas.remove(rect);
            }
            state.fabricCanvas.renderAll();
            Notification.success('已重做', '重做成功', 2000);
        },

        undoLastBox() {
            const objects = state.fabricCanvas.getObjects('rect');
            if (objects.length > 0) {
                const lastRect = objects[objects.length - 1];
                this.recordToHistory('delete', {
                    left: lastRect.left,
                    top: lastRect.top,
                    width: lastRect.width,
                    height: lastRect.height,
                    fill: lastRect.fill,
                    stroke: lastRect.stroke,
                    strokeWidth: lastRect.strokeWidth,
                });
                state.fabricCanvas.remove(lastRect);
                Notification.success('已删除最后一个标注框', '删除成功', 2000);
=======
        undoLastBox() {
            const objects = state.fabricCanvas.getObjects('rect');
            if (objects.length > 0) {
                state.fabricCanvas.remove(objects[objects.length - 1]);
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
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

        // 将归一化的标注框粘贴到当前图片
        async pasteBoxesToCurrentImage(boxes) {
            const img = state.currentImage.element;
            if (!img || !boxes || boxes.length === 0) return;

            const imgLeft = img.left;
            const imgTop = img.top;
            const imgWidth = img.width * img.scaleX;
            const imgHeight = img.height * img.scaleY;

            // 清除现有标注框
            state.fabricCanvas.getObjects('rect').forEach(rect => {
                state.fabricCanvas.remove(rect);
            });

            // 添加新的标注框
            for (const box of boxes) {
                const [x_min, y_min, x_max, y_max] = box;
                const left = imgLeft + (x_min / 1000) * imgWidth;
                const top = imgTop + (y_min / 1000) * imgHeight;
                const width = ((x_max - x_min) / 1000) * imgWidth;
                const height = ((y_max - y_min) / 1000) * imgHeight;

                const rect = new fabric.Rect({
                    left: left,
                    top: top,
                    width: width,
                    height: height,
                    fill: 'rgba(234, 67, 53, 0.2)',
                    stroke: '#ea4335',
                    strokeWidth: 2,
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                });
                state.fabricCanvas.add(rect);
            }

            state.fabricCanvas.renderAll();
            Notification.success(`已粘贴 ${boxes.length} 个标注框`, '粘贴成功', 2000);

            // 自动保存
            if (state.currentTestCaseId) {
<<<<<<< HEAD
                await this.autoSaveAnnotation(true);  // 粘贴后保存需要更新缩略图
=======
                await this.autoSaveAnnotation();
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
            }
        },

        // --- 事件绑定 ---
        bindEventListeners() {
            // 键盘快捷键
            document.addEventListener('keydown', async (e) => {
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
<<<<<<< HEAD
                if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
                    e.preventDefault();
                    this.undo();
                }
                // Ctrl/Cmd + Shift + Z: 重做
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
                    e.preventDefault();
                    this.redo();
=======
                if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                    e.preventDefault();
                    this.undoLastBox();
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
                }
                // Delete: 删除选中框
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    const activeObject = state.fabricCanvas.getActiveObject();
                    if (activeObject && activeObject.type === 'rect') {
                        state.fabricCanvas.remove(activeObject);
                        Notification.success('标注框已删除', '删除成功', 2000);
<<<<<<< HEAD

                        // 自动保存到暂存区（类似 CVAT）
                        if (state.currentTestCaseId) {
                            this.saveToCache(state.currentTestCaseId);
                        }
=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
                    }
                }
                // 空格: 切换平移模式
                if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) {
                    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                        e.preventDefault();
                        this.togglePanMode();
                    }
                }
                // Ctrl/Cmd + 0: 重置视图
                if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                    e.preventDefault();
                    this.resetCanvasView();
                    Notification.success('视图已重置', '重置成功', 2000);
                }
                // Ctrl/Cmd + C: 复制选中框
                if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                    const activeObject = state.fabricCanvas.getActiveObject();
                    if (activeObject && activeObject.type === 'rect') {
                        state.clipboardBox = {
                            left: activeObject.left,
                            top: activeObject.top,
                            width: activeObject.width,
                            height: activeObject.height
                        };
                        Notification.success('标注框已复制', '复制成功', 2000);
                    }
                }
                // Ctrl/Cmd + V: 粘贴标注框
                if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                    if (state.clipboardBox) {
                        const newRect = new fabric.Rect({
                            left: state.clipboardBox.left + 20,
                            top: state.clipboardBox.top + 20,
                            width: state.clipboardBox.width,
                            height: state.clipboardBox.height,
                            fill: 'rgba(234, 67, 53, 0.2)',
                            stroke: '#ea4335',
                            strokeWidth: 2,
                            selectable: true,
                            evented: true,
                            hasControls: true,
                            hasBorders: true,
                        });
                        state.fabricCanvas.add(newRect);
                        state.fabricCanvas.setActiveObject(newRect);
                        Notification.success('标注框已粘贴', '粘贴成功', 2000);

                        // 自动保存
                        if (state.currentTestCaseId) {
                            this.autoSaveAnnotation();
                        }
                    }
                }
                // Ctrl/Cmd + Shift + V: 复制当前所有标注框到下一张
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
                    e.preventDefault();
                    // 获取当前所有标注框
                    const currentBoxes = this.getNormalizedBoxes();
                    if (currentBoxes.length === 0) {
                        Notification.warning('当前没有标注框可复制', '提示');
                        return;
                    }
                    // 保存到剪贴板
                    state.clipboardBoxes = currentBoxes;
                    // 切换到下一张并自动粘贴
                    const currentIndex = state.testCases.findIndex(tc => tc.id == state.currentTestCaseId);
                    if (currentIndex < state.testCases.length - 1) {
                        Notification.info(`已复制 ${currentBoxes.length} 个标注框，正在切换到下一张...`, '复制标注', 2000);
                        await this.nextTestCase();
                        // 延迟粘贴，等待画布加载
                        setTimeout(() => {
                            this.pasteBoxesToCurrentImage(state.clipboardBoxes);
                        }, 500);
                    } else {
                        Notification.warning('已经是最后一张图片了', '提示');
                    }
                }
                // ESC: 关闭模态框或退出绘制模式或退出平移模式
                if (e.key === 'Escape') {
                    // 优先关闭模态框
                    if (dom.modalBackdrop.style.display === 'block') {
                        this.hideModals();
                    } else if (state.isPanningMode) {
                        this.togglePanMode();
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
<<<<<<< HEAD
            dom.undoBtn.onclick = () => this.undo();
=======
            dom.undoBtn.onclick = () => this.undoLastBox();
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
            dom.addTestCaseBtn.onclick = () => this.addTestCase();
            if (dom.updateAnnotationBtn) {
                dom.updateAnnotationBtn.onclick = () => this.updateAnnotation();
            }
            dom.clearCanvasBtn.onclick = () => this.clearCanvas();

<<<<<<< HEAD
            // 自动保存间隔选择
            const autoSaveInterval = document.getElementById('auto-save-interval');
            if (autoSaveInterval) {
                autoSaveInterval.onchange = (e) => {
                    this.setAutoSaveInterval(parseInt(e.target.value));
                    Notification.success(`自动保存间隔已设置为 ${e.target.value === '0' ? '关闭' : e.target.options[e.target.selectedIndex].text}`, '设置成功', 2000);
                };
            }

=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
            // 新增按钮事件
            const panBtn = document.getElementById('pan-btn');
            if (panBtn) {
                panBtn.onclick = () => this.togglePanMode();
            }

            const resetViewBtn = document.getElementById('reset-view-btn');
            if (resetViewBtn) {
                resetViewBtn.onclick = () => this.resetCanvasView();
            }

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
                    // 点击自动标注按钮
                    if (target.classList.contains('auto-annotate-btn')) {
                        e.stopPropagation();
                        this.startSingleAutoAnnotate(parseInt(target.dataset.id));
                        return;
                    }
                    // 点击缩略图
                    const thumbnailItem = target.closest('.thumbnail-item');
                    if (thumbnailItem && !target.classList.contains('delete-test-case-btn') && !target.classList.contains('auto-annotate-btn')) {
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

<<<<<<< HEAD
            // 右键菜单功能
            if (dom.boxContextMenu) {
                dom.boxContextMenu.addEventListener('click', (e) => {
                    const target = e.target.closest('.context-menu-item');
                    if (!target) return;
                    if (target.id === 'ctx-delete-box') {
                        const activeObject = state.fabricCanvas.getActiveObject();
                        if (activeObject && activeObject.type === 'rect') {
                            state.fabricCanvas.remove(activeObject);
                            Notification.success('标注框已删除', '删除成功', 2000);
                            // 自动保存到暂存区（类似 CVAT）
                            if (state.currentTestCaseId) {
                                this.saveToCache(state.currentTestCaseId);
                            }
                        }
                    }
                    dom.boxContextMenu.style.display = 'none';
                });

                // 画布右键菜单
                dom.canvasWrapper.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    const activeObject = state.fabricCanvas.getActiveObject();
                    if (activeObject && activeObject.type === 'rect') {
                        dom.boxContextMenu.style.display = 'block';
                        dom.boxContextMenu.style.left = e.offsetX + 'px';
                        dom.boxContextMenu.style.top = e.offsetY + 'px';
                    }
                });

                // 点击其他地方关闭右键菜单
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.context-menu')) {
                        dom.boxContextMenu.style.display = 'none';
                    }
                });
            }

=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
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

            // 自动标注按钮
            if (dom.batchAutoAnnotateBtn) {
                dom.batchAutoAnnotateBtn.onclick = () => this.startAutoAnnotate();
            }

            // 批量缺陷自动标注按钮
            if (dom.batchDefectAutoAnnotateBtn) {
                dom.batchDefectAutoAnnotateBtn.onclick = () => this.showBatchDefectAnnotateModal();
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

            const confirmed = await ConfirmDialog.ask(`确定要删除选中的 ${state.batchSelectedIds.length} 个测试用例吗？此操作不可撤销。`, '删除确认');
            if (!confirmed) {
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

        // --- 自动标注相关方法 ---
        async startAutoAnnotate() {
            if (!state.currentDefectId) {
                Notification.warning('请先选择一个缺陷类别', '提示');
                return;
            }

            if (state.batchSelectedIds.length === 0) {
                Notification.warning('请先选择要标注的测试用例', '提示');
                return;
            }

            const result = await ConfirmDialog.askWithCheckbox(
                `将对选中的 ${state.batchSelectedIds.length} 个测试用例进行自动标注。`,
                '清除现有标注框',
                true
            );

            if (!result.confirmed) return;

            const clearExisting = result.checkboxValue;

            Loading.show('正在启动自动标注任务...');

            try {
                const result = await api.post(`/api/auto_annotate/defect/${state.currentDefectId}`, {
                    clear_existing_boxes: clearExisting,
                    test_case_ids: state.batchSelectedIds
                });

                Loading.hide();

                if (result.success) {
                    Notification.success(`自动标注任务已启动，共 ${result.total_images} 张图片`, '任务创建成功');
                    this.pollAutoAnnotateStatus(result.task_id);
                } else {
                    Notification.error(result.error || '启动失败', '自动标注失败');
                }
            } catch (error) {
                Loading.hide();
                Notification.error(`启动失败: ${error.message}`, '自动标注失败');
            }
        },

        // 单图自动标注
        async startSingleAutoAnnotate(testCaseId) {
            if (!state.currentDefectId) {
                Notification.warning('请先选择一个缺陷类别', '提示');
                return;
            }

<<<<<<< HEAD
            // 使用新的模态框显示确认对话框
            this.showSingleDefectAnnotateModal(testCaseId);
=======
            const testCase = state.testCases.find(tc => tc.id === testCaseId);
            const testCaseName = testCase ? testCase.filename : `ID: ${testCaseId}`;

            const result = await ConfirmDialog.askWithCheckbox(
                `对「${testCaseName}」进行自动标注？`,
                '清除现有标注框',
                true
            );

            if (!result.confirmed) return;

            const clearExisting = result.checkboxValue;

            // 设置按钮为加载状态
            const btn = document.querySelector(`.auto-annotate-btn[data-id="${testCaseId}"]`);
            if (btn) {
                btn.classList.add('loading');
                btn.disabled = true;
            }

            Loading.show(`正在自动标注「${testCaseName}」...`);

            try {
                const result = await api.post(`/api/auto_annotate/defect/${state.currentDefectId}`, {
                    clear_existing_boxes: clearExisting,
                    test_case_ids: [testCaseId]
                });

                Loading.hide();

                if (result.success) {
                    Notification.success(`自动标注任务已启动`, '任务创建成功');
                    this.pollAutoAnnotateStatus(result.task_id);
                } else {
                    Notification.error(result.error || '启动失败', '自动标注失败');
                    if (btn) {
                        btn.classList.remove('loading');
                        btn.disabled = false;
                    }
                }
            } catch (error) {
                Loading.hide();
                Notification.error(`启动失败: ${error.message}`, '自动标注失败');
                if (btn) {
                    btn.classList.remove('loading');
                    btn.disabled = false;
                }
            }
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
        },

        async pollAutoAnnotateStatus(taskId) {
            const pollInterval = 2000; // 2秒轮询一次
            const maxAttempts = 150; // 最多轮询150次（5分钟）
            let attempts = 0;

            const poll = async () => {
                attempts++;
                try {
                    const status = await api.get(`/api/auto_annotate/task/${taskId}`);

                    if (status.status === 'completed') {
<<<<<<< HEAD
                        Loading.hide();
=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
                        Notification.success(
                            `自动标注完成！共生成 ${status.total_boxes_created} 个标注框`,
                            '任务完成'
                        );
                        // 刷新测试用例列表以显示新的标注框
                        const data = await api.get(`/api/defect/${state.currentDefectId}`);
                        state.testCases = data.test_cases;
                        this.renderTestCases();
                        return;
                    }

                    if (status.status === 'failed') {
<<<<<<< HEAD
                        Loading.hide();
=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
                        Notification.error(status.error_message || '处理失败', '自动标注失败');
                        return;
                    }

                    // 任务仍在进行中
                    if (attempts < maxAttempts) {
                        Loading.show(`自动标注中... (${status.processed_images}/${status.total_images})`);
                        setTimeout(poll, pollInterval);
                    } else {
                        Loading.hide();
                        Notification.warning('任务超时，请稍后刷新查看结果', '超时');
                    }
                } catch (error) {
                    console.error('轮询状态失败:', error);
                    if (attempts < maxAttempts) {
                        setTimeout(poll, pollInterval);
                    } else {
                        Loading.hide();
                        Notification.error('无法获取任务状态', '错误');
                    }
                }
            };

            poll();
        },

        // --- 批量缺陷自动标注 ---
        showBatchDefectAnnotateModal() {
            if (!dom.batchDefectAnnotateModal) return;

            // 重置模态框状态
            document.getElementById('batch-defect-list').innerHTML = '';
            document.getElementById('batch-defect-error').style.display = 'none';
            document.getElementById('batch-defect-loading').style.display = 'flex';
            document.getElementById('batch-defect-execute-btn').disabled = true;

            this.showModals();
            dom.batchDefectAnnotateModal.style.display = 'block';

            // 初始化事件（只绑定一次）
            if (!this.batchDefectAnnotateEventsInitialized) {
                const modal = dom.batchDefectAnnotateModal;
                modal.querySelector('.modal-close').onclick = () => this.hideBatchDefectAnnotateModal();
                modal.querySelector('.modal-cancel').onclick = () => this.hideBatchDefectAnnotateModal();
                document.getElementById('batch-defect-execute-btn').onclick = () => this.executeBatchDefectAnnotate();
                this.batchDefectAnnotateEventsInitialized = true;
            }

            // 加载服务缺陷列表
            this.loadBatchDefectList();
        },

        hideBatchDefectAnnotateModal() {
            if (dom.batchDefectAnnotateModal) {
                dom.batchDefectAnnotateModal.style.display = 'none';
            }
            // 隐藏背景遮罩
            dom.modalBackdrop.style.display = 'none';
        },

<<<<<<< HEAD
        // --- 单图自动标注模态框 ---
        currentSingleAnnotateTestCaseId: null,

        showSingleDefectAnnotateModal(testCaseId) {
            if (!dom.singleDefectAnnotateModal) return;

            const testCase = state.testCases.find(tc => tc.id === testCaseId);
            if (!testCase) return;

            this.currentSingleAnnotateTestCaseId = testCaseId;

            // 更新目标图片名称
            document.getElementById('single-defect-target-name').textContent = testCase.filename;

            // 重置复选框状态
            document.getElementById('single-defect-clear-existing').checked = true;

            this.showModals();
            dom.singleDefectAnnotateModal.style.display = 'block';

            // 初始化事件（只绑定一次）
            if (!this.singleDefectAnnotateEventsInitialized) {
                const modal = dom.singleDefectAnnotateModal;
                modal.querySelector('.modal-close').onclick = () => this.hideSingleDefectAnnotateModal();
                modal.querySelector('.modal-cancel').onclick = () => this.hideSingleDefectAnnotateModal();
                document.getElementById('single-defect-execute-btn').onclick = () => this.executeSingleDefectAnnotate();
                this.singleDefectAnnotateEventsInitialized = true;
            }
        },

        hideSingleDefectAnnotateModal() {
            if (dom.singleDefectAnnotateModal) {
                dom.singleDefectAnnotateModal.style.display = 'none';
            }
            // 隐藏背景遮罩
            dom.modalBackdrop.style.display = 'none';
            this.currentSingleAnnotateTestCaseId = null;
        },

        async executeSingleDefectAnnotate() {
            const testCaseId = this.currentSingleAnnotateTestCaseId;
            if (!testCaseId || !state.currentDefectId) {
                Notification.warning('请先选择一个缺陷类别', '提示');
                return;
            }

            const testCase = state.testCases.find(tc => tc.id === testCaseId);
            const testCaseName = testCase ? testCase.filename : `ID: ${testCaseId}`;
            const clearExisting = document.getElementById('single-defect-clear-existing').checked;

            this.hideSingleDefectAnnotateModal();

            // 设置按钮为加载状态
            const btn = document.querySelector(`.auto-annotate-btn[data-id="${testCaseId}"]`);
            if (btn) {
                btn.classList.add('loading');
                btn.disabled = true;
            }

            Loading.show(`正在自动标注「${testCaseName}」...`);

            try {
                const result = await api.post(`/api/auto_annotate/defect/${state.currentDefectId}`, {
                    clear_existing_boxes: clearExisting,
                    test_case_ids: [testCaseId]
                });

                Loading.hide();

                if (result.success) {
                    Notification.success(`自动标注任务已启动`, '任务创建成功');
                    this.pollAutoAnnotateStatus(result.task_id);
                } else {
                    Notification.error(result.error || '启动失败', '自动标注失败');
                    if (btn) {
                        btn.classList.remove('loading');
                        btn.disabled = false;
                    }
                }
            } catch (error) {
                Loading.hide();
                Notification.error(`启动失败: ${error.message}`, '自动标注失败');
                if (btn) {
                    btn.classList.remove('loading');
                    btn.disabled = false;
                }
            }
        },

=======
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
        async loadBatchDefectList() {
            const loadingEl = document.getElementById('batch-defect-loading');
            const listEl = document.getElementById('batch-defect-list');
            const errorEl = document.getElementById('batch-defect-error');
            const errorMsgEl = document.getElementById('batch-defect-error-msg');
            const executeBtn = document.getElementById('batch-defect-execute-btn');

            try {
                // 调用服务测试接口获取缺陷列表
                const result = await api.post('/api/trueno3_service_test', {});

                loadingEl.style.display = 'none';

                if (!result.success) {
                    errorEl.style.display = 'flex';
                    errorMsgEl.textContent = result.error || '无法连接到自动标注服务';
                    return;
                }

                const functions = result.functions || [];
                const matchedDefects = result.matched_defects || [];

                if (functions.length === 0) {
                    errorEl.style.display = 'flex';
                    errorMsgEl.textContent = '服务没有可用的缺陷定义';
                    return;
                }

                // 创建缺陷名称到中文名的映射
                const matchedMap = {};
                matchedDefects.forEach(d => {
                    matchedMap[d.name] = d.defect_cn;
                });

                // 渲染缺陷列表
                listEl.innerHTML = functions.map(f => {
                    const isMatched = matchedMap[f.funID];
                    return `
                        <div class="batch-defect-item ${isMatched ? '' : 'no-match'}" data-name="${f.funID}">
                            <input type="checkbox" value="${f.funID}" ${isMatched ? 'checked' : ''}>
                            <div class="defect-info">
                                <div class="defect-name">${f.funID}</div>
                                <div class="defect-desc">${f.funDesc || '无描述'}</div>
                            </div>
                            <span class="defect-status ${isMatched ? '' : 'no-match'}">
                                ${isMatched ? '已匹配' : '未匹配'}
                            </span>
                        </div>
                    `;
                }).join('');

                // 绑定点击事件
                listEl.querySelectorAll('.batch-defect-item').forEach(item => {
                    item.onclick = (e) => {
                        if (e.target.tagName === 'INPUT') return;
                        const checkbox = item.querySelector('input[type="checkbox"]');
                        checkbox.checked = !checkbox.checked;
                        item.classList.toggle('selected', checkbox.checked);
                        this.updateBatchDefectExecuteBtn();
                    };

                    item.querySelector('input[type="checkbox"]').onchange = () => {
                        item.classList.toggle('selected', item.querySelector('input[type="checkbox"]').checked);
                        this.updateBatchDefectExecuteBtn();
                    };
                });

                // 更新执行按钮状态
                this.updateBatchDefectExecuteBtn();

            } catch (error) {
                loadingEl.style.display = 'none';
                errorEl.style.display = 'flex';
                errorMsgEl.textContent = error.message || '加载失败';
            }
        },

        updateBatchDefectExecuteBtn() {
            const checkedItems = document.querySelectorAll('#batch-defect-list input[type="checkbox"]:checked');
            const executeBtn = document.getElementById('batch-defect-execute-btn');
            executeBtn.disabled = checkedItems.length === 0;
        },

        async executeBatchDefectAnnotate() {
            const checkedItems = document.querySelectorAll('#batch-defect-list input[type="checkbox"]:checked');
            const defectNames = Array.from(checkedItems).map(item => item.value);
            const clearExisting = document.getElementById('batch-defect-clear-existing').checked;

            if (defectNames.length === 0) {
                Notification.warning('请选择要自动标注的缺陷', '提示');
                return;
            }

            const confirmed = await ConfirmDialog.ask(
                `将对 ${defectNames.length} 个缺陷进行自动标注。\n\n` +
                `已选择的缺陷：${defectNames.join(', ')}\n\n` +
                `${clearExisting ? '⚠️ 将清除现有标注框' : '保留现有标注框'}`,
                '批量自动标注确认'
            );

            if (!confirmed) return;

            Loading.show('正在启动批量自动标注任务...');

            try {
                const result = await api.post('/api/auto_annotate/batch_defects', {
                    defect_names: defectNames,
                    clear_existing_boxes: clearExisting
                });

                Loading.hide();

                if (result.success) {
                    Notification.success(result.message, '批量标注已启动');
                    this.hideBatchDefectAnnotateModal();

                    // 显示任务详情
                    if (result.tasks && result.tasks.length > 0) {
                        const taskDetails = result.tasks.map(t =>
                            `${t.defect_name}: ${t.total_images} 张图片`
                        ).join('\n');
                        console.log('创建的任务:', taskDetails);
                    }

                    if (result.errors && result.errors.length > 0) {
                        Notification.warning(result.errors.join('\n'), '部分缺陷处理失败');
                    }
                } else {
                    Notification.error(result.error || '启动失败', '批量标注失败');
                }
            } catch (error) {
                Loading.hide();
                Notification.error(error.message || '请求失败', '批量标注失败');
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
<<<<<<< HEAD
        async autoSaveAnnotation(showNotification = false) {
=======
        async autoSaveAnnotation() {
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
            if (!state.currentTestCaseId) return;

            const boxes = this.getNormalizedBoxes();
            if (boxes.length === 0) return;

            try {
                const result = await api.put(`/api/testcase/${state.currentTestCaseId}/boxes`, { boxes });
                if (result.success) {
<<<<<<< HEAD
                    // 更新暂存区状态
                    if (state.annotationCache[state.currentTestCaseId]) {
                        state.annotationCache[state.currentTestCaseId].isDirty = false;
                        state.annotationCache[state.currentTestCaseId].lastSaved = Date.now();
                    }
                    state.hasUnsavedChanges = false;
                    this.updateSaveStatus();

                    // 静默更新预览图（只在显式保存时更新缩略图）
                    if (showNotification) {
                        const testCase = state.testCases.find(tc => tc.id == state.currentTestCaseId);
                        if (testCase) {
                            testCase.preview_url = testCase.filepath + '?t=' + Date.now();
                        }
                        Notification.success('标注已保存', '保存成功', 1500);
                    }
=======
                    // 静默更新预览图，不刷新整个列表以避免干扰用户
                    const testCase = state.testCases.find(tc => tc.id == state.currentTestCaseId);
                    if (testCase) {
                        testCase.preview_url = testCase.filepath + '?t=' + Date.now();
                    }
                    // 显示一个微妙的提示
                    Notification.success('标注已自动保存', '保存成功', 1500);
>>>>>>> 975b1e21b4d97f7d3cd9d5cbcb5947b9aaa5ca66
                }
            } catch (error) {
                console.error('自动保存失败:', error);
            }
        },

        async deleteTestCase(testCaseId) {
            const confirmed = await ConfirmDialog.ask('确定要删除这个测试用例吗？此操作不可撤销。', '删除确认');
            if (!confirmed) return;

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
                model_name: this.modelSelectorCombo ? this.modelSelectorCombo.getValue() : '',
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
                model_name: this.modelSelectorCombo ? this.modelSelectorCombo.getValue() : '',
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
            if (dom.batchDefectAnnotateModal) dom.batchDefectAnnotateModal.style.display = 'none';
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
                            <label>默认模型 <span class="hint">（可选择或手动输入）</span></label>
                            <div id="settings-default-model-container"></div>
                            <div style="margin-top: 8px;">
                                <button id="test-model-btn" class="btn-secondary">🧪 测试模型可用性</button>
                                <span id="model-test-result" class="hint"></span>
                            </div>
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

                        <!-- Trueno3 服务配置 (自动标注) -->
                        <div class="settings-section-divider">
                            <h4>🔧 自动标注服务配置</h4>
                            <p class="hint">配置Trueno3分析服务地址，用于自动标注功能</p>
                        </div>
                        <div class="form-row">
                            <div class="form-item">
                                <label>服务主机</label>
                                <input type="text" id="settings-service-host" value="${safeTrueno3Config.service_host || safeTrueno3Config.ssh_host || ''}" placeholder="默认使用SSH主机">
                            </div>
                            <div class="form-item">
                                <label>服务端口</label>
                                <input type="number" id="settings-service-port" value="${safeTrueno3Config.service_port || 20011}" min="1" max="65535">
                            </div>
                        </div>
                        <div class="form-item">
                            <label>API路径</label>
                            <input type="text" id="settings-api-path" value="${safeTrueno3Config.api_path || '/picAnalyse'}" placeholder="/picAnalyse">
                        </div>

                        <!-- 回调配置 -->
                        <div class="settings-section-divider">
                            <h4>📥 回调配置</h4>
                            <p class="hint">本服务的地址，用于接收Trueno3的异步回调结果</p>
                        </div>
                        <div class="form-row">
                            <div class="form-item">
                                <label>本服务IP</label>
                                <input type="text" id="settings-callback-host" value="${safeTrueno3Config.callback_host || ''}" placeholder="192.168.1.50">
                            </div>
                            <div class="form-item">
                                <label>本服务端口</label>
                                <input type="number" id="settings-callback-port" value="${safeTrueno3Config.callback_port || 5001}" min="1" max="65535">
                            </div>
                        </div>
                        <div class="form-item">
                            <button id="test-trueno3-service-btn" class="btn-secondary">🔍 测试服务连通性</button>
                            <span id="trueno3-service-test-result" class="hint"></span>
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
            
            // 初始化默认模型组合选择器
            const defaultModelContainer = document.getElementById('settings-default-model-container');
            const defaultModelCombo = new ComboSelect({
                placeholder: '选择默认模型...',
                searchPlaceholder: '搜索模型名称...',
                onChange: (model) => {
                    console.log('Selected model:', model);
                }
            });
            defaultModelContainer.appendChild(defaultModelCombo.create());
            
            // 加载模型列表并设置当前值
            this.loadModelsForCombo(defaultModelCombo, safeLlmConfig.default_model);
            
            // 保存组合选择器实例以便后续获取值
            this.defaultModelCombo = defaultModelCombo;

            // 监听 API Key 和 API URL 变化，自动刷新模型列表
            let refreshModelsTimeout = null;
            const refreshModelsPreview = async () => {
                const apiKey = document.getElementById('settings-api-key').value;
                const apiUrl = document.getElementById('settings-api-url').value;

                if (!apiKey || !apiUrl) {
                    return;
                }

                try {
                    // 显示加载状态
                    defaultModelCombo.setLoading(true);

                    const result = await api.post('/api/models/preview', {
                        api_key: apiKey,
                        api_url: apiUrl
                    });

                    const models = result.models || [];
                    defaultModelCombo.setModels(models);

                    // 如果有模型，默认选中第一个
                    if (models.length > 0) {
                        defaultModelCombo.setValue(models[0].id);
                    }
                } catch (error) {
                    console.error('刷新模型列表失败:', error);
                    defaultModelCombo.setModels([]);
                    defaultModelCombo.input.value = '获取模型失败';
                }
            };

            // 使用防抖，避免频繁请求
            const debouncedRefreshModels = () => {
                if (refreshModelsTimeout) {
                    clearTimeout(refreshModelsTimeout);
                }
                refreshModelsTimeout = setTimeout(refreshModelsPreview, 500);
            };

            // 绑定输入框变化事件
            document.getElementById('settings-api-key').addEventListener('input', debouncedRefreshModels);
            document.getElementById('settings-api-url').addEventListener('input', debouncedRefreshModels);

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

            // 测试 Trueno3 服务连通性
            document.getElementById('test-trueno3-service-btn').onclick = async () => {
                const resultSpan = document.getElementById('trueno3-service-test-result');
                resultSpan.textContent = ' 测试中...';
                resultSpan.style.color = 'var(--text-secondary)';

                // 获取服务配置
                let serviceHost = document.getElementById('settings-service-host').value;
                const servicePort = parseInt(document.getElementById('settings-service-port').value) || 20011;

                // 如果没有填写服务主机，使用SSH主机
                if (!serviceHost) {
                    serviceHost = document.getElementById('settings-trueno3-host').value;
                }

                if (!serviceHost) {
                    resultSpan.textContent = ' ✗ 请填写服务主机或SSH主机';
                    resultSpan.style.color = '#ea4335';
                    return;
                }

                try {
                    const result = await api.post('/api/trueno3_service_test', {
                        service_host: serviceHost,
                        service_port: servicePort
                    });

                    if (result.success) {
                        let message = ` ✓ ${result.message}`;
                        if (result.matched_defects && result.matched_defects.length > 0) {
                            message += `，匹配 ${result.matched_defects.length} 个缺陷定义`;
                        }
                        resultSpan.textContent = message;
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

            // 测试模型可用性
            document.getElementById('test-model-btn').onclick = async () => {
                const resultSpan = document.getElementById('model-test-result');
                const modelName = this.defaultModelCombo ? this.defaultModelCombo.getValue() : '';

                if (!modelName) {
                    resultSpan.textContent = ' ✗ 请先选择或输入模型名称';
                    resultSpan.style.color = '#ea4335';
                    return;
                }

                const apiKey = document.getElementById('settings-api-key').value;
                const apiUrl = document.getElementById('settings-api-url').value;

                if (!apiKey) {
                    resultSpan.textContent = ' ✗ 请输入 API Key';
                    resultSpan.style.color = '#ea4335';
                    return;
                }

                if (!apiUrl) {
                    resultSpan.textContent = ' ✗ 请输入 API URL';
                    resultSpan.style.color = '#ea4335';
                    return;
                }

                resultSpan.textContent = ' 测试中...';
                resultSpan.style.color = 'var(--text-secondary)';

                try {
                    const result = await api.post('/api/models/test', {
                        api_key: apiKey,
                        api_url: apiUrl,
                        model_name: modelName
                    });

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
                    default_model: this.defaultModelCombo ? this.defaultModelCombo.getValue() : '',
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
                    // 服务配置 (用于自动标注)
                    service_host: document.getElementById('settings-service-host').value,
                    service_port: parseInt(document.getElementById('settings-service-port').value) || 20011,
                    api_path: document.getElementById('settings-api-path').value || '/picAnalyse',
                    // 回调配置
                    callback_host: document.getElementById('settings-callback-host').value,
                    callback_port: parseInt(document.getElementById('settings-callback-port').value) || 5001,
                };
                await api.post('/api/trueno3_config', trueno3Data);

                // 刷新实时推理对比处的模型选择器，使用最新的默认模型
                await this.refreshInferenceModelSelector();
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
