// Fullscreen Kanban Board - Task Time Manager
class KanbanTaskManager {
    constructor() {
        this.tasks = [];
        this.projects = [];
        this.currentEditingTask = null;
        this.timers = new Map();
        this.currentEditingTimerTaskId = null;
        this.projectFilterValue = '';
        this.draggedTask = null;
        this.selectedTaskIds = new Set(); // Para controlar quais tarefas estão selecionadas para exportação
        this.init();
    }

    async init() {
        await this.loadTasks();
        await this.loadProjects();
        await this.loadRunningTimers();
        await this.loadPreferences();
        this.setupEventListeners();
        this.renderKanbanBoard();
        this.updateStats();
        this.updateProjectFilter();
        this.startTimerUpdates();
    }

    // Event Listeners
    setupEventListeners() {
        // Header buttons
        document.getElementById('addTaskBtn').addEventListener('click', () => this.openTaskModal());
        document.getElementById('addProjectBtn').addEventListener('click', () => this.openProjectModal());
        document.getElementById('projectsBtn').addEventListener('click', () => this.toggleProjectsPanel());
        document.getElementById('closeProjectsBtn').addEventListener('click', () => this.closeProjectsPanel());
        document.getElementById('addProjectFromFullscreenBtn').addEventListener('click', () => this.openProjectModal());
        document.getElementById('exportBtn').addEventListener('click', () => this.openExportModal());
        document.getElementById('statsBtn').addEventListener('click', () => this.toggleStatsPanel());
        document.getElementById('closeStatsBtn').addEventListener('click', () => this.closeStatsPanel());

        // Project filter
        const projectFilter = document.getElementById('projectFilter');
        projectFilter.addEventListener('change', (e) => {
            this.projectFilterValue = e.target.value || '';
            this.saveFilterOptions();
            this.renderKanbanBoard();
        });

        // Task Modal events
        document.getElementById('closeModal').addEventListener('click', () => this.closeTaskModal());
        document.getElementById('cancelTask').addEventListener('click', () => this.closeTaskModal());
        document.getElementById('taskForm').addEventListener('submit', (e) => this.handleTaskSubmit(e));
        document.getElementById('projectSelect').addEventListener('change', () => this.onProjectSelectChange());

        // Project Modal events
        document.getElementById('closeProjectModal').addEventListener('click', () => this.closeProjectModal());
        document.getElementById('cancelProject').addEventListener('click', () => this.closeProjectModal());
        document.getElementById('projectForm').addEventListener('submit', (e) => this.handleProjectSubmit(e));

        // Edit Timer Modal events
        document.getElementById('closeEditTimerModal').addEventListener('click', () => this.closeEditTimerModal());
        document.getElementById('cancelEditTimer').addEventListener('click', () => this.closeEditTimerModal());
        document.getElementById('editTimerForm').addEventListener('submit', (e) => this.handleEditTimerSubmit(e));

        // Modal click outside to close
        document.getElementById('taskModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') this.closeTaskModal();
        });
        document.getElementById('projectModal').addEventListener('click', (e) => {
            if (e.target.id === 'projectModal') this.closeProjectModal();
        });
        document.getElementById('editTimerModal').addEventListener('click', (e) => {
            if (e.target.id === 'editTimerModal') this.closeEditTimerModal();
        });

        // Export Modal events
        document.getElementById('closeExportModal').addEventListener('click', () => this.closeExportModal());
        document.getElementById('cancelExportBtn').addEventListener('click', () => this.closeExportModal());
        document.getElementById('previewExportBtn').addEventListener('click', () => this.updateExportPreview());
        document.getElementById('downloadExportBtn').addEventListener('click', () => this.downloadExport());
        document.getElementById('exportModal').addEventListener('click', (e) => {
            if (e.target.id === 'exportModal') this.closeExportModal();
        });

        // Export format change
        document.querySelectorAll('input[name="exportFormat"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.onExportFormatChange();
                this.updateExportSummary();
                this.updateExportPreview();
            });
        });

        // Export filters change
        document.getElementById('exportProjectFilter').addEventListener('change', () => {
            this.renderTaskSelectionList();
            this.updateExportSummary();
            this.updateExportPreview();
        });
        document.getElementById('exportStatusFilter').addEventListener('change', () => {
            this.renderTaskSelectionList();
            this.updateExportSummary();
            this.updateExportPreview();
        });
        document.getElementById('exportDateFrom').addEventListener('change', () => {
            this.renderTaskSelectionList();
            this.updateExportSummary();
            this.updateExportPreview();
        });
        document.getElementById('exportDateTo').addEventListener('change', () => {
            this.renderTaskSelectionList();
            this.updateExportSummary();
            this.updateExportPreview();
        });

        // Task selection controls
        document.getElementById('selectAllTasksBtn').addEventListener('click', () => this.selectAllTasks());
        document.getElementById('selectNoneTasksBtn').addEventListener('click', () => this.selectNoneTasks());
        
        // Task selection list (delegated events)
        document.getElementById('taskSelectionList').addEventListener('change', (e) => {
            if (e.target.classList.contains('task-checkbox')) {
                this.onTaskSelectionChange(e.target);
            }
        });
        
        document.getElementById('taskSelectionList').addEventListener('click', (e) => {
            const item = e.target.closest('.task-selection-item');
            if (item && !e.target.classList.contains('task-checkbox')) {
                const checkbox = item.querySelector('.task-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.onTaskSelectionChange(checkbox);
                }
            }
        });

        // Setup drag and drop for Kanban columns
        this.setupDragAndDrop();

        // Delegated event handling for task cards
        document.getElementById('kanbanBoard').addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            
            const action = btn.dataset.action;
            const taskId = btn.dataset.taskId;
            
            switch (action) {
                case 'edit':
                    const task = this.tasks.find(t => t.id === taskId);
                    if (task) this.openTaskModal(task);
                    break;
                case 'delete':
                    this.deleteTask(taskId);
                    break;
                case 'toggle-timer':
                    this.toggleTimer(taskId);
                    break;
                case 'reset-timer':
                    const taskForReset = this.tasks.find(t => t.id === taskId);
                    const taskName = taskForReset && taskForReset.title ? `"${taskForReset.title}"` : 'esta tarefa';
                    const ok = confirm(`Tem certeza que deseja reiniciar o tempo de ${taskName}?\nEsta ação não pode ser desfeita.`);
                    if (ok) this.resetTimer(taskId);
                    break;
                case 'edit-timer':
                    this.openEditTimerModal(taskId);
                    break;
            }
        });
    }

    // Drag and Drop Setup
    setupDragAndDrop() {
        const columns = document.querySelectorAll('.column-content');
        
        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });
            
            column.addEventListener('dragleave', (e) => {
                if (!column.contains(e.relatedTarget)) {
                    column.classList.remove('drag-over');
                }
            });
            
            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                
                if (this.draggedTask) {
                    const newStatus = column.parentElement.dataset.status;
                    this.updateTaskStatus(this.draggedTask.id, newStatus);
                    this.draggedTask = null;
                }
            });
        });
    }

    // Data Loading
    async loadTasks() {
        try {
            const result = await chrome.storage.local.get(['tasks']);
            this.tasks = result.tasks || [];
        } catch (error) {
            console.error('Erro ao carregar tarefas:', error);
            this.tasks = [];
        }
    }

    async loadProjects() {
        try {
            const result = await chrome.storage.local.get(['projects']);
            this.projects = result.projects || [];
        } catch (error) {
            console.error('Erro ao carregar projetos:', error);
            this.projects = [];
        }
    }

    async loadRunningTimers() {
        try {
            const result = await chrome.storage.local.get(['runningTimers']);
            const stored = result.runningTimers || {};
            this.timers = new Map();
            Object.entries(stored).forEach(([taskId, t]) => {
                if (this.tasks.some(task => task.id === taskId)) {
                    this.timers.set(taskId, {
                        startTime: typeof t.startTime === 'number' ? t.startTime : null,
                        elapsed: typeof t.elapsed === 'number' ? t.elapsed : 0,
                        isRunning: !!t.isRunning
                    });
                }
            });
        } catch (error) {
            console.error('Erro ao carregar timers:', error);
        }
    }

    async loadPreferences() {
        try {
            const result = await chrome.storage.local.get(['taskProjectFilter']);
            if (result && typeof result.taskProjectFilter !== 'undefined') {
                this.projectFilterValue = result.taskProjectFilter || '';
            }
            const projEl = document.getElementById('projectFilter');
            if (projEl) projEl.value = this.projectFilterValue || '';
        } catch (err) {
            console.warn('Não foi possível carregar preferências:', err);
        }
    }

    // Data Saving
    async saveTasks() {
        try {
            await chrome.storage.local.set({ tasks: this.tasks });
        } catch (error) {
            console.error('Erro ao salvar tarefas:', error);
        }
    }

    async saveProjects() {
        try {
            await chrome.storage.local.set({ projects: this.projects });
        } catch (error) {
            console.error('Erro ao salvar projetos:', error);
        }
    }

    async saveRunningTimers() {
        try {
            const obj = {};
            this.timers.forEach((t, taskId) => {
                if (t && t.isRunning) {
                    obj[taskId] = {
                        startTime: t.startTime,
                        elapsed: t.elapsed,
                        isRunning: true
                    };
                }
            });
            await chrome.storage.local.set({ runningTimers: obj });
        } catch (error) {
            console.error('Erro ao salvar timers:', error);
        }
    }

    async saveFilterOptions() {
        try {
            await chrome.storage.local.set({
                taskProjectFilter: this.projectFilterValue || ''
            });
        } catch (err) {
            console.warn('Não foi possível salvar filtros:', err);
        }
    }

    // Task Management
    createTask(taskData) {
        const task = {
            id: Date.now().toString(),
            title: taskData.title,
            description: taskData.description || '',
            projectId: taskData.projectId || null,
            estimatedHours: parseFloat(taskData.estimatedHours) || 0,
            actualHours: parseFloat(taskData.actualHours) || 0,
            hourlyRate: parseFloat(taskData.hourlyRate) || 0,
            deadline: taskData.deadline || null,
            status: taskData.status || 'Not Started',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.tasks.push(task);
        this.saveTasks();
        this.renderKanbanBoard();
        this.updateStats();
        this.updateProjectFilter();
    }

    updateTask(taskId, taskData) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = {
                ...this.tasks[taskIndex],
                ...taskData,
                updatedAt: new Date().toISOString()
            };
            this.saveTasks();
            this.renderKanbanBoard();
            this.updateStats();
        }
    }

    updateTaskStatus(taskId, newStatus) {
        this.updateTask(taskId, { status: newStatus });
    }

    deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        if (this.timers.has(taskId)) {
            this.timers.delete(taskId);
            this.saveRunningTimers();
        }
        this.saveTasks();
        this.renderKanbanBoard();
        this.updateStats();
        this.updateProjectFilter();
    }

    // Project Management
    createProjectSync(name) {
        const project = { id: `p_${Date.now()}`, name, createdAt: new Date().toISOString() };
        this.projects.push(project);
        return project;
    }

    // Timer Management
    toggleTimer(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        let timer = this.timers.get(taskId);
        
        if (!timer) {
            timer = {
                startTime: null,
                elapsed: task.actualHours * 3600,
                isRunning: false
            };
            this.timers.set(taskId, timer);
        }

        if (timer.isRunning) {
            timer.elapsed += Math.floor((Date.now() - timer.startTime) / 1000);
            timer.isRunning = false;
            timer.startTime = null;
            task.actualHours = timer.elapsed / 3600;
            this.updateTask(taskId, { actualHours: task.actualHours });
            this.saveRunningTimers();
        } else {
            timer.startTime = Date.now();
            timer.isRunning = true;
            this.saveRunningTimers();
        }

        this.renderKanbanBoard();
    }

    resetTimer(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.timers.delete(taskId);
        task.actualHours = 0;
        this.updateTask(taskId, { actualHours: 0 });
        this.saveRunningTimers();
        this.renderKanbanBoard();
    }

    // Kanban Board Rendering
    renderKanbanBoard() {
        const statusColumns = [
            { status: 'Not Started', columnId: 'column-not-started', countId: 'count-not-started' },
            { status: 'In Progress', columnId: 'column-in-progress', countId: 'count-in-progress' },
            { status: 'On Hold', columnId: 'column-on-hold', countId: 'count-on-hold' },
            { status: 'Completed', columnId: 'column-completed', countId: 'count-completed' }
        ];

        statusColumns.forEach(({ status, columnId, countId }) => {
            const column = document.getElementById(columnId);
            const countEl = document.getElementById(countId);
            
            let filteredTasks = this.tasks.filter(task => task.status === status);
            
            if (this.projectFilterValue) {
                filteredTasks = filteredTasks.filter(task => task.projectId === this.projectFilterValue);
            }

            countEl.textContent = filteredTasks.length;

            if (filteredTasks.length === 0) {
                column.innerHTML = '<div class="empty-column">Nenhuma tarefa</div>';
            } else {
                column.innerHTML = filteredTasks.map(task => this.createKanbanTaskCard(task)).join('');
            }
        });
    }

    createKanbanTaskCard(task) {
        const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'Completed';
        const timer = this.timers.get(task.id);
        const isTimerRunning = timer && timer.isRunning;
        const projectName = this.getProjectName(task.projectId);

        const now = Date.now();
        const displaySeconds = isTimerRunning
            ? (timer.elapsed + Math.floor((now - timer.startTime) / 1000))
            : Math.round((task.actualHours || 0) * 3600);

        return `
            <div class="kanban-task-card" data-task-id="${task.id}" draggable="true">
                <div class="task-header">
                    <div>
                        <div class="task-title">${this.escapeHtml(task.title)}</div>
                        ${projectName ? `<span class="task-category">${this.escapeHtml(projectName)}</span>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="btn btn-small btn-secondary" title="Editar" data-action="edit" data-task-id="${task.id}">✏️</button>
                        <button class="btn btn-small btn-danger" title="Excluir" data-action="delete" data-task-id="${task.id}">🗑️</button>
                    </div>
                </div>
                
                ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                
                <div class="task-meta">
                    <span class="task-time">
                        ${this.formatTime(Math.round((task.actualHours || 0) * 3600))}
                        /
                        ${this.formatTime(Math.round((task.estimatedHours || 0) * 3600))}
                        ${task.hourlyRate && task.hourlyRate > 0 ? ` • ${this.formatCurrency(task.hourlyRate)}/h` : ''}
                    </span>
                </div>
                
                ${task.deadline ? `
                    <div class="task-deadline ${isOverdue ? 'overdue' : ''}">
                        📅 ${new Date(task.deadline).toLocaleDateString('pt-BR')}
                        ${isOverdue ? ' (Atrasado!)' : ''}
                    </div>
                ` : ''}
                
                <div class="timer">
                    <div class="timer-display" id="timer-${task.id}">
                        ${this.formatTime(displaySeconds)}
                    </div>
                    <div class="timer-controls">
                        <button class="btn btn-small ${isTimerRunning ? 'btn-warning' : 'btn-secondary'}" data-action="toggle-timer" data-task-id="${task.id}">${isTimerRunning ? '⏸️' : '▶️'}</button>
                        <button class="btn btn-small" title="Editar tempo" data-action="edit-timer" data-task-id="${task.id}">✏️</button>
                        <button class="btn btn-small btn-danger" data-action="reset-timer" data-task-id="${task.id}">🔄</button>
                    </div>
                    ${task.hourlyRate && task.hourlyRate > 0 ? `
                    <div class="task-cost">
                        Custo: <span id="cost-${task.id}">${this.formatCurrency((task.actualHours || 0) * task.hourlyRate)}</span>
                    </div>` : ''}
                </div>
            </div>
        `;
    }

    // Modal Management
    openTaskModal(task = null) {
        this.currentEditingTask = task;
        const modal = document.getElementById('taskModal');
        this.populateProjectSelect();
        
        if (task) {
            document.getElementById('modalTitle').textContent = 'Editar Tarefa';
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description;
            document.getElementById('estimatedHours').value = task.estimatedHours;
            document.getElementById('hourlyRate').value = typeof task.hourlyRate === 'number' ? task.hourlyRate : '';
            document.getElementById('taskDeadline').value = task.deadline || '';
            document.getElementById('taskStatus').value = task.status;
            document.getElementById('projectSelect').value = task.projectId || '';
            document.getElementById('newProjectGroup').style.display = 'none';
        } else {
            document.getElementById('modalTitle').textContent = 'Nova Tarefa';
            document.getElementById('taskForm').reset();
            document.getElementById('estimatedHours').value = 1;
            document.getElementById('hourlyRate').value = '';
            const projectSelect = document.getElementById('projectSelect');
            if (this.projects.length > 0) {
                projectSelect.value = this.projects[0].id;
                document.getElementById('newProjectGroup').style.display = 'none';
            } else {
                projectSelect.value = '__new__';
                document.getElementById('newProjectGroup').style.display = 'block';
            }
        }
        
        modal.style.display = 'block';
    }

    closeTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
        this.currentEditingTask = null;
    }

    openProjectModal(project = null) {
        const modal = document.getElementById('projectModal');
        document.getElementById('projectId').value = project ? project.id : '';
        document.getElementById('projectName').value = project ? project.name : '';
        document.getElementById('projectModalTitle').textContent = project ? 'Editar Projeto' : 'Novo Projeto';
        modal.style.display = 'block';
    }

    closeProjectModal() {
        document.getElementById('projectModal').style.display = 'none';
        document.getElementById('projectId').value = '';
        document.getElementById('projectName').value = '';
    }

    openEditTimerModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        this.currentEditingTimerTaskId = taskId;
        const currentSeconds = Math.round((task.actualHours || 0) * 3600);
        const input = document.getElementById('editTimerInput');
        const helper = document.getElementById('editTimerHelper');
        if (input) input.value = this.formatTime(currentSeconds);
        if (helper) helper.textContent = `Atual: ${this.formatTime(currentSeconds)}`;
        const modal = document.getElementById('editTimerModal');
        if (modal) modal.style.display = 'block';
    }

    closeEditTimerModal() {
        document.getElementById('editTimerModal').style.display = 'none';
        this.currentEditingTimerTaskId = null;
    }

    // Event Handlers
    handleTaskSubmit(e) {
        e.preventDefault();
        
        const formData = {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            deadline: document.getElementById('taskDeadline').value,
            status: document.getElementById('taskStatus').value
        };
        
        const estVal = parseFloat(document.getElementById('estimatedHours').value);
        formData.estimatedHours = isNaN(estVal) ? 0 : estVal;

        const projectSelect = document.getElementById('projectSelect');
        const selected = projectSelect.value;
        if (selected === '__new__') {
            const name = document.getElementById('newProjectName').value.trim();
            if (!name) {
                alert('Informe o nome do novo projeto.');
                return;
            }
            const project = this.createProjectSync(name);
            this.saveProjects();
            formData.projectId = project.id;
        } else {
            formData.projectId = selected || null;
        }

        const hourlyRateVal = parseFloat(document.getElementById('hourlyRate').value);
        formData.hourlyRate = isNaN(hourlyRateVal) ? 0 : hourlyRateVal;

        if (!formData.title) {
            alert('Por favor, insira um título para a tarefa.');
            return;
        }

        if (this.currentEditingTask) {
            this.updateTask(this.currentEditingTask.id, formData);
        } else {
            this.createTask(formData);
        }

        this.closeTaskModal();
        this.updateProjectFilter();
    }

    handleProjectSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('projectId').value;
        const name = document.getElementById('projectName').value.trim();
        if (!name) return;

        if (id) {
            const proj = this.projects.find(p => p.id === id);
            if (proj) proj.name = name;
        } else {
            this.createProjectSync(name);
        }

        this.saveProjects();
        this.updateProjectFilter();
        this.populateProjectSelect();
        this.renderProjects();
        this.closeProjectModal();
    }

    handleEditTimerSubmit(e) {
        if (e) e.preventDefault();
        const taskId = this.currentEditingTimerTaskId;
        if (!taskId) return this.closeEditTimerModal();
        
        const inputEl = document.getElementById('editTimerInput');
        const val = inputEl ? inputEl.value : '';
        const seconds = this.parseTimeInput(val);
        if (seconds == null || isNaN(seconds) || seconds < 0) {
            alert('Entrada inválida. Use HH:MM:SS, HH:MM ou horas decimais.');
            return;
        }

        const hours = seconds / 3600;
        this.updateTask(taskId, { actualHours: hours });

        let timer = this.timers.get(taskId);
        if (!timer) {
            timer = { startTime: null, elapsed: 0, isRunning: false };
            this.timers.set(taskId, timer);
        }
        if (timer.isRunning) {
            timer.elapsed = seconds;
            timer.startTime = Date.now();
        } else {
            timer.elapsed = seconds;
            timer.startTime = null;
        }
        this.saveRunningTimers();
        this.closeEditTimerModal();
        this.renderKanbanBoard();
    }

    // Statistics
    toggleStatsPanel() {
        const panel = document.getElementById('statsPanel');
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            this.updateStats();
        }
    }

    closeStatsPanel() {
        const panel = document.getElementById('statsPanel');
        panel.classList.add('hidden');
    }

    // Projects Panel
    toggleProjectsPanel() {
        const panel = document.getElementById('projectsPanel');
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            this.renderProjects();
        }
    }

    closeProjectsPanel() {
        const panel = document.getElementById('projectsPanel');
        panel.classList.add('hidden');
    }

    // Projects Management
    renderProjects() {
        const container = document.getElementById('projectsList');
        if (!container) return;
        
        if (this.projects.length === 0) {
            container.innerHTML = '<div class="empty-projects"><p>Nenhum projeto cadastrado.</p><p>Crie seu primeiro projeto para começar!</p></div>';
            return;
        }
        
        container.innerHTML = this.projects.map(project => this.createProjectCard(project)).join('');
        this.bindProjectCardEvents();
    }

    createProjectCard(project) {
        const taskCount = this.tasks.filter(t => t.projectId === project.id).length;
        const completedTasks = this.tasks.filter(t => t.projectId === project.id && t.status === 'Completed').length;
        const inProgressTasks = this.tasks.filter(t => t.projectId === project.id && t.status === 'In Progress').length;
        
        // Calculate project statistics
        const projectTasks = this.tasks.filter(t => t.projectId === project.id);
        const totalEstimatedHours = projectTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
        const totalActualHours = projectTasks.reduce((sum, t) => sum + (Number(t.actualHours) || 0), 0);
        const totalValue = projectTasks.reduce((sum, t) => {
            const hours = Number(t.actualHours) || 0;
            const rate = Number(t.hourlyRate) || 0;
            return sum + (hours * rate);
        }, 0);

        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <div>
                        <div class="project-title">${this.escapeHtml(project.name)}</div>
                        <div class="project-task-count">${taskCount} tarefa(s)</div>
                    </div>
                    <div class="project-actions">
                        <button class="btn btn-small btn-success" title="Editar projeto" data-action="edit-project" data-project-id="${project.id}">✏️</button>
                        <button class="btn btn-small btn-secondary" title="Excluir projeto" data-action="delete-project" data-project-id="${project.id}">🗑️</button>
                    </div>
                </div>
                
                <div class="project-meta">
                    <span>Concluídas: ${completedTasks}</span>
                    <span>Em progresso: ${inProgressTasks}</span>
                </div>
                
                <div class="project-description">
                    <strong>Horas:</strong> ${this.formatTime(Math.round(totalActualHours * 3600))} / ${this.formatTime(Math.round(totalEstimatedHours * 3600))}
                    ${totalValue > 0 ? `<br><strong>Valor:</strong> ${this.formatCurrency(totalValue)}` : ''}
                </div>
            </div>
        `;
    }

    bindProjectCardEvents() {
        const container = document.getElementById('projectsList');
        if (!container) return;
        
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            
            const action = btn.dataset.action;
            const projectId = btn.dataset.projectId;
            
            switch (action) {
                case 'edit-project':
                    const project = this.projects.find(p => p.id === projectId);
                    if (project) this.openProjectModal(project);
                    break;
                case 'delete-project':
                    this.deleteProject(projectId);
                    break;
            }
        });
    }

    async deleteProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;
        
        const inUse = this.tasks.some(t => t.projectId === projectId);
        if (inUse) {
            alert('Não é possível excluir um projeto com tarefas associadas.');
            return;
        }
        
        const confirmDelete = confirm(`Tem certeza que deseja excluir o projeto "${project.name}"?\nEsta ação não pode ser desfeita.`);
        if (!confirmDelete) return;
        
        this.projects = this.projects.filter(p => p.id !== projectId);
        await this.saveProjects();
        this.updateProjectFilter();
        this.renderProjects();
        this.renderKanbanBoard();
    }

    updateStats() {
        let tasks = this.tasks;
        if (this.projectFilterValue) {
            tasks = tasks.filter(t => t.projectId === this.projectFilterValue);
        }

        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'Completed').length;
        const inProgress = tasks.filter(t => t.status === 'In Progress').length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const totalEstimated = tasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
        const totalActual = tasks.reduce((sum, t) => sum + (Number(t.actualHours) || 0), 0);
        const efficiency = totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0;
        
        const totalEarnings = tasks.reduce((sum, t) => {
            const hours = Number(t.actualHours) || 0;
            const rate = Number(t.hourlyRate) || 0;
            if (rate <= 0) return sum;
            return sum + hours * rate;
        }, 0);

        document.getElementById('totalTasks').textContent = total;
        document.getElementById('completedTasks').textContent = completed;
        document.getElementById('inProgressTasks').textContent = inProgress;
        document.getElementById('completionRate').textContent = `${completionRate}%`;
        document.getElementById('totalEstimated').textContent = `${totalEstimated.toFixed(1)}h`;
        document.getElementById('totalActual').textContent = `${totalActual.toFixed(1)}h`;
        document.getElementById('efficiency').textContent = `${efficiency}%`;
        document.getElementById('totalEarnings').textContent = this.formatCurrency(totalEarnings);
    }

    // Export Modal Management
    openExportModal() {
        const modal = document.getElementById('exportModal');
        this.populateExportProjectFilter();
        this.renderTaskSelectionList();
        this.updateExportSummary();
        modal.style.display = 'block';
    }

    closeExportModal() {
        const modal = document.getElementById('exportModal');
        modal.style.display = 'none';
        document.getElementById('exportPreview').innerHTML = '<div class="preview-placeholder">Selecione as opções acima para ver o preview</div>';
        // Clear task selections for next time
        this.selectedTaskIds.clear();
    }

    onExportFormatChange() {
        const selectedFormat = document.querySelector('input[name="exportFormat"]:checked').value;
        const htmlOnlyElements = document.querySelectorAll('.html-only');
        
        htmlOnlyElements.forEach(element => {
            if (selectedFormat === 'html') {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        });
    }

    populateExportProjectFilter() {
        const select = document.getElementById('exportProjectFilter');
        select.innerHTML = '<option value="">Todos os Projetos</option>';
        
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            select.appendChild(option);
        });
    }

    getAvailableTasksForExport() {
        let tasks = [...this.tasks];
        
        // Filter by project
        const projectFilter = document.getElementById('exportProjectFilter').value;
        if (projectFilter) {
            tasks = tasks.filter(task => task.projectId === projectFilter);
        }
        
        // Filter by status
        const statusFilter = document.getElementById('exportStatusFilter').value;
        if (statusFilter) {
            tasks = tasks.filter(task => task.status === statusFilter);
        }
        
        // Filter by date range
        const dateFrom = document.getElementById('exportDateFrom').value;
        const dateTo = document.getElementById('exportDateTo').value;
        
        if (dateFrom || dateTo) {
            tasks = tasks.filter(task => {
                const taskDate = new Date(task.createdAt);
                const fromDate = dateFrom ? new Date(dateFrom) : new Date('1900-01-01');
                const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : new Date('2100-01-01');
                
                return taskDate >= fromDate && taskDate <= toDate;
            });
        }
        
        return tasks;
    }

    getSelectedTasksForExport() {
        const availableTasks = this.getAvailableTasksForExport();
        return availableTasks.filter(task => this.selectedTaskIds.has(task.id));
    }

    updateExportSummary() {
        const selectedTasks = this.getSelectedTasksForExport();
        const totalHours = selectedTasks.reduce((sum, task) => sum + (task.actualHours || 0), 0);
        const totalValue = selectedTasks.reduce((sum, task) => {
            const hours = task.actualHours || 0;
            const rate = task.hourlyRate || 0;
            return sum + (hours * rate);
        }, 0);
        
        document.getElementById('selectedTasksCount').textContent = selectedTasks.length;
        document.getElementById('selectedHoursTotal').textContent = `${totalHours.toFixed(1)}h`;
        document.getElementById('selectedValueTotal').textContent = this.formatCurrency(totalValue);
    }

    updateExportPreview() {
        const selectedFormat = document.querySelector('input[name="exportFormat"]:checked').value;
        const selectedTasks = this.getSelectedTasksForExport();
        const previewEl = document.getElementById('exportPreview');
        
        if (selectedTasks.length === 0) {
            previewEl.innerHTML = '<div class="preview-placeholder">Nenhuma tarefa selecionada para exportação</div>';
            return;
        }
        
        switch (selectedFormat) {
            case 'html':
                previewEl.innerHTML = this.generateHTMLPreview(selectedTasks);
                break;
            case 'csv':
                previewEl.innerHTML = `<pre>${this.generateCSVContent(selectedTasks)}</pre>`;
                break;
            case 'json':
                previewEl.innerHTML = `<pre>${this.generateJSONContent(selectedTasks)}</pre>`;
                break;
        }
    }

    downloadExport() {
        const selectedFormat = document.querySelector('input[name="exportFormat"]:checked').value;
        const selectedTasks = this.getSelectedTasksForExport();
        
        if (selectedTasks.length === 0) {
            alert('Nenhuma tarefa selecionada para exportação');
            return;
        }
        
        const timestamp = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = `${timestamp.getFullYear()}${pad(timestamp.getMonth()+1)}${pad(timestamp.getDate())}-${pad(timestamp.getHours())}${pad(timestamp.getMinutes())}`;
        
        switch (selectedFormat) {
            case 'html':
                const htmlContent = this.generateHTMLExport(selectedTasks);
                const filename = `ordem-servico-${dateStr}.html`;
                this.downloadBlob(filename, htmlContent, 'text/html');
                break;
            case 'csv':
                const csvContent = this.generateCSVContent(selectedTasks);
                const csvFilename = `relatorio-tarefas-${dateStr}.csv`;
                this.downloadBlob(csvFilename, csvContent, 'text/csv');
                break;
            case 'json':
                const jsonContent = this.generateJSONContent(selectedTasks);
                const jsonFilename = `backup-tarefas-${dateStr}.json`;
                this.downloadBlob(jsonFilename, jsonContent, 'application/json');
                break;
        }
        
        this.closeExportModal();
    }

    downloadBlob(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }

    // Task Selection Management
    renderTaskSelectionList() {
        const availableTasks = this.getAvailableTasksForExport();
        const listEl = document.getElementById('taskSelectionList');
        
        if (availableTasks.length === 0) {
            listEl.innerHTML = '<div class="empty-task-selection">Nenhuma tarefa disponível com os filtros atuais</div>';
            return;
        }
        
        listEl.innerHTML = availableTasks.map(task => {
            const projectName = this.getProjectName(task.projectId) || 'Sem projeto';
            const hours = task.actualHours || 0;
            const rate = task.hourlyRate || 0;
            const cost = hours * rate;
            const statusClass = task.status.toLowerCase().replace(/\s+/g, '-');
            const isSelected = this.selectedTaskIds.has(task.id);
            
            return `
                <div class="task-selection-item ${isSelected ? 'selected' : ''}" data-task-id="${task.id}">
                    <input type="checkbox" class="task-checkbox" ${isSelected ? 'checked' : ''} data-task-id="${task.id}">
                    <div class="task-selection-info">
                        <div class="task-selection-title">${this.escapeHtml(task.title)}</div>
                        <div class="task-selection-meta">
                            <span class="task-selection-project">${this.escapeHtml(projectName)}</span>
                            <span class="task-selection-status ${statusClass}">${this.getStatusText(task.status)}</span>
                        </div>
                    </div>
                    <div class="task-selection-value">
                        <div class="task-selection-hours">${this.formatTime(Math.round(hours * 3600))}</div>
                        ${rate > 0 ? `<div class="task-selection-cost">${this.formatCurrency(cost)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        // Auto-select all tasks if none are selected yet
        if (this.selectedTaskIds.size === 0 && availableTasks.length > 0) {
            availableTasks.forEach(task => this.selectedTaskIds.add(task.id));
            // Update UI to reflect selections
            setTimeout(() => {
                this.updateExportSummary();
                this.updateExportPreview();
            }, 100);
        }
    }
    
    selectAllTasks() {
        const availableTasks = this.getAvailableTasksForExport();
        availableTasks.forEach(task => this.selectedTaskIds.add(task.id));
        this.renderTaskSelectionList();
        this.updateExportSummary();
        this.updateExportPreview();
    }
    
    selectNoneTasks() {
        this.selectedTaskIds.clear();
        this.renderTaskSelectionList();
        this.updateExportSummary();
        this.updateExportPreview();
    }
    
    onTaskSelectionChange(checkbox) {
        const taskId = checkbox.dataset.taskId;
        const item = checkbox.closest('.task-selection-item');
        
        if (checkbox.checked) {
            this.selectedTaskIds.add(taskId);
            item.classList.add('selected');
        } else {
            this.selectedTaskIds.delete(taskId);
            item.classList.remove('selected');
        }
        
        this.updateExportSummary();
        this.updateExportPreview();
    }

    // Export Content Generators
    generateHTMLPreview(tasks) {
        const now = new Date();
        const brDate = now.toLocaleDateString('pt-BR');
        const totalHours = tasks.reduce((sum, task) => sum + (task.actualHours || 0), 0);
        const totalValue = tasks.reduce((sum, task) => {
            const hours = task.actualHours || 0;
            const rate = task.hourlyRate || 0;
            return sum + (hours * rate);
        }, 0);

        const taskRows = tasks.map(task => {
            const projectName = this.getProjectName(task.projectId) || 'Sem projeto';
            const hours = task.actualHours || 0;
            const rate = task.hourlyRate || 0;
            const cost = hours * rate;
            const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString('pt-BR') : '-';
            
            return `
                <tr>
                    <td>${this.escapeHtml(task.title)}</td>
                    <td>${this.escapeHtml(projectName)}</td>
                    <td>${this.getStatusText(task.status)}</td>
                    <td>${deadline}</td>
                    <td class="right">${this.formatTime(Math.round(hours * 3600))}</td>
                    <td class="right">${rate > 0 ? this.formatCurrency(rate) : '—'}</td>
                    <td class="right">${this.formatCurrency(cost)}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="preview-html">
                <h1>Ordem de Serviço</h1>
                <div style="color: #666; font-size: 12px; margin-bottom: 16px;">Emitida em ${brDate}</div>
                
                <h2>Resumo dos Serviços</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Tarefa</th>
                            <th>Projeto</th>
                            <th>Status</th>
                            <th>Prazo</th>
                            <th class="right">Horas</th>
                            <th class="right">Valor/h</th>
                            <th class="right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${taskRows}
                        <tr style="font-weight: bold; border-top: 2px solid #333;">
                            <td colspan="4">TOTAL</td>
                            <td class="right">${this.formatTime(Math.round(totalHours * 3600))}</td>
                            <td></td>
                            <td class="right">${this.formatCurrency(totalValue)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    generateHTMLExport(tasks) {
        const now = new Date();
        const brDate = now.toLocaleDateString('pt-BR');
        const companyName = document.getElementById('companyName').value || 'Empresa';
        const companyCnpj = document.getElementById('companyCnpj').value;
        const companyEmail = document.getElementById('companyEmail').value;
        const companyPhone = document.getElementById('companyPhone').value;
        const exportNotes = document.getElementById('exportNotes').value;
        
        const totalHours = tasks.reduce((sum, task) => sum + (task.actualHours || 0), 0);
        const totalValue = tasks.reduce((sum, task) => {
            const hours = task.actualHours || 0;
            const rate = task.hourlyRate || 0;
            return sum + (hours * rate);
        }, 0);

        const taskRows = tasks.map(task => {
            const projectName = this.getProjectName(task.projectId) || 'Sem projeto';
            const hours = task.actualHours || 0;
            const rate = task.hourlyRate || 0;
            const cost = hours * rate;
            const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString('pt-BR') : '-';
            const description = task.description ? this.escapeHtml(task.description) : '—';
            
            return `
                <tr>
                    <td>${this.escapeHtml(task.title)}</td>
                    <td>${this.escapeHtml(projectName)}</td>
                    <td>${this.getStatusText(task.status)}</td>
                    <td>${deadline}</td>
                    <td class="right">${this.formatTime(Math.round(hours * 3600))}</td>
                    <td class="right">${rate > 0 ? this.formatCurrency(rate) : '—'}</td>
                    <td class="right">${this.formatCurrency(cost)}</td>
                </tr>
            `;
        }).join('');

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ordem de Serviço - ${this.escapeHtml(companyName)}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 24px; color: #222; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #333; }
        .company-info { flex: 1; }
        .company-info h1 { margin: 0 0 8px; font-size: 24px; color: #333; }
        .company-info .details { color: #666; font-size: 14px; }
        .document-info { text-align: right; }
        .document-info h2 { margin: 0 0 8px; font-size: 20px; color: #333; }
        .document-info .date { color: #666; font-size: 14px; }
        h3 { margin: 24px 0 12px; font-size: 18px; color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { border: 1px solid #ddd; padding: 12px 8px; text-align: left; font-size: 14px; }
        th { background: #f8f9fa; font-weight: 600; }
        .right { text-align: right; }
        .total-row { font-weight: bold; background: #f0f8ff; border-top: 2px solid #333; }
        .notes { background: #f9f9f9; padding: 16px; border-radius: 8px; margin-top: 24px; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
        @media print { 
            .no-print { display: none; } 
            body { margin: 0; }
            .header { page-break-after: avoid; }
        }
    </style>
    <script>
        function printDocument() { window.print(); }
    </script>
</head>
<body>
    <div class="no-print" style="text-align: right; margin-bottom: 16px;">
        <button onclick="printDocument()" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">🖨️ Imprimir/Salvar PDF</button>
    </div>
    
    <div class="header">
        <div class="company-info">
            <h1>${this.escapeHtml(companyName)}</h1>
            <div class="details">
                ${companyCnpj ? `<div>CNPJ: ${this.escapeHtml(companyCnpj)}</div>` : ''}
                ${companyEmail ? `<div>E-mail: ${this.escapeHtml(companyEmail)}</div>` : ''}
                ${companyPhone ? `<div>Telefone: ${this.escapeHtml(companyPhone)}</div>` : ''}
            </div>
        </div>
        <div class="document-info">
            <h2>ORDEM DE SERVIÇO</h2>
            <div class="date">Emitida em ${brDate}</div>
            <div class="date">Total de ${tasks.length} serviço(s)</div>
        </div>
    </div>

    <h3>📋 Detalhamento dos Serviços</h3>
    <table>
        <thead>
            <tr>
                <th>Descrição do Serviço</th>
                <th>Projeto</th>
                <th>Status</th>
                <th>Prazo</th>
                <th class="right">Horas Trabalhadas</th>
                <th class="right">Valor/Hora</th>
                <th class="right">Valor Total</th>
            </tr>
        </thead>
        <tbody>
            ${taskRows}
            <tr class="total-row">
                <td colspan="4"><strong>TOTAL GERAL</strong></td>
                <td class="right"><strong>${this.formatTime(Math.round(totalHours * 3600))}</strong></td>
                <td class="right">—</td>
                <td class="right"><strong>${this.formatCurrency(totalValue)}</strong></td>
            </tr>
        </tbody>
    </table>

    ${exportNotes ? `
    <div class="notes">
        <h3>📝 Observações</h3>
        <p>${this.escapeHtml(exportNotes).replace(/\n/g, '<br>')}</p>
    </div>
    ` : ''}

    <div class="footer">
        <p>Documento gerado pelo Task Time Manager em ${brDate}</p>
        <p>Este documento é válido como comprovante de serviços prestados</p>
    </div>
</body>
</html>
        `;
    }

    generateCSVContent(tasks) {
        const headers = [
            'Tarefa',
            'Projeto', 
            'Status',
            'Criado em',
            'Prazo',
            'Horas Estimadas',
            'Horas Reais',
            'Valor por Hora',
            'Valor Total',
            'Descrição'
        ];
        
        const rows = tasks.map(task => {
            const projectName = this.getProjectName(task.projectId) || 'Sem projeto';
            const hours = task.actualHours || 0;
            const rate = task.hourlyRate || 0;
            const cost = hours * rate;
            const createdAt = new Date(task.createdAt).toLocaleDateString('pt-BR');
            const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString('pt-BR') : '';
            const status = this.getStatusText(task.status);
            
            return [
                `"${(task.title || '').replace(/"/g, '""')}"`,
                `"${projectName.replace(/"/g, '""')}"`,
                `"${status}"`,
                `"${createdAt}"`,
                `"${deadline}"`,
                `"${(task.estimatedHours || 0).toString().replace('.', ',')}"`,
                `"${hours.toString().replace('.', ',')}"`,
                `"${rate.toString().replace('.', ',')}"`,
                `"${cost.toString().replace('.', ',')}"`,
                `"${(task.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
            ];
        });
        
        const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
        return '\uFEFF' + csvContent; // BOM para UTF-8 no Excel
    }

    generateJSONContent(tasks) {
        const exportData = {
            meta: {
                exportedAt: new Date().toISOString(),
                exportedBy: 'Task Time Manager',
                version: '1.0',
                totalTasks: tasks.length,
                totalHours: tasks.reduce((sum, task) => sum + (task.actualHours || 0), 0),
                totalValue: tasks.reduce((sum, task) => {
                    const hours = task.actualHours || 0;
                    const rate = task.hourlyRate || 0;
                    return sum + (hours * rate);
                }, 0)
            },
            filters: {
                project: document.getElementById('exportProjectFilter').value || null,
                status: document.getElementById('exportStatusFilter').value || null,
                dateFrom: document.getElementById('exportDateFrom').value || null,
                dateTo: document.getElementById('exportDateTo').value || null
            },
            projects: this.projects.filter(project => 
                tasks.some(task => task.projectId === project.id)
            ),
            tasks: tasks.map(task => ({
                ...task,
                projectName: this.getProjectName(task.projectId),
                statusText: this.getStatusText(task.status),
                totalCost: (task.actualHours || 0) * (task.hourlyRate || 0)
            }))
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    getStatusText(status) {
        const statusMap = {
            'Not Started': 'Não Iniciado',
            'In Progress': 'Em Progresso',
            'Completed': 'Concluído',
            'On Hold': 'Em Pausa'
        };
        return statusMap[status] || status;
    }

    // Utility Functions
    updateProjectFilter() {
        const projectFilter = document.getElementById('projectFilter');
        if (!projectFilter) return;

        const currentValue = projectFilter.value;
        projectFilter.innerHTML = '<option value="">Todos os Projetos</option>';
        this.projects.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            projectFilter.appendChild(option);
        });
        
        if (this.projectFilterValue && this.projects.some(p => p.id === this.projectFilterValue)) {
            projectFilter.value = this.projectFilterValue;
        } else if (this.projects.some(p => p.id === currentValue)) {
            projectFilter.value = currentValue;
        } else {
            projectFilter.value = '';
        }
    }

    populateProjectSelect() {
        const select = document.getElementById('projectSelect');
        if (!select) return;
        select.innerHTML = '';
        
        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = 'Sem projeto';
        select.appendChild(noneOpt);
        
        this.projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            select.appendChild(opt);
        });
        
        const createOpt = document.createElement('option');
        createOpt.value = '__new__';
        createOpt.textContent = 'Criar novo projeto...';
        select.appendChild(createOpt);
    }

    onProjectSelectChange() {
        const select = document.getElementById('projectSelect');
        const group = document.getElementById('newProjectGroup');
        if (!select || !group) return;
        group.style.display = select.value === '__new__' ? 'block' : 'none';
    }

    getProjectName(projectId) {
        const p = this.projects.find(pr => pr.id === projectId);
        return p ? p.name : '';
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatCurrency(value) {
        try {
            return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } catch (e) {
            return `R$ ${value.toFixed(2)}`;
        }
    }

    parseTimeInput(input) {
        if (!input) return null;
        const s = String(input).trim();
        const parts = s.split(':').map(x => x.trim());
        if (parts.length === 3) {
            const [h, m, sec] = parts.map(n => Number(n));
            if ([h, m, sec].some(n => Number.isNaN(n))) return null;
            if (m < 0 || m > 59 || sec < 0 || sec > 59) return null;
            return h * 3600 + m * 60 + sec;
        }
        if (parts.length === 2) {
            const [h, m] = parts.map(n => Number(n));
            if ([h, m].some(n => Number.isNaN(n))) return null;
            if (m < 0 || m > 59) return null;
            return h * 3600 + m * 60;
        }
        const asDecimal = Number(s.replace(',', '.'));
        if (Number.isNaN(asDecimal)) return null;
        return Math.round(asDecimal * 3600);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    startTimerUpdates() {
        setInterval(() => {
            this.updateTimerDisplay();
        }, 1000);
    }

    updateTimerDisplay() {
        this.timers.forEach((timer, taskId) => {
            if (timer.isRunning) {
                const elapsed = timer.elapsed + Math.floor((Date.now() - timer.startTime) / 1000);
                const display = document.getElementById(`timer-${taskId}`);
                if (display) {
                    display.textContent = this.formatTime(elapsed);
                }
                
                const costEl = document.getElementById(`cost-${taskId}`);
                if (costEl) {
                    const task = this.tasks.find(t => t.id === taskId);
                    if (task && typeof task.hourlyRate === 'number' && task.hourlyRate > 0) {
                        const hours = elapsed / 3600;
                        const cost = hours * task.hourlyRate;
                        costEl.textContent = this.formatCurrency(cost);
                    }
                }
            }
        });

        const earningsEl = document.getElementById('totalEarnings');
        if (earningsEl) {
            let total = 0;
            const now = Date.now();
            this.tasks.forEach(t => {
                const rate = Number(t.hourlyRate) || 0;
                if (rate <= 0) return;
                const timer = this.timers.get(t.id);
                let hours = Number(t.actualHours) || 0;
                if (timer && timer.isRunning) {
                    const elapsed = timer.elapsed + Math.floor((now - timer.startTime) / 1000);
                    hours = elapsed / 3600;
                }
                total += hours * rate;
            });
            earningsEl.textContent = this.formatCurrency(total);
        }
    }
}

// Setup drag and drop functionality for task cards
document.addEventListener('DOMContentLoaded', () => {
    const kanbanManager = new KanbanTaskManager();
    
    // Add drag start and end event listeners
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('kanban-task-card')) {
            e.target.classList.add('dragging');
            const taskId = e.target.dataset.taskId;
            kanbanManager.draggedTask = kanbanManager.tasks.find(t => t.id === taskId);
        }
    });
    
    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('kanban-task-card')) {
            e.target.classList.remove('dragging');
        }
    });
});
