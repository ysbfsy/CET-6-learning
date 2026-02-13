/**
 * AI 智能生成学习计划
 * 支持 OpenAI API 及兼容接口（如 OpenRouter、国内中转等）
 */
const AIPlanManager = {
    defaultBaseUrl: 'https://api.openai.com/v1',

    init() {
        this.loadConfig();
        this.bindEvents();
    },

    loadConfig() {
        const key = Storage.get(Storage.keys.AI_API_KEY, '');
        const url = Storage.get(Storage.keys.AI_BASE_URL, '');
        document.getElementById('aiApiKey').value = key;
        document.getElementById('aiBaseUrl').value = url;
    },

    bindEvents() {
        document.getElementById('aiPlanBtn')?.addEventListener('click', () => this.openModal());
        document.querySelector('[data-close="aiPlanModal"]')?.addEventListener('click', () => this.closeModal());
        document.getElementById('aiPlanModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'aiPlanModal') this.closeModal();
        });
        document.getElementById('saveAiConfig')?.addEventListener('click', () => this.saveConfig());
        document.getElementById('generateAiPlan')?.addEventListener('click', () => this.generatePlan());
    },

    openModal() {
        this.loadConfig();
        document.getElementById('aiPlanResult').style.display = 'none';
        document.getElementById('aiPlanModal').classList.add('active');
    },

    closeModal() {
        document.getElementById('aiPlanModal').classList.remove('active');
    },

    saveConfig() {
        const key = document.getElementById('aiApiKey').value.trim();
        const url = document.getElementById('aiBaseUrl').value.trim();
        if (key) Storage.set(Storage.keys.AI_API_KEY, key);
        if (url) Storage.set(Storage.keys.AI_BASE_URL, url);
        else Storage.remove(Storage.keys.AI_BASE_URL);
        alert('配置已保存');
    },

    async generatePlan() {
        const apiKey = document.getElementById('aiApiKey').value.trim() || Storage.get(Storage.keys.AI_API_KEY, '');
        if (!apiKey) {
            alert('请先输入并保存 API Key');
            return;
        }

        const btn = document.getElementById('generateAiPlan');
        btn.disabled = true;
        btn.querySelector('.btn-text').style.display = 'none';
        btn.querySelector('.btn-loading').style.display = 'inline';

        const resultEl = document.getElementById('aiPlanResult');
        resultEl.style.display = 'block';
        resultEl.innerHTML = '<p class="loading">正在生成计划...</p>';
        resultEl.className = 'ai-result';

        try {
            const tasks = await this.callAI(apiKey);
            if (tasks && tasks.length > 0) {
                this.applyTasks(tasks);
                resultEl.innerHTML = `<p class="success">✓ 已生成 ${tasks.length} 条学习任务并添加到计划中！</p>`;
                resultEl.className = 'ai-result success';
                PlanManager.render();
                setTimeout(() => this.closeModal(), 1500);
            } else {
                resultEl.innerHTML = '<p class="error">未能解析出有效任务，请重试或检查 API。</p>';
                resultEl.className = 'ai-result error';
            }
        } catch (err) {
            resultEl.innerHTML = `<p class="error">生成失败：${err.message}</p>`;
            resultEl.className = 'ai-result error';
        } finally {
            btn.disabled = false;
            btn.querySelector('.btn-text').style.display = 'inline';
            btn.querySelector('.btn-loading').style.display = 'none';
        }
    },

    buildContext() {
        const articles = Storage.get(Storage.keys.ARTICLES, []);
        const marks = Storage.get(Storage.keys.WORD_MARKS, {});
        const tasks = Storage.get(Storage.keys.TASKS, []);

        const articleList = articles.map(a => ({
            id: a.id,
            title: a.title,
            preview: a.content.slice(0, 200)
        }));

        const markedByArticle = {};
        for (const [aid, words] of Object.entries(marks)) {
            const article = articles.find(a => a.id === aid);
            markedByArticle[article?.title || aid] = words;
        }

        const extra = document.getElementById('aiPlanExtra')?.value?.trim() || '';

        return {
            articles: articleList,
            markedWords: markedByArticle,
            currentTasks: tasks.slice(-5).map(t => t.content),
            extra
        };
    },

    async callAI(apiKey) {
        const ctx = this.buildContext();
        const baseUrl = document.getElementById('aiBaseUrl').value.trim() || 
                        Storage.get(Storage.keys.AI_BASE_URL, '') || 
                        this.defaultBaseUrl;

        const prompt = `You are an English listening study planner. Based on the user's data, generate a 7-day study plan.

User's articles: ${JSON.stringify(ctx.articles)}
Marked words by article: ${JSON.stringify(ctx.markedWords)}
Recent tasks: ${JSON.stringify(ctx.currentTasks)}
Extra notes: ${ctx.extra || 'None'}

Generate 7-14 specific, actionable tasks. Spread them across the next 7 days. Each task should be in Chinese, concise (under 30 chars).
Consider: new vocabulary review, listening practice, article reading, quiz practice, marked word repetition.

Return ONLY a valid JSON array, no other text:
[{"content":"任务内容","date":"YYYY-MM-DD","articleId":"id or null"},...]

Example: [{"content":"复习文章A中新单词","date":"2025-02-12","articleId":"abc123"},{"content":"完成文章B听力测验","date":"2025-02-12","articleId":"def456"}]
date must be in YYYY-MM-DD format. Use dates from today onwards.`;

        const today = new Date().toISOString().slice(0, 10);

        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You output only valid JSON arrays.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim() || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;

        let tasks = JSON.parse(jsonStr);
        if (!Array.isArray(tasks)) tasks = [];

        const validTasks = tasks.filter(t => t && t.content && t.date).map(t => ({
            content: String(t.content).slice(0, 50),
            date: this.normalizeDate(t.date),
            articleId: t.articleId || null
        }));

        return validTasks;
    },

    normalizeDate(str) {
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
    },

    applyTasks(tasks) {
        const articles = Storage.get(Storage.keys.ARTICLES, []);
        const validIds = new Set(articles.map(a => a.id));
        const existing = PlanManager.tasks;

        tasks.forEach(t => {
            const articleId = t.articleId && validIds.has(t.articleId) ? t.articleId : null;
            existing.push({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                content: t.content,
                articleId,
                date: t.date,
                completed: false,
                createdAt: new Date().toISOString()
            });
        });
        Storage.set(Storage.keys.TASKS, existing);
    }
};
