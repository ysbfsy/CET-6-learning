/**
 * 学习计划与进度追踪
 */
const PlanManager = {
    tasks: [],
    studyHistory: {},

    init() {
        this.tasks = Storage.get(Storage.keys.TASKS, []);
        this.studyHistory = Storage.get(Storage.keys.STUDY_HISTORY, {});
        this.bindEvents();
        this.render();
    },

    bindEvents() {
        document.getElementById('addTaskBtn')?.addEventListener('click', () => this.openTaskModal());
        document.querySelector('#taskModal .modal-close')?.addEventListener('click', () => this.closeTaskModal());
        document.getElementById('taskForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        document.getElementById('taskModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') this.closeTaskModal();
        });

        document.querySelectorAll('.trend-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.trend-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderStudyTrendChart(parseInt(tab.dataset.days) || 7);
            });
        });
    },

    openTaskModal() {
        document.getElementById('taskModal').classList.add('active');
        document.getElementById('taskDate').value = new Date().toISOString().slice(0, 10);
    },

    closeTaskModal() {
        document.getElementById('taskModal').classList.remove('active');
    },

    addTask() {
        const content = document.getElementById('taskContent').value.trim();
        const articleId = document.getElementById('taskArticle').value || null;
        const date = document.getElementById('taskDate').value;

        if (!content || !date) {
            alert('请填写任务内容和日期');
            return;
        }

        const task = {
            id: Date.now().toString(),
            content,
            articleId,
            date,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.push(task);
        Storage.set(Storage.keys.TASKS, this.tasks);
        this.closeTaskModal();
        document.getElementById('taskForm').reset();
        this.render();
    },

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        task.completed = !task.completed;
        if (task.completed) {
            this.recordStudyActivity(task.date);
        }
        Storage.set(Storage.keys.TASKS, this.tasks);
        this.render();
    },

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        Storage.set(Storage.keys.TASKS, this.tasks);
        this.render();
    },

    recordStudyActivity(dateStr) {
        this.studyHistory[dateStr] = (this.studyHistory[dateStr] || 0) + 1;
        Storage.set(Storage.keys.STUDY_HISTORY, this.studyHistory);
    },

    getStreakDays() {
        const today = new Date().toISOString().slice(0, 10);
        let count = 0;
        let d = new Date(today);

        for (let i = 0; i < 365; i++) {
            const key = d.toISOString().slice(0, 10);
            if (this.studyHistory[key] > 0) {
                count++;
            } else {
                if (key === today) break;
                return count;
            }
            d.setDate(d.getDate() - 1);
        }
        return count;
    },

    getTasksForDate(dateStr) {
        return this.tasks.filter(t => t.date === dateStr);
    },

    getTodayTasks() {
        const today = new Date().toISOString().slice(0, 10);
        return this.getTasksForDate(today);
    },

    render() {
        const completed = this.tasks.filter(t => t.completed).length;
        document.getElementById('completedTasks').textContent = completed;
        document.getElementById('totalTasks').textContent = this.tasks.length;
        document.getElementById('streakDays').textContent = this.getStreakDays();

        const today = new Date().toISOString().slice(0, 10);
        this.renderTaskList('todayTasks', this.getTodayTasks());
        this.renderTaskList('allTasks', [...this.tasks].sort((a, b) => new Date(b.date) - new Date(a.date)));

        this.renderStudyCalendar();
        const activeTab = document.querySelector('.trend-tab.active');
        this.renderStudyTrendChart(activeTab ? parseInt(activeTab.dataset.days) || 7 : 7);
    },

    renderStudyTrendChart(days = 7) {
        const container = document.getElementById('studyTrendChart');
        if (!container) return;

        const data = [];
        const d = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(d);
            date.setDate(date.getDate() - i);
            const key = date.toISOString().slice(0, 10);
            const count = this.studyHistory[key] || 0;
            data.push({
                date: key,
                label: `${date.getMonth() + 1}/${date.getDate()}`,
                count
            });
        }

        const maxCount = Math.max(1, ...data.map(x => x.count));
        const hasData = data.some(x => x.count > 0);

        container.innerHTML = hasData ? `
            <div class="trend-chart-wrap">
                <div class="trend-bars">
                    ${data.map(item => `
                        <div class="trend-bar-item" title="${item.date}: ${item.count} 次">
                            <div class="trend-bar-col" style="height: 120px">
                                <div class="trend-bar-fill" style="height: ${maxCount ? (item.count / maxCount) * 100 : 0}%"></div>
                            </div>
                            <span class="trend-bar-label">${item.label}</span>
                            ${item.count > 0 ? `<span class="trend-bar-value">${item.count}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '<p class="empty-hint">暂无学习记录，完成任务或练习后即可在此查看趋势</p>';
    },

    renderTaskList(containerId, tasks) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (tasks.length === 0) {
            container.innerHTML = '<p class="empty-hint">暂无任务</p>';
            return;
        }

        container.innerHTML = tasks.map(t => `
            <div class="task-item ${t.completed ? 'completed' : ''}">
                <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''} data-id="${t.id}">
                <span class="task-content">${this.escapeHtml(t.content)}</span>
                <span class="task-date">${t.date}</span>
                <button class="task-delete" data-id="${t.id}">删除</button>
            </div>
        `).join('');

        container.querySelectorAll('.task-checkbox').forEach(cb => {
            cb.addEventListener('change', () => this.toggleTask(cb.dataset.id));
        });
        container.querySelectorAll('.task-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTask(btn.dataset.id);
            });
        });
    },

    renderStudyCalendar() {
        const container = document.getElementById('studyHistory');
        const days = [];
        const d = new Date();

        for (let i = 0; i < 28; i++) {
            const key = d.toISOString().slice(0, 10);
            days.push({
                date: key,
                day: d.getDate(),
                hasActivity: (this.studyHistory[key] || 0) > 0,
                count: this.studyHistory[key] || 0
            });
            d.setDate(d.getDate() - 1);
        }

        container.innerHTML = days.map(d => `
            <div class="calendar-day ${d.hasActivity ? 'has-activity' : ''}" title="${d.date}: ${d.count} 次学习">
                <div>${d.day}日</div>
                ${d.hasActivity ? `<small>${d.count}✓</small>` : ''}
            </div>
        `).join('');
    },

    escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }
};
