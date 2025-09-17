// Task Time Manager - Popup JavaScript
class TaskManager {
    constructor() {
        this.tasks = [];
        this.projects = [];
        this.currentEditingTask = null;
        this.timers = new Map(); // Para armazenar timers ativos
        this.currentEditingTimerTaskId = null;
        this.justClosedTaskModalAt = 0; // evita reabrir modal por clique embaixo
        this.sortOption = 'created_desc'; // preferência de ordenação da lista
        this.statusFilterValue = '';
        this.projectFilterValue = '';
        this.init();
    }

    async init() {
        await this.loadTasks();
        // Restaurar timers que estavam em execução previamente
        await this.loadRunningTimers();
        await this.loadProjects();
        await this.loadPreferences(); // carregar preferências (inclui sort) antes de ligar eventos
        this.setupEventListeners();
        this.renderTasks();
        this.updateStats();
        this.updateProjectFilter();
        this.renderProjects();
    }

    // Event Listeners
    setupEventListeners() {
        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Modal
        document.getElementById('addTaskBtn').addEventListener('click', () => this.openTaskModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeTaskModal());
        document.getElementById('cancelTask').addEventListener('click', () => this.closeTaskModal());
        document.getElementById('taskForm').addEventListener('submit', (e) => this.handleTaskSubmit(e));
        const projectSelectEl = document.getElementById('projectSelect');
        if (projectSelectEl) {
            projectSelectEl.addEventListener('change', () => this.onProjectSelectChange());
        }

        // Filters
        const statusFilterEl = document.getElementById('statusFilter');
        statusFilterEl.addEventListener('change', async (e) => {
            this.statusFilterValue = e.target.value || '';
            await this.saveFilterOptions();
            this.renderTasks();
        });
        const projectFilterEl = document.getElementById('projectFilter');
        if (projectFilterEl) projectFilterEl.addEventListener('change', async (e) => {
            this.projectFilterValue = e.target.value || '';
            await this.saveFilterOptions();
            this.renderTasks();
        });
        const sortEl = document.getElementById('sortBy');
        if (sortEl) {
            // garantir valor inicial se salvo
            sortEl.value = this.sortOption || 'created_desc';
            sortEl.addEventListener('change', async (e) => {
                this.sortOption = e.target.value;
                await this.saveSortOption();
                this.renderTasks();
            });
        }

        // Close modal when clicking outside
        document.getElementById('taskModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') {
                this.closeTaskModal();
            }
        });

        // Close project modal when clicking outside
        const projectModalEl = document.getElementById('projectModal');
        if (projectModalEl) {
            projectModalEl.addEventListener('click', (e) => {
                if (e.target.id === 'projectModal') {
                    this.closeProjectModal();
                }
            });
        }

        // Edit timer modal events
        const editTimerModal = document.getElementById('editTimerModal');
        const closeEditTimerBtn = document.getElementById('closeEditTimerModal');
        const cancelEditTimerBtn = document.getElementById('cancelEditTimer');
        const editTimerForm = document.getElementById('editTimerForm');
        if (closeEditTimerBtn) closeEditTimerBtn.addEventListener('click', () => this.closeEditTimerModal());
        if (cancelEditTimerBtn) cancelEditTimerBtn.addEventListener('click', () => this.closeEditTimerModal());
        if (editTimerForm) editTimerForm.addEventListener('submit', (e) => this.handleEditTimerSubmit(e));
        if (editTimerModal) {
            editTimerModal.addEventListener('click', (e) => {
                if (e.target.id === 'editTimerModal') this.closeEditTimerModal();
            });
        }

        // Delegated actions inside tasks list (avoid inline handlers)
        const tasksList = document.getElementById('tasksList');
        tasksList.addEventListener('click', (e) => {
            // Ignora clique imediatamente após fechar o modal (evita "click-through")
            if (this.justClosedTaskModalAt && (Date.now() - this.justClosedTaskModalAt) < 400) {
                return;
            }
            const btn = e.target.closest('button');
            if (!btn || !tasksList.contains(btn)) return;
            const action = btn.dataset.action;
            if (!action) return;

            const taskId = btn.dataset.taskId;
            switch (action) {
                case 'open-create-modal':
                    this.openTaskModal();
                    break;
                case 'edit': {
                    const task = this.tasks.find(t => t.id === taskId);
                    if (task) this.openTaskModal(task);
                    break;
                }
                case 'delete':
                    this.deleteTask(taskId);
                    this.renderTasks();
                    break;
                case 'toggle-timer':
                    this.toggleTimer(taskId);
                    break;
                case 'reset-timer': {
                    const task = this.tasks.find(t => t.id === taskId);
                    const taskName = task && task.title ? `"${task.title}"` : 'esta tarefa';
                    const ok = confirm(`Tem certeza que deseja reiniciar o tempo de ${taskName}?\nEsta ação não pode ser desfeita.`);
                    if (ok) this.resetTimer(taskId);
                    break;
                }
                case 'edit-timer':
                    this.openEditTimerModal(taskId);
                    break;
                case 'export-task-note':
                    this.exportServiceNoteForTask(taskId);
                    break;
            }
        });

        // Projects tab actions
        const addProjectBtn = document.getElementById('addProjectBtn');
        if (addProjectBtn) {
            addProjectBtn.addEventListener('click', () => this.openProjectModal());
        }

        // Project modal events
        const closeProjectModalBtn = document.getElementById('closeProjectModal');
        const cancelProjectBtn = document.getElementById('cancelProject');
        const projectForm = document.getElementById('projectForm');
        if (closeProjectModalBtn) closeProjectModalBtn.addEventListener('click', () => this.closeProjectModal());
        if (cancelProjectBtn) cancelProjectBtn.addEventListener('click', () => this.closeProjectModal());
        if (projectForm) projectForm.addEventListener('submit', (e) => this.handleProjectSubmit(e));

        const projectsList = document.getElementById('projectsList');
        if (projectsList) {
            projectsList.addEventListener('click', async (e) => {
                const btn = e.target.closest('button[data-action]');
                if (!btn) return;
                const action = btn.dataset.action;
                const projectId = btn.dataset.projectId;
                if (action === 'delete-project') {
                    const inUse = this.tasks.some(t => t.projectId === projectId);
                    if (inUse) {
                        alert('Não é possível excluir um projeto com tarefas associadas.');
                        return;
                    }
                    await this.deleteProject(projectId);
                    this.updateProjectFilter();
                    this.renderProjects();
                    this.renderTasks();
                    return;
                }
                if (action === 'rename-project') {
                    const proj = this.projects.find(p => p.id === projectId);
                    if (!proj) return;
                    this.openProjectModal(proj);
                }
                if (action === 'export-project-note') {
                    this.exportServiceNoteForProject(projectId);
                }
            });
        }

        // Backup tab actions
        const exportBtn = document.getElementById('exportDataBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }
        const importBtn = document.getElementById('importDataBtn');
        const importInput = document.getElementById('importFileInput');
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', (e) => this.handleImportFile(e.target.files[0]));
        }
    }

    async loadPreferences() {
        try {
            const result = await chrome.storage.local.get(['taskSortOption', 'taskStatusFilter', 'taskProjectFilter']);
            if (result && result.taskSortOption) this.sortOption = result.taskSortOption;
            if (result && typeof result.taskStatusFilter !== 'undefined') this.statusFilterValue = result.taskStatusFilter || '';
            if (result && typeof result.taskProjectFilter !== 'undefined') this.projectFilterValue = result.taskProjectFilter || '';

            const sortEl = document.getElementById('sortBy');
            if (sortEl) sortEl.value = this.sortOption;
            const statusEl = document.getElementById('statusFilter');
            if (statusEl) statusEl.value = this.statusFilterValue || '';
            const projEl = document.getElementById('projectFilter');
            if (projEl) projEl.value = this.projectFilterValue || '';
        } catch (err) {
            console.warn('Não foi possível carregar preferências:', err);
        }
    }

    async saveSortOption() {
        try {
            await chrome.storage.local.set({ taskSortOption: this.sortOption });
        } catch (err) {
            console.warn('Não foi possível salvar preferência de ordenação:', err);
        }
    }

    async saveFilterOptions() {
        try {
            await chrome.storage.local.set({
                taskStatusFilter: this.statusFilterValue || '',
                taskProjectFilter: this.projectFilterValue || ''
            });
        } catch (err) {
            console.warn('Não foi possível salvar filtros:', err);
        }
    }

    openProjectModal(project = null) {
        const modal = document.getElementById('projectModal');
        document.getElementById('projectId').value = project ? project.id : '';
        document.getElementById('projectName').value = project ? project.name : '';
        document.getElementById('projectModalTitle').textContent = project ? 'Editar Projeto' : 'Novo Projeto';
        modal.style.display = 'block';
    }

    closeProjectModal() {
        const modal = document.getElementById('projectModal');
        modal.style.display = 'none';
        document.getElementById('projectId').value = '';
        document.getElementById('projectName').value = '';
    }

    async handleProjectSubmit(e) {
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

        await this.saveProjects();
        this.updateProjectFilter();
        this.renderProjects();
        this.populateProjectSelect();
        this.closeProjectModal();
    }

    // Storage Management
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

    // Timers persistence (somente timers em execução)
    async loadRunningTimers() {
        try {
            const result = await chrome.storage.local.get(['runningTimers']);
            const stored = result.runningTimers || {};
            this.timers = new Map();
            Object.entries(stored).forEach(([taskId, t]) => {
                // Apenas restaura se ainda existir a tarefa
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

    // Task CRUD Operations
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
        this.updateProjectFilter();
        this.updateStats();
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
            this.updateStats();
        }
    }

    deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        // Remover timer associado, se houver
        if (this.timers.has(taskId)) {
            this.timers.delete(taskId);
            this.saveRunningTimers();
        }
        this.saveTasks();
        this.updateStats();
        this.updateProjectFilter();
    }

    // UI Management
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        if (tabName === 'stats') {
            this.updateStats();
        }
        if (tabName === 'projects') {
            this.renderProjects();
        }
    }

    openTaskModal(task = null) {
        this.currentEditingTask = task;
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        this.populateProjectSelect();
        
        if (task) {
            document.getElementById('modalTitle').textContent = 'Editar Tarefa';
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description;
            document.getElementById('estimatedHours').value = task.estimatedHours;
            document.getElementById('hourlyRate').value = typeof task.hourlyRate === 'number' ? task.hourlyRate : '';
            document.getElementById('taskDeadline').value = task.deadline || '';
            document.getElementById('taskStatus').value = task.status;
            const projectSelect = document.getElementById('projectSelect');
            // Permitir manter tarefa sem projeto selecionando a opção vazia
            projectSelect.value = task.projectId || '';
            document.getElementById('newProjectGroup').style.display = 'none';
        } else {
            document.getElementById('modalTitle').textContent = 'Nova Tarefa';
            form.reset();
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
        const modal = document.getElementById('taskModal');
        if (modal) modal.style.display = 'none';
        this.justClosedTaskModalAt = Date.now();
        this.currentEditingTask = null;
    }

    handleTaskSubmit(e) {
        e.preventDefault();
        
        const formData = {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            deadline: document.getElementById('taskDeadline').value,
            status: document.getElementById('taskStatus').value
        };
        // Numeric fields parsing
        const estVal = parseFloat(document.getElementById('estimatedHours').value);
        formData.estimatedHours = isNaN(estVal) ? 0 : estVal;

        // Project selection
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

        // Hourly rate
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
        this.renderTasks();
    }

    // Task Rendering
    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        const statusFilter = document.getElementById('statusFilter').value;
        const projectFilter = document.getElementById('projectFilter') ? document.getElementById('projectFilter').value : '';

        let filteredTasks = this.tasks;

        if (statusFilter) {
            filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
        }

        if (projectFilter) {
            filteredTasks = filteredTasks.filter(task => task.projectId === projectFilter);
        }

        // Ordenação
        filteredTasks = this.sortTasks(filteredTasks);

        if (filteredTasks.length === 0) {
            tasksList.innerHTML = `
                <div class="empty-state">
                    <h3>Nenhuma tarefa encontrada</h3>
                    <p>${this.tasks.length === 0 ? 'Comece criando sua primeira tarefa!' : 'Tente ajustar os filtros.'}</p>
                    ${this.tasks.length === 0 ? '<button class="btn btn-primary" data-action="open-create-modal">Criar Tarefa</button>' : ''}
                </div>
            `;
            return;
        }

        tasksList.innerHTML = filteredTasks.map(task => this.createTaskCard(task)).join('');
        this.bindTaskCardEvents();
    }

    sortTasks(tasks) {
        const opt = this.sortOption || 'created_desc';
        const statusOrder = {
            'Not Started': 0,
            'In Progress': 1,
            'On Hold': 2,
            'Completed': 3
        };
        const getDate = (d) => d ? new Date(d).getTime() : null;
        const getProjectName = (t) => (this.getProjectName(t.projectId) || '').toLowerCase();
        const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

        const arr = [...tasks];
        arr.sort((a, b) => {
            switch (opt) {
                case 'created_asc':
                    return (getDate(a.createdAt) || 0) - (getDate(b.createdAt) || 0);
                case 'created_desc':
                    return (getDate(b.createdAt) || 0) - (getDate(a.createdAt) || 0);
                case 'deadline_asc': {
                    const ad = getDate(a.deadline);
                    const bd = getDate(b.deadline);
                    if (ad === null && bd === null) return 0;
                    if (ad === null) return 1; // sem prazo vai para o fim
                    if (bd === null) return -1;
                    return ad - bd;
                }
                case 'deadline_desc': {
                    const ad = getDate(a.deadline);
                    const bd = getDate(b.deadline);
                    if (ad === null && bd === null) return 0;
                    if (ad === null) return 1;
                    if (bd === null) return -1;
                    return bd - ad;
                }
                case 'title_asc':
                    return collator.compare(a.title || '', b.title || '');
                case 'title_desc':
                    return collator.compare(b.title || '', a.title || '');
                case 'status':
                    return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
                case 'project':
                    return collator.compare(getProjectName(a), getProjectName(b));
                default:
                    return (getDate(b.createdAt) || 0) - (getDate(a.createdAt) || 0);
            }
        });
        return arr;
    }

    bindTaskCardEvents() {
        const list = document.getElementById('tasksList');
        const cards = list.querySelectorAll('.task-card');
        cards.forEach(card => {
            const taskId = card.dataset.taskId;
            if (!taskId) return;

            // Garantir que todos os botões dentro do card tenham o taskId associado
            card.querySelectorAll('.task-actions .btn').forEach(btn => {
                btn.dataset.taskId = taskId;
            });

            // Timer controls (order: play, edit, restart)
            const toggleBtn = card.querySelector('.timer-controls .btn:nth-child(1)');
            const editBtn = card.querySelector('.timer-controls .btn:nth-child(2)');
            const resetBtn = card.querySelector('.timer-controls .btn:nth-child(3)');
            if (toggleBtn) {
                toggleBtn.dataset.action = 'toggle-timer';
                toggleBtn.dataset.taskId = taskId;
            }
            if (editBtn) {
                editBtn.dataset.action = 'edit-timer';
                editBtn.dataset.taskId = taskId;
            }
            if (resetBtn) {
                resetBtn.dataset.action = 'reset-timer';
                resetBtn.dataset.taskId = taskId;
            }
        });
    }

    createTaskCard(task) {
        const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'Completed';
        const timer = this.timers.get(task.id);
        const isTimerRunning = timer && timer.isRunning;

        const now = Date.now();
        const displaySeconds = isTimerRunning
            ? (timer.elapsed + Math.floor((now - timer.startTime) / 1000))
            : Math.round((task.actualHours || 0) * 3600);
        return `
            <div class="task-card" data-task-id="${task.id}">
                <div class="task-header">
                    <div>
                        <div class="task-title">${this.escapeHtml(task.title)}</div>
                        ${this.getProjectName(task.projectId) ? `<span class=\"task-category\">${this.escapeHtml(this.getProjectName(task.projectId))}</span>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="btn btn-small" title="Exportar nota" data-action="export-task-note" data-task-id="${task.id}">📄</button>
                        <button class="btn btn-small btn-success" data-action="edit" data-task-id="${task.id}">✏️</button>
                        <button class="btn btn-small btn-secondary" data-action="delete" data-task-id="${task.id}">🗑️</button>
                    </div>
                </div>
                
                ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                
                <div class="task-meta">
                    <span class="task-status status-${task.status.toLowerCase().replace(' ', '-')}">
                        ${this.getStatusText(task.status)}
                    </span>
                    <span class="task-time">
                        ${this.formatTime(Math.round((task.actualHours || 0) * 3600))}
                        /
                        ${this.formatTime(Math.round((task.estimatedHours || 0) * 3600))}
                        ${task.hourlyRate && task.hourlyRate > 0 ? ` • ${this.formatCurrency(task.hourlyRate)}/h` : ''}
                    </span>
                </div>
                
                ${task.deadline ? `
                    <div class="task-deadline ${isOverdue ? 'overdue' : ''}">
                        📅 Prazo: ${new Date(task.deadline).toLocaleDateString('pt-BR')}
                        ${isOverdue ? ' (Atrasado!)' : ''}
                    </div>
                ` : ''}
                
                <div class="timer">
                    <div class="timer-display" id="timer-${task.id}">
                        ${this.formatTime(displaySeconds)}
                    </div>
                    <div class="timer-controls">
                        <button class="btn btn-small ${isTimerRunning ? 'btn-warning' : 'btn-success'}" data-action="toggle-timer" data-task-id="${task.id}">${isTimerRunning ? '⏸️' : '▶️'}</button>
                        <button class="btn btn-small" title="Editar tempo" data-action="edit-timer" data-task-id="${task.id}">✏️</button>
                        <button class="btn btn-small btn-secondary" data-action="reset-timer" data-task-id="${task.id}">🔄</button>
                    </div>
                    ${task.hourlyRate && task.hourlyRate > 0 ? `
                    <div class="task-cost">
                        Custo: <span id="cost-${task.id}">${this.formatCurrency((task.actualHours || 0) * task.hourlyRate)}</span>
                    </div>` : ''}
                </div>
            </div>
        `;
    }

    // Timer Management
    toggleTimer(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        let timer = this.timers.get(taskId);
        
        if (!timer) {
            timer = {
                startTime: null,
                elapsed: task.actualHours * 3600, // Convert hours to seconds
                isRunning: false
            };
            this.timers.set(taskId, timer);
        }

        if (timer.isRunning) {
            // Stop timer
            timer.elapsed += Math.floor((Date.now() - timer.startTime) / 1000);
            timer.isRunning = false;
            timer.startTime = null;
            
            // Update task actual hours
            task.actualHours = timer.elapsed / 3600;
            this.updateTask(taskId, { actualHours: task.actualHours });
            // Persistir estado dos timers (removerá este se não estiver rodando)
            this.saveRunningTimers();
        } else {
            // Start timer
            timer.startTime = Date.now();
            timer.isRunning = true;
            // Persistir timers em execução
            this.saveRunningTimers();
        }

        this.renderTasks();
    }

    resetTimer(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.timers.delete(taskId);
        task.actualHours = 0;
        this.updateTask(taskId, { actualHours: 0 });
        this.saveRunningTimers();
        this.renderTasks();
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
        const modal = document.getElementById('editTimerModal');
        if (modal) modal.style.display = 'none';
        this.currentEditingTimerTaskId = null;
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

        // Atualizar task e timer
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
        // Atualizar persistência de timers
        this.saveRunningTimers();

        this.closeEditTimerModal();
        this.renderTasks();
    }

    parseTimeInput(input) {
        if (!input) return null;
        const s = String(input).trim();
        // Try HH:MM:SS or HH:MM
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
        // Try decimal hours (accept comma or dot)
        const asDecimal = Number(s.replace(',', '.'));
        if (Number.isNaN(asDecimal)) return null;
        return Math.round(asDecimal * 3600);
    }

    updateTimerDisplay() {
        this.timers.forEach((timer, taskId) => {
            if (timer.isRunning) {
                const elapsed = timer.elapsed + Math.floor((Date.now() - timer.startTime) / 1000);
                const display = document.getElementById(`timer-${taskId}`);
                if (display) {
                    display.textContent = this.formatTime(elapsed);
                }
                // Update cost in real-time if applicable
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
            // Fallback simples
            return `R$ ${value.toFixed(2)}`;
        }
    }

    // Statistics
    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.status === 'Completed').length;
        const inProgress = this.tasks.filter(t => t.status === 'In Progress').length;
        const overdue = this.tasks.filter(t => 
            t.deadline && new Date(t.deadline) < new Date() && t.status !== 'Completed'
        ).length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const totalEstimated = this.tasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
        const totalActual = this.tasks.reduce((sum, t) => sum + (Number(t.actualHours) || 0), 0);
        const efficiency = totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0;

        document.getElementById('totalTasks').textContent = total;
        document.getElementById('completedTasks').textContent = completed;
        document.getElementById('inProgressTasks').textContent = inProgress;
        document.getElementById('overdueTasks').textContent = overdue;
        document.getElementById('completionRate').textContent = `${completionRate}%`;
        document.getElementById('totalEstimated').textContent = `${totalEstimated.toFixed(1)}h`;
        document.getElementById('totalActual').textContent = `${totalActual.toFixed(1)}h`;
        document.getElementById('efficiency').textContent = `${efficiency}%`;
    }

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
        // Preferir a preferência salva; senão, manter o valor atual se ainda válido
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
        // Opção para manter a tarefa sem projeto
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

    createProjectSync(name) {
        const project = { id: `p_${Date.now()}`, name, createdAt: new Date().toISOString() };
        this.projects.push(project);
        return project;
    }

    async deleteProject(projectId) {
        this.projects = this.projects.filter(p => p.id !== projectId);
        await this.saveProjects();
    }

    getProjectName(projectId) {
        const p = this.projects.find(pr => pr.id === projectId);
        return p ? p.name : '';
    }

    renderProjects() {
        const container = document.getElementById('projectsList');
        if (!container) return;
        if (this.projects.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Nenhum projeto cadastrado.</p></div>';
            return;
        }
        container.innerHTML = this.projects.map(p => {
            const count = this.tasks.filter(t => t.projectId === p.id).length;
            return `
                <div class=\"task-card\">
                    <div class=\"task-header\">
                        <div>
                            <div class=\"task-title\">${this.escapeHtml(p.name)}</div>
                            <span class=\"task-category\">${count} tarefa(s)</span>
                        </div>
                        <div class=\"task-actions\"> 
                            <button class=\"btn btn-small\" title=\"Exportar nota do projeto\" data-action=\"export-project-note\" data-project-id=\"${p.id}\">📄</button>
                            <button class=\"btn btn-small btn-success\" data-action=\"rename-project\" data-project-id=\"${p.id}\">✏️</button>
                            <button class=\"btn btn-small btn-secondary\" data-action=\"delete-project\" data-project-id=\"${p.id}\">🗑️</button>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    // Utility Functions
    getStatusText(status) {
        const statusMap = {
            'Not Started': 'Não Iniciado',
            'In Progress': 'Em Progresso',
            'Completed': 'Concluído',
            'On Hold': 'Em Pausa'
        };
        return statusMap[status] || status;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Backup: Export/Import
    exportData() {
        try {
            const payload = {
                meta: {
                    app: 'chrome-task-time-manager',
                    version: 1,
                    exportedAt: new Date().toISOString()
                },
                projects: this.projects || [],
                tasks: this.tasks || []
            };
            const json = JSON.stringify(payload, null, 2);
            const ts = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const filename = `task-time-manager-backup-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}.json`;
            this.downloadFile(filename, json);
        } catch (err) {
            console.error('Erro ao exportar:', err);
            alert('Falha ao exportar dados.');
        }
    }

    downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'application/json' });
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

    downloadBlob(filename, content, mime = 'text/plain') {
        const blob = new Blob([content], { type: mime });
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

    exportServiceNoteForTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return alert('Tarefa não encontrada.');
        const projectName = this.getProjectName(task.projectId) || 'Sem projeto';
        const html = this.generateServiceNoteHTMLForTask(task, projectName);
        const ts = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const slug = (task.title || 'tarefa').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
        const filename = `nota-servico-tarefa-${slug}-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}.html`;
        this.downloadBlob(filename, html, 'text/html');
    }

    exportServiceNoteForProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return alert('Projeto não encontrado.');
        const tasks = this.tasks.filter(t => t.projectId === projectId);
        const html = this.generateServiceNoteHTMLForProject(project, tasks);
        const ts = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const slug = (project.name || 'projeto').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
        const filename = `nota-servico-projeto-${slug}-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}.html`;
        this.downloadBlob(filename, html, 'text/html');
    }

    formatHoursDecimal(hours) {
        const value = Number(hours) || 0;
        return value.toFixed(2).replace('.', ',');
    }

    generateServiceNoteHeaderCSS() {
        return `
            <style>
                body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; color: #222; }
                h1 { margin: 0 0 8px; font-size: 22px; }
                h2 { margin: 24px 0 8px; font-size: 18px; }
                .muted { color: #666; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
                .box { border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-top: 12px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; }
                th { background: #fafafa; }
                .right { text-align: right; }
                .total { font-weight: 600; }
                .small { font-size: 12px; }
                .badge { display:inline-block; padding:2px 8px; border-radius:12px; background:#f2f2f2; font-size:12px; }
            </style>
        `;
    }

    generateServiceNoteHTMLForTask(task, projectName) {
        const now = new Date();
        const brDate = now.toLocaleDateString('pt-BR');
        const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString('pt-BR') : '-';
        const hours = Number(task.actualHours || 0);
        const rate = Number(task.hourlyRate || 0);
        const cost = hours * rate;
        const statusPt = this.getStatusText(task.status);
        const descHtml = task.description ? this.escapeHtml(task.description).replace(/\n/g, '<br>') : '—';
        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nota de Serviço - ${this.escapeHtml(task.title)}</title>
  ${this.generateServiceNoteHeaderCSS()}
  <style>@media print { .no-print { display:none; } }</style>
  <script>function printAndClose(){ window.print(); }</script>
  </head>
<body>
  <div class="no-print" style="text-align:right; margin-bottom:8px;">
    <button onclick="printAndClose()" style="padding:6px 12px;">Imprimir/Salvar PDF</button>
  </div>
  <h1>Nota de Serviço</h1>
  <div class="muted small">Emitida em ${brDate}</div>
  <div class="box">
    <div class="grid">
      <div><strong>Tarefa:</strong> ${this.escapeHtml(task.title)}</div>
      <div><strong>Projeto:</strong> ${this.escapeHtml(projectName)}</div>
      <div><strong>Status:</strong> <span class="badge">${this.escapeHtml(statusPt)}</span></div>
      <div><strong>Prazo:</strong> ${deadline}</div>
    </div>
    <div style="margin-top:8px"><strong>Descrição:</strong><br>${descHtml}</div>
  </div>

  <h2>Resumo</h2>
  <table>
    <thead>
      <tr>
        <th>Horas (hh:mm:ss)</th>
        <th>Valor/hora</th>
        <th class="right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${this.formatTime(Math.round(hours * 3600))}</td>
        <td>${rate > 0 ? this.formatCurrency(rate) : '—'}</td>
        <td class="right">${this.formatCurrency(cost)}</td>
      </tr>
      <tr>
        <td colspan="2" class="right total">Total</td>
        <td class="right total">${this.formatCurrency(cost)}</td>
      </tr>
    </tbody>
  </table>

  <p class="small muted">Documento gerado pelo Task Time Manager.</p>
</body>
</html>`;
    }

    generateServiceNoteHTMLForProject(project, tasks) {
        const now = new Date();
        const brDate = now.toLocaleDateString('pt-BR');
        const rows = tasks.map(t => {
            const hours = Number(t.actualHours || 0);
            const rate = Number(t.hourlyRate || 0);
            const cost = hours * rate;
            return {
                title: t.title,
                hours,
                rate,
                cost,
                status: this.getStatusText(t.status),
                deadline: t.deadline ? new Date(t.deadline).toLocaleDateString('pt-BR') : '-'
            };
        });
        const totalHours = rows.reduce((s, r) => s + r.hours, 0);
        const totalCost = rows.reduce((s, r) => s + r.cost, 0);

        const tableRows = rows.map(r => `
            <tr>
                <td>${this.escapeHtml(r.title)}</td>
                <td>${this.escapeHtml(r.status)}</td>
                <td>${r.deadline}</td>
        <td class="right">${this.formatTime(Math.round(r.hours * 3600))}</td>
                <td class="right">${r.rate > 0 ? this.formatCurrency(r.rate) : '—'}</td>
                <td class="right">${this.formatCurrency(r.cost)}</td>
            </tr>
        `).join('');

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nota de Serviço - Projeto ${this.escapeHtml(project.name)}</title>
  ${this.generateServiceNoteHeaderCSS()}
  <style>@media print { .no-print { display:none; } }</style>
  <script>function printAndClose(){ window.print(); }</script>
</head>
<body>
  <div class="no-print" style="text-align:right; margin-bottom:8px;">
    <button onclick="printAndClose()" style="padding:6px 12px;">Imprimir/Salvar PDF</button>
  </div>
  <h1>Nota de Serviço</h1>
  <div class="muted small">Emitida em ${brDate}</div>
  <div class="box">
    <div><strong>Projeto:</strong> ${this.escapeHtml(project.name)}</div>
    <div class="small muted">${tasks.length} tarefa(s)</div>
  </div>

  <h2>Detalhamento das Tarefas</h2>
  <table>
    <thead>
      <tr>
        <th>Tarefa</th>
        <th>Status</th>
        <th>Prazo</th>
        <th class="right">Horas (hh:mm:ss)</th>
        <th class="right">Valor/hora</th>
        <th class="right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="6" class="small muted">Nenhuma tarefa vinculada.</td></tr>'}
      <tr>
        <td colspan="3" class="right total">Totais</td>
        <td class="right total">${this.formatTime(Math.round(totalHours * 3600))}</td>
        <td></td>
        <td class="right total">${this.formatCurrency(totalCost)}</td>
      </tr>
    </tbody>
  </table>

  <p class="small muted">Documento gerado pelo Task Time Manager.</p>
</body>
</html>`;
    }

    async handleImportFile(file) {
        const statusEl = document.getElementById('importStatus');
        const inputEl = document.getElementById('importFileInput');
        if (!file) return;
        if (statusEl) statusEl.textContent = `Arquivo selecionado: ${file.name} (${file.size} bytes)`;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data || (typeof data !== 'object')) throw new Error('JSON inválido');
            const replace = confirm('Deseja substituir TODOS os dados atuais?\nOK = Substituir, Cancelar = Mesclar');
            await this.applyImport(data, replace);
            if (statusEl) statusEl.textContent = `Importação concluída com sucesso (${replace ? 'substituição' : 'mesclagem'}).`;
            if (inputEl) inputEl.value = '';
        } catch (err) {
            console.error('Erro ao importar:', err);
            alert('Falha ao importar dados. Verifique o arquivo JSON.');
        }
    }

    async applyImport(data, replace = false) {
        const incomingProjects = Array.isArray(data.projects) ? data.projects : [];
        const incomingTasks = Array.isArray(data.tasks) ? data.tasks : [];

        if (replace) {
            this.projects = incomingProjects;
            this.tasks = incomingTasks;
        } else {
            // Mesclar por id
            const projectById = new Map(this.projects.map(p => [p.id, { ...p }]));
            incomingProjects.forEach(p => {
                if (!p || !p.id) return;
                if (projectById.has(p.id)) {
                    projectById.set(p.id, { ...projectById.get(p.id), ...p });
                } else {
                    projectById.set(p.id, { ...p });
                }
            });
            this.projects = Array.from(projectById.values());

            const taskById = new Map(this.tasks.map(t => [t.id, { ...t }]));
            incomingTasks.forEach(t => {
                if (!t || !t.id) return;
                if (taskById.has(t.id)) {
                    taskById.set(t.id, { ...taskById.get(t.id), ...t });
                } else {
                    taskById.set(t.id, { ...t });
                }
            });
            this.tasks = Array.from(taskById.values());
        }

        await this.saveProjects();
        await this.saveTasks();
        this.updateProjectFilter();
        this.renderProjects();
        this.renderTasks();
        this.updateStats();
        alert('Dados importados com sucesso.');
    }
}

// Initialize the task manager when the popup loads
let taskManager;
document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManager();
    
    // Update timer displays every second
    setInterval(() => {
        taskManager.updateTimerDisplay();
    }, 1000);
});
