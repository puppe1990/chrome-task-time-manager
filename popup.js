// Task Time Manager - Popup JavaScript
class TaskManager {
    constructor() {
        this.tasks = [];
        this.projects = [];
        this.currentEditingTask = null;
        this.timers = new Map(); // Para armazenar timers ativos
        this.init();
    }

    async init() {
        await this.loadTasks();
        await this.loadProjects();
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
        document.getElementById('statusFilter').addEventListener('change', () => this.renderTasks());
        const projectFilterEl = document.getElementById('projectFilter');
        if (projectFilterEl) projectFilterEl.addEventListener('change', () => this.renderTasks());

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

        // Delegated actions inside tasks list (avoid inline handlers)
        const tasksList = document.getElementById('tasksList');
        tasksList.addEventListener('click', (e) => {
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
                case 'reset-timer':
                    this.resetTimer(taskId);
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
            });
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
            projectSelect.value = task.projectId || '';
            if (!projectSelect.value) {
                projectSelect.value = '__new__';
                document.getElementById('newProjectGroup').style.display = 'block';
            } else {
                document.getElementById('newProjectGroup').style.display = 'none';
            }
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
        document.getElementById('taskModal').style.display = 'none';
        this.currentEditingTask = null;
    }

    handleTaskSubmit(e) {
        e.preventDefault();
        
        const formData = {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            estimatedHours: document.getElementById('estimatedHours').value,
            deadline: document.getElementById('taskDeadline').value,
            status: document.getElementById('taskStatus').value
        };

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

    bindTaskCardEvents() {
        const list = document.getElementById('tasksList');
        const cards = list.querySelectorAll('.task-card');
        cards.forEach(card => {
            const taskId = card.dataset.taskId;
            if (!taskId) return;

            const [editBtn, deleteBtn] = card.querySelectorAll('.task-actions .btn');
            if (editBtn) {
                editBtn.dataset.action = 'edit';
                editBtn.dataset.taskId = taskId;
            }
            if (deleteBtn) {
                deleteBtn.dataset.action = 'delete';
                deleteBtn.dataset.taskId = taskId;
            }

            const [toggleBtn, resetBtn] = card.querySelectorAll('.timer-controls .btn');
            if (toggleBtn) {
                toggleBtn.dataset.action = 'toggle-timer';
                toggleBtn.dataset.taskId = taskId;
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

        return `
            <div class="task-card" data-task-id="${task.id}">
                <div class="task-header">
                    <div>
                        <div class="task-title">${this.escapeHtml(task.title)}</div>
                        ${this.getProjectName(task.projectId) ? `<span class=\"task-category\">${this.escapeHtml(this.getProjectName(task.projectId))}</span>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="btn btn-small btn-success" data-action="edit" data-task-id="${task.id}">✏️</button>
                        <button class="btn btn-small btn-secondary" data-action="delete" data-task-id="${task.id}">🗑️</button>
                    </div>
                </div>
                
                ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                
                <div class="task-meta">
                    <span class="task-status status-${task.status.toLowerCase().replace(' ', '-')}">
                        ${this.getStatusText(task.status)}
                    </span>
                    <span class="task-time">${task.actualHours}h / ${task.estimatedHours}h</span>
                </div>
                
                ${task.deadline ? `
                    <div class="task-deadline ${isOverdue ? 'overdue' : ''}">
                        📅 Prazo: ${new Date(task.deadline).toLocaleDateString('pt-BR')}
                        ${isOverdue ? ' (Atrasado!)' : ''}
                    </div>
                ` : ''}
                
                <div class="timer">
                    <div class="timer-display" id="timer-${task.id}">
                        ${this.formatTime(task.actualHours * 3600)}
                    </div>
                    <div class="timer-controls">
                        <button class="btn btn-small ${isTimerRunning ? 'btn-warning' : 'btn-success'}" data-action="toggle-timer" data-task-id="${task.id}">${isTimerRunning ? '⏸️' : '▶️'}</button>
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
        } else {
            // Start timer
            timer.startTime = Date.now();
            timer.isRunning = true;
        }

        this.renderTasks();
    }

    resetTimer(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.timers.delete(taskId);
        task.actualHours = 0;
        this.updateTask(taskId, { actualHours: 0 });
        this.renderTasks();
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

        const totalEstimated = this.tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
        const totalActual = this.tasks.reduce((sum, t) => sum + t.actualHours, 0);
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
        if (this.projects.some(p => p.id === currentValue)) {
            projectFilter.value = currentValue;
        }
    }

    populateProjectSelect() {
        const select = document.getElementById('projectSelect');
        if (!select) return;
        select.innerHTML = '';
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
