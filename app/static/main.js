
document.addEventListener('DOMContentLoaded', () => {
    // --- 全局状态管理 ---
    const state = {
        currentDefectId: null,
        currentVersionId: null,
        currentTestCaseId: null,
        currentImage: {
            file: null, // 保存新上传的文件对象
            element: null,
            originalWidth: 0,
            originalHeight: 0,
            scaleFactor: 1,
        },
        defectVersions: [],
        testCases: [],
        fabricCanvas: null,
        isDrawingMode: false,
        history: [], // 用于撤销操作
        pollingInterval: null, // 用于轮询
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
        defectTitle: document.getElementById('defect-title'),
        defectVersionTag: document.getElementById('defect-version-tag'),
        versionDropdown: document.getElementById('version-dropdown'),
        publishVersionBtn: document.getElementById('publish-version-btn'),
        editorGrid: document.getElementById('defect-editor-grid'),
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        savePreviewBtn: document.getElementById('save-preview-btn'),
        modelSelector: document.getElementById('model-selector'),
        
        canvasWrapper: document.getElementById('canvas-wrapper'),
        annotationCanvas: document.getElementById('annotation-canvas'),
        uploadPlaceholder: document.getElementById('upload-placeholder'),
        imageUploadInput: document.getElementById('image-upload-input'),
        
        testCaseList: document.getElementById('test-case-list'),
        drawBoxBtn: document.getElementById('draw-box-btn'),
        undoBtn: document.getElementById('undo-btn'),
        addTestCaseBtn: document.getElementById('add-test-case-btn'),
        clearCanvasBtn: document.getElementById('clear-canvas-btn'),

        tabs: document.querySelectorAll('.tab-link'),
        tabContents: document.querySelectorAll('.tab-content'),
        comparisonContainer: document.getElementById('comparison-container'),
        historyTableBody: document.querySelector('#history-table tbody'),
        
        modalBackdrop: document.getElementById('modal-backdrop'),
        globalTemplateModal: document.getElementById('global-template-modal'),
        addDefectModal: document.getElementById('add-defect-modal'),
        settingsModal: document.getElementById('settings-modal'),
        
        addDefectBtn: document.getElementById('add-defect-btn'),
        editGlobalTemplateBtn: document.getElementById('edit-global-template-btn'),
        runRegressionBtn: document.getElementById('run-regression-btn'),
        runComparisonBtn: document.getElementById('run-comparison-btn'),
        themeToggle: document.getElementById('theme-toggle'),
        settingsBtn: document.getElementById('settings-btn'),
    };

    // --- API 封装 ---
    const api = {
        get: async (url) => (await fetch(url)).json(),
        post: async (url, data) => (await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })).json(),
        upload: async (url, formData) => (await fetch(url, {
            method: 'POST',
            body: formData,
        })).json(),
        delete: async (url) => (await fetch(url, { method: 'DELETE' })).json(),
    };

    // --- App 主逻辑 ---
    const App = {
        init() {
            this.initTheme();
            this.initCanvas();
            this.bindEventListeners();
            this.loadDefects();
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

        updateThemeIcon(theme) {
            if (dom.themeToggle) {
                dom.themeToggle.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
            }
        },

        showInitialState() {
            dom.defectTitle.textContent = '请选择一个缺陷类别';
            dom.defectVersionTag.textContent = '';
            dom.editorGrid.innerHTML = '<p class="placeholder-text">从左侧选择一个缺陷类别以开始。</p>';
            dom.testCaseList.innerHTML = '';
            dom.versionDropdown.innerHTML = '';
            dom.comparisonContainer.innerHTML = '';
            dom.historyTableBody.innerHTML = '<tr><td colspan="4">选择一个缺陷类别以查看历史记录。</td></tr>';
            this.clearCanvas();
        },

        // --- 核心渲染方法 ---
        async loadDefects() {
            const defects = await api.get('/api/defects');
            dom.defectList.innerHTML = defects.map(d => 
                `<a href="#" data-id="${d.id}">${d.name}</a>`
            ).join('');
            this.showInitialState();
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

        async selectDefect(defectId) {
            if (state.currentDefectId === defectId) return;
            state.currentDefectId = defectId;

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

        selectVersion(versionId) {
            if (!versionId) {
                this.clearEditor();
                return;
            }
            state.currentVersionId = versionId;
            dom.versionDropdown.value = versionId;
            const version = state.defectVersions.find(v => v.id == versionId);
            if (version) {
                this.renderDefectVersion(version);
                dom.defectVersionTag.textContent = `v${version.version}`;
            }
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
            dom.testCaseList.innerHTML = state.testCases.map(tc => `
                <div class="test-case-item">
                    <img src="/${tc.preview_url}" data-id="${tc.id}" alt="Test Case ${tc.id}" title="${tc.filename}">
                    <button class="delete-test-case-btn" data-id="${tc.id}" title="删除此测试用例">&times;</button>
                </div>
            `).join('');
        },

        async loadTestCase(testCaseId) {
            if (state.currentTestCaseId === testCaseId) return;
            state.currentTestCaseId = testCaseId;
            state.currentImage.file = null;

            document.querySelectorAll('.test-case-item img').forEach(img => {
                img.classList.toggle('selected', img.dataset.id == testCaseId);
            });
            
            const testCase = state.testCases.find(tc => tc.id == testCaseId);
            if (testCase) {
                await this.loadImageOnCanvas(`/${testCase.filepath}`);
                state.fabricCanvas.remove(...state.fabricCanvas.getObjects('rect'));
                const boxes = await api.get(`/api/testcase/${testCaseId}/boxes`);
                boxes.forEach(box => {
                    const rect = new fabric.Rect({
                        left: box.norm_x_min / 999 * state.currentImage.element.width,
                        top: box.norm_y_min / 999 * state.currentImage.element.height,
                        width: (box.norm_x_max - box.norm_x_min) / 999 * state.currentImage.element.width,
                        height: (box.norm_y_max - box.norm_y_min) / 999 * state.currentImage.element.height,
                        fill: 'rgba(255, 0, 0, 0.2)',
                        stroke: 'red',
                        strokeWidth: 2,
                    });
                    state.fabricCanvas.add(rect);
                });
            }
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
            state.fabricCanvas.on('mouse:up', (e) => {
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
            });
            
            // 双击删除标注框
            state.fabricCanvas.on('mouse:dblclick', (e) => {
                const target = e.target;
                if (target && target.type === 'rect') {
                    state.fabricCanvas.remove(target);
                    Notification.success('标注框已删除', '删除成功', 2000);
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
                // Ctrl/Cmd + S: 保存
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    if (state.currentDefectId) this.saveAsNewVersion();
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
                // ESC: 退出绘制模式
                if (e.key === 'Escape') {
                    if (state.isDrawingMode) this.stopDrawingMode();
                }
            });

            // 左侧缺陷列表
            dom.defectList.addEventListener('click', (e) => {
                e.preventDefault();
                if (e.target.tagName === 'A') {
                    this.selectDefect(e.target.dataset.id);
                }
            });

            // 版本下拉菜单
            dom.versionDropdown.addEventListener('change', () => {
                this.selectVersion(dom.versionDropdown.value);
            });

            // 模块一按钮
            dom.cancelEditBtn.onclick = () => this.selectVersion(state.currentVersionId);
            dom.savePreviewBtn.onclick = () => {
                this.runComparison(true);
                // 自动滚动到推理对比区域
                document.getElementById('comparison-container').scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            };
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
            dom.clearCanvasBtn.onclick = () => this.clearCanvas();
            dom.testCaseList.addEventListener('click', (e) => {
                const target = e.target;
                if (target.tagName === 'IMG') {
                    this.loadTestCase(target.dataset.id);
                } else if (target.classList.contains('delete-test-case-btn')) {
                    this.deleteTestCase(target.dataset.id);
                }
            });

            // 顶部按钮
            dom.addDefectBtn.onclick = () => this.showAddDefectModal();
            dom.editGlobalTemplateBtn.onclick = () => this.showGlobalTemplateModal();
            if (dom.settingsBtn) {
                dom.settingsBtn.onclick = () => this.showSettingsModal();
            }
            dom.runRegressionBtn.onclick = () => this.runRegressionTest();
            if (dom.runComparisonBtn) {
                dom.runComparisonBtn.onclick = () => this.runComparisonWithConfirm();
            }
            if (dom.themeToggle) {
                dom.themeToggle.onclick = () => this.toggleTheme();
            }

            // 导出历史按钮
            const exportHistoryBtn = document.getElementById('export-history-btn');
            if (exportHistoryBtn) {
                exportHistoryBtn.onclick = () => this.exportHistoryCSV();
            }
        },

        // --- 功能方法 ---
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
                await this.selectDefect(state.currentDefectId);
                this.selectVersion(newVersion.id);
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
            
            // 检查 defectId 是否存在
            if (!state.currentDefectId) {
                if (!silent) Notification.warning('请先选择一个缺陷类别！', '提示');
                return null;
            }
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('defect_id', state.currentDefectId);
            formData.append('boxes', JSON.stringify(boxes));

            const result = await api.upload('/api/testcase', formData);
            if (result.id) {
                if (!silent) Notification.success('测试用例添加成功！', '成功');
                // 使用返回的 defect_id 而不是 state.currentDefectId
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

        // 带确认的对比运行
        async runComparisonWithConfirm() {
            if (!state.currentTestCaseId) {
                Notification.warning('请先选择一个测试用例', '提示');
                return;
            }
            
            const useRealLLM = await this.showConfirmModal(
                '实时对比确认',
                '是否使用真实 LLM API 进行实时对比？（这将消耗额度）',
                '使用真实API',
                '使用模拟数据'
            );
            
            if (useRealLLM === null) return;
            
            await this.runComparison(useRealLLM);
        },

        async runComparison(useRealLLM = false) {
            let testCaseId = state.currentTestCaseId;

            if (!testCaseId && state.currentImage.file) {
                dom.comparisonContainer.innerHTML = '<p>正在自动保存新图片为测试用例...</p>';
                testCaseId = await this.addTestCase(true);
                if (!testCaseId) {
                    dom.comparisonContainer.innerHTML = '<p class="error">自动保存测试用例失败，请重试。</p>';
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
            
            dom.comparisonContainer.innerHTML = '<p>正在运行对比...</p>';
            const initialResponse = await api.post('/api/compare', payload);

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
            const renderBoxResult = (boxResult) => {
                const statusClass = boxResult.status === 'Y' ? 'status-yes' : 
                                   boxResult.status === 'N' ? 'status-no' : 'status-error';
                const statusText = boxResult.status === 'Y' ? '✓ 通过' : 
                                  boxResult.status === 'N' ? '✗ 未通过' : '⚠ 错误';
                return `
                    <div class="box-result-item ${statusClass}">
                        <div class="box-result-header">
                            <span class="box-id">框 #${boxResult.box_id}</span>
                            <span class="box-status">${statusText}</span>
                        </div>
                        <div class="box-reason">${boxResult.reason || '-'}</div>
                    </div>
                `;
            };

            const renderVersionCard = (title, results, prompt) => `
                <div class="comparison-card">
                    <div class="comparison-card-header">
                        <h4>${title}</h4>
                        <span class="result-count">
                            ${results.filter(r => r.status === 'Y').length}/${results.length} 通过
                        </span>
                    </div>
                    <div class="comparison-card-body">
                        <div class="box-results-grid">
                            ${results.map(renderBoxResult).join('')}
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

            dom.comparisonContainer.innerHTML = `
                <div class="comparison-layout">
                    ${renderVersionCard('📦 已保存版本', result.saved_version_results, result.prompt_used?.saved)}
                    ${renderVersionCard('✏️ 当前编辑版本', result.edited_version_results, result.prompt_used?.edited)}
                </div>
                <div class="comparison-summary">
                    <h4>📊 对比总结</h4>
                    <div class="summary-stats">
                        <div class="stat-item">
                            <span class="stat-label">保存版本通过率</span>
                            <span class="stat-value">${Math.round(result.saved_version_results.filter(r => r.status === 'Y').length / result.saved_version_results.length * 100)}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">编辑版本通过率</span>
                            <span class="stat-value">${Math.round(result.edited_version_results.filter(r => r.status === 'Y').length / result.edited_version_results.length * 100)}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">差异数</span>
                            <span class="stat-value">${result.saved_version_results.filter((r, i) => r.status !== result.edited_version_results[i]?.status).length}</span>
                        </div>
                    </div>
                </div>
            `;
        },
        
        async runRegressionTest() {
            if (!state.currentVersionId) { Notification.warning('请选择一个版本', '提示'); return; }
            
            // 使用自定义确认弹窗替代原生 confirm
            const useRealLLM = await this.showConfirmModal(
                '回归测试确认',
                '是否使用真实 LLM API 进行回归测试？（这将消耗额度）',
                '使用真实API',
                '使用模拟数据'
            );
            
            if (useRealLLM === null) return; // 用户取消
            
            const payload = {
                version_id: state.currentVersionId,
                use_real_llm: useRealLLM,
                model_name: dom.modelSelector.value,
            };
            
            const regressionContainer = document.getElementById('regression-report-container');
            regressionContainer.innerHTML = '<div class="loading-indicator">正在运行回归测试...</div>';
            const results = await api.post('/api/regression_test', payload);
            
            regressionContainer.innerHTML = `
                <div class="regression-report-header">
                    <h4>📊 回归测试报告</h4>
                    <button class="btn btn-secondary btn-sm" onclick="app.exportRegressionReport()">导出报告</button>
                </div>
                <table class="regression-table">
                    <thead>
                        <tr>
                            <th>测试用例ID</th>
                            <th>文件名</th>
                            <th>通过数</th>
                            <th>详细结果</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map(res => `
                            <tr>
                                <td>${res.test_case_id}</td>
                                <td>${res.filename}</td>
                                <td>${res.results.filter(r => r.status === 'Y').length}/${res.results.length}</td>
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
            
            let csv = '测试用例ID,文件名,通过数,详细结果\n';
            table.querySelectorAll('tbody tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 4) {
                    csv += `${cells[0].textContent},${cells[1].textContent},${cells[2].textContent},"${cells[3].textContent.replace(/"/g, '""')}"\n`;
                }
            });
            
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
            dom.settingsModal.style.display = 'none';
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
                
                // 更新模型选择器
                dom.modelSelector.value = llmData.default_model;
                
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
