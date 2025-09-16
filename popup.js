// Task Time Manager - Popup JavaScript
class TaskManager {
    constructor() {
        this.tasks = [];
        this.currentEditingTask = null;
        this.timers = new Map(); // Para armazenar timers ativos
        this.init();
    }

    async init() {
        await this.loadTasks();
        this.setupEventListeners();
        this.renderTasks();
        this.updateStats();
        this.updateCategoryFilter();
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

        // Filters
        document.getElementById('statusFilter').addEventListener('change', () => this.renderTasks());
        document.getElementById('categoryFilter').addEventListener('change', () => this.renderTasks());

        // Close modal when clicking outside
        document.getElementById('taskModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') {
                this.closeTaskModal();
            }
        });

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

    async saveTasks() {
        try {
            await chrome.storage.local.set({ tasks: this.tasks });
        } catch (error) {
            console.error('Erro ao salvar tarefas:', error);
        }
    }

    // Task CRUD Operations
    createTask(taskData) {
        const task = {
            id: Date.now().toString(),
            title: taskData.title,
            description: taskData.description || '',
            category: taskData.category || '',
            estimatedHours: parseFloat(taskData.estimatedHours) || 0,
            actualHours: parseFloat(taskData.actualHours) || 0,
            deadline: taskData.deadline || null,
            status: taskData.status || 'Not Started',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.tasks.push(task);
        this.saveTasks();
        this.updateCategoryFilter();
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
        this.updateCategoryFilter();
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
    }

    openTaskModal(task = null) {
        this.currentEditingTask = task;
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        
        if (task) {
            document.getElementById('modalTitle').textContent = 'Editar Tarefa';
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description;
            document.getElementById('taskCategory').value = task.category;
            document.getElementById('estimatedHours').value = task.estimatedHours;
            document.getElementById('taskDeadline').value = task.deadline || '';
            document.getElementById('taskStatus').value = task.status;
        } else {
            document.getElementById('modalTitle').textContent = 'Nova Tarefa';
            form.reset();
            document.getElementById('estimatedHours').value = 1;
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
            category: document.getElementById('taskCategory').value.trim(),
            estimatedHours: document.getElementById('estimatedHours').value,
            deadline: document.getElementById('taskDeadline').value,
            status: document.getElementById('taskStatus').value
        };

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
        const categoryFilter = document.getElementById('categoryFilter').value;

        let filteredTasks = this.tasks;

        if (statusFilter) {
            filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
        }

        if (categoryFilter) {
            filteredTasks = filteredTasks.filter(task => task.category === categoryFilter);
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
                        ${task.category ? `<span class="task-category">${this.escapeHtml(task.category)}</span>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="btn btn-small btn-success" onclick="taskManager.openTaskModal(${JSON.stringify(task).replace(/"/g, '&quot;')})">
                            ✏️
                        </button>
                        <button class="btn btn-small btn-secondary" onclick="taskManager.deleteTask('${task.id}')">
                            🗑️
                        </button>
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
                        <button class="btn btn-small ${isTimerRunning ? 'btn-warning' : 'btn-success'}" 
                                onclick="taskManager.toggleTimer('${task.id}')">
                            ${isTimerRunning ? '⏸️' : '▶️'}
                        </button>
                        <button class="btn btn-small btn-secondary" 
                                onclick="taskManager.resetTimer('${task.id}')">
                            🔄
                        </button>
                    </div>
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
            }
        });
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

    updateCategoryFilter() {
        const categories = [...new Set(this.tasks.map(t => t.category).filter(c => c))];
        const categoryFilter = document.getElementById('categoryFilter');
        
        // Keep current selection
        const currentValue = categoryFilter.value;
        
        // Clear and rebuild options
        categoryFilter.innerHTML = '<option value="">Todas as Categorias</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
        
        // Restore selection if still valid
        if (categories.includes(currentValue)) {
            categoryFilter.value = currentValue;
        }
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
