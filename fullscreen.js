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
        document.getElementById('statsBtn').addEventListener('click', () => this.toggleStatsPanel());
        document.getElementById('closeStatsBtn').addEventListener('click', () => this.toggleStatsPanel());

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
