/**
 * 文章管理：存储、加载、单词标记
 */
const ArticlesManager = {
    articles: [],
    currentArticleId: null,

    init() {
        this.articles = Storage.get(Storage.keys.ARTICLES, []);
        this.bindEvents();
        this.renderArticles();
        this.updateSelects();
    },

    bindEvents() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        uploadArea?.addEventListener('click', () => fileInput?.click());
        uploadArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea?.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });

        fileInput?.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            e.target.value = '';
        });

        document.getElementById('savePasted')?.addEventListener('click', () => this.savePasted());
        document.getElementById('confirmSaveUpload')?.addEventListener('click', () => this.confirmSaveUpload());

        const dateInput = document.getElementById('articleDate');
        if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

        document.querySelector('[data-close="saveArticleModal"]')?.addEventListener('click', () => this.closeSaveModal());
        document.getElementById('saveArticleModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'saveArticleModal') this.closeSaveModal();
        });
    },

    pendingUpload: null,
    uploadQueue: [],

    handleFiles(files) {
        if (files.length === 0) return;
        const today = new Date().toISOString().slice(0, 10);
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            reader.onload = (e) => {
                const item = {
                    text: e.target.result,
                    defaultName: file.name.replace(/\.[^/.]+$/, '')
                };
                if (!this.pendingUpload) {
                    this.pendingUpload = item;
                    document.getElementById('uploadArticleName').value = item.defaultName;
                    document.getElementById('uploadArticleDate').value = today;
                    const typeEl = document.getElementById('uploadArticleType');
                    if (typeEl) typeEl.value = 'c';
                    document.getElementById('saveArticleModal').classList.add('active');
                } else {
                    this.uploadQueue.push(item);
                }
            };
            reader.readAsText(file, 'UTF-8');
        }
    },

    closeSaveModal() {
        document.getElementById('saveArticleModal').classList.remove('active');
        this.pendingUpload = null;
        this.uploadQueue = [];
    },

    confirmSaveUpload() {
        if (!this.pendingUpload) return;
        const name = document.getElementById('uploadArticleName').value.trim() || this.pendingUpload.defaultName;
        if (!name) {
            alert('请输入文章名称');
            return;
        }
        if (this.isTitleDuplicate(name)) {
            alert('已存在同名文章，请使用其他名称');
            return;
        }
        const date = document.getElementById('uploadArticleDate').value;
        const type = document.getElementById('uploadArticleType')?.value || 'c';
        this.addArticle(name, this.pendingUpload.text, date, type);

        if (this.uploadQueue.length > 0) {
            this.pendingUpload = this.uploadQueue.shift();
            document.getElementById('uploadArticleName').value = this.pendingUpload.defaultName;
            document.getElementById('uploadArticleDate').value = new Date().toISOString().slice(0, 10);
            const typeEl = document.getElementById('uploadArticleType');
            if (typeEl) typeEl.value = 'c';
        } else {
            this.pendingUpload = null;
            this.closeSaveModal();
        }
    },

    savePasted() {
        const textarea = document.getElementById('pasteInput');
        const text = textarea?.value?.trim();
        if (!text) {
            alert('请输入或粘贴文章内容');
            return;
        }
        const nameInput = document.getElementById('articleName');
        const dateInput = document.getElementById('articleDate');
        const typeInput = document.getElementById('articleType');
        const title = (nameInput?.value?.trim()) || text.slice(0, 50) + (text.length > 50 ? '...' : '');
        if (this.isTitleDuplicate(title)) {
            alert('已存在同名文章，请使用其他名称');
            return;
        }
        const date = dateInput?.value || new Date().toISOString().slice(0, 10);
        const type = typeInput?.value || 'c';
        this.addArticle(title, text, date, type);
        textarea.value = '';
        if (nameInput) nameInput.value = '';
    },

    isTitleDuplicate(title, excludeId = null) {
        const normalized = (title || '').trim();
        return this.articles.some(a => a.id !== excludeId && (a.title || '').trim() === normalized);
    },

    addArticle(title, content, dateStr, type = 'c') {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        const savedAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
        const article = {
            id,
            title,
            content: content.trim(),
            type,
            createdAt: savedAt,
            savedAt
        };
        this.articles.push(article);
        Storage.set(Storage.keys.ARTICLES, this.articles);
        this.renderArticles();
        this.updateSelects();
    },

    renameArticle(id, newTitle) {
        const article = this.articles.find(a => a.id === id);
        if (!article || !newTitle.trim()) return;
        if (this.isTitleDuplicate(newTitle, id)) {
            alert('已存在同名文章，请使用其他名称');
            return;
        }
        article.title = newTitle.trim();
        Storage.set(Storage.keys.ARTICLES, this.articles);
        this.renderArticles();
        this.updateSelects();
    },

    changeArticleType(id, newType) {
        const article = this.articles.find(a => a.id === id);
        if (!article) return;
        article.type = newType;
        Storage.set(Storage.keys.ARTICLES, this.articles);
        this.renderArticles();
        this.updateSelects();
        if (this.currentArticleId === id) {
            this.loadArticleForReading(id);
        }
    },

    startChangeType(card, e) {
        const id = card.dataset.id;
        const article = this.getArticle(id);
        if (!article) return;

        const existing = card.querySelector('.type-dropdown');
        if (existing) {
            existing.remove();
            return;
        }

        const types = [
            { v: 'a', l: 'A-对话' },
            { v: 'b', l: 'B-recording' },
            { v: 'c', l: 'C-篇章' }
        ];
        const current = article.type || 'c';

        const dropdown = document.createElement('div');
        dropdown.className = 'type-dropdown';
        dropdown.innerHTML = types.map(t => `
            <button class="type-option ${t.v === current ? 'active' : ''}" data-type="${t.v}">${t.l}</button>
        `).join('');

        const closeDropdown = () => {
            dropdown.remove();
            document.removeEventListener('click', closeDropdown);
        };

        dropdown.querySelectorAll('.type-option').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this.changeArticleType(id, btn.dataset.type);
                closeDropdown();
            });
        });

        card.style.position = 'relative';
        card.appendChild(dropdown);

        document.addEventListener('click', closeDropdown);
        e.stopPropagation();
    },

    startRename(card) {
        const id = card.dataset.id;
        const article = this.getArticle(id);
        if (!article) return;

        const h4 = card.querySelector('h4');
        const oldTitle = article.title;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldTitle;
        input.className = 'article-title-edit';

        const finish = () => {
            const val = input.value.trim();
            card.replaceChild(h4, input);
            if (val && val !== oldTitle) this.renameArticle(id, val);
            input.remove();
        };

        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = oldTitle;
                finish();
            }
        });

        card.replaceChild(input, h4);
        input.focus();
        input.select();
    },

    deleteArticle(id) {
        if (!confirm('确定删除这篇文章？')) return;
        this.articles = this.articles.filter(a => a.id !== id);
        Storage.set(Storage.keys.ARTICLES, this.articles);
        const marks = this.getWordMarks();
        delete marks[id];
        Storage.set(Storage.keys.WORD_MARKS, marks);
        this.renderArticles();
        this.updateSelects();
        if (this.currentArticleId === id) {
            this.currentArticleId = null;
            document.getElementById('articleContent').innerHTML = '';
            document.getElementById('markedWordsList').innerHTML = '';
        }
    },

    getArticle(id) {
        return this.articles.find(a => a.id === id);
    },

    getWordMarks() {
        return Storage.get(Storage.keys.WORD_MARKS, {});
    },

    setWordMark(articleId, word, type) {
        const marks = this.getWordMarks();
        if (!marks[articleId]) marks[articleId] = {};
        const key = word.toLowerCase();
        marks[articleId][key] = type;
        Storage.set(Storage.keys.WORD_MARKS, marks);
        if (type === 'new') {
            const meta = Storage.get(Storage.keys.VOCAB_META, {});
            if (!meta[key]) meta[key] = {};
            meta[key].savedAt = new Date().toISOString().slice(0, 10);
            Storage.set(Storage.keys.VOCAB_META, meta);
        }
    },

    removeWordMark(articleId, word) {
        const marks = this.getWordMarks();
        const key = word.toLowerCase();
        if (marks[articleId]) {
            delete marks[articleId][key];
        }
        Storage.set(Storage.keys.WORD_MARKS, marks);
        const hasWord = Object.values(marks).some(w => w && w[key]);
        if (!hasWord) {
            const meta = Storage.get(Storage.keys.VOCAB_META, {});
            delete meta[key];
            Storage.set(Storage.keys.VOCAB_META, meta);
        }
    },

    getMarksForArticle(articleId) {
        return this.getWordMarks()[articleId] || {};
    },

    renderArticles() {
        const container = document.getElementById('articlesContainer');
        if (!container) return;

        if (this.articles.length === 0) {
            container.innerHTML = '<p class="empty-hint">暂无文章，请上传或粘贴添加</p>';
            return;
        }

        const typeLabels = { a: 'A-对话', b: 'B-recording', c: 'C-篇章' };
        container.innerHTML = this.articles.map(a => `
            <div class="article-card" data-id="${a.id}">
                <h4>${this.escapeHtml(a.title)}</h4>
                <p class="meta"><span class="type-badge type-${a.type || 'c'}">${typeLabels[a.type || 'c']}</span> ${a.content.length} 字符 · 保存于 ${new Date(a.savedAt || a.createdAt).toLocaleDateString('zh-CN')}</p>
                <div class="actions">
                    <button class="btn-play-audio" data-id="${a.id}" title="播放音频">🔊 播放</button>
                    <button class="btn-rename" data-id="${a.id}">重命名</button>
                    <button class="btn-type" data-id="${a.id}" title="点击切换文章类型">类型</button>
                    <button class="btn-read" data-id="${a.id}">阅读</button>
                    <button class="btn-delete" data-id="${a.id}">删除</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.article-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-delete')) {
                    this.deleteArticle(e.target.dataset.id);
                } else if (e.target.classList.contains('btn-play-audio')) {
                    e.stopPropagation();
                    this.playArticleAudio(e.target.dataset.id);
                } else if (e.target.classList.contains('btn-rename')) {
                    e.stopPropagation();
                    this.startRename(card);
                } else if (e.target.classList.contains('btn-type')) {
                    e.stopPropagation();
                    this.startChangeType(card, e);
                } else if (e.target.classList.contains('btn-read')) {
                    this.openArticle(e.target.dataset.id);
                } else {
                    this.openArticle(card.dataset.id);
                }
            });
        });
    },

    openArticle(id) {
        document.querySelector('[data-page="reading"]')?.click();
        setTimeout(() => this.loadArticleForReading(id), 100);
    },

    playArticleAudio(id) {
        const article = this.getArticle(id);
        if (!article) return;
        document.querySelector('[data-page="reading"]')?.click();
        this.loadArticleForReading(id);
        if (AudioPlayer.isSupported()) {
            AudioPlayer.play(article);
        } else {
            alert('当前浏览器不支持语音合成，请使用 Chrome、Edge 或 Safari');
        }
    },

    updateSelects() {
        const opts = this.articles.map(a => `<option value="${a.id}">${this.escapeHtml(a.title)}</option>`);
        const selectHtml = '<option value="">选择文章</option>' + opts.join('');

        ['articleSelect', 'quizArticleSelect', 'taskArticle'].forEach(name => {
            const sel = document.getElementById(name);
            if (sel) {
                const selected = sel.value;
                sel.innerHTML = (name === 'articleSelect' || name === 'quizArticleSelect' 
                    ? '<option value="">选择要阅读的文章</option>' 
                    : '<option value="">无</option>') + opts.join('');
                if (selected) sel.value = selected;
            }
        });
    },

    loadArticleForReading(articleId) {
        const article = this.getArticle(articleId);
        if (!article) return;

        this.currentArticleId = articleId;
        document.getElementById('articleSelect').value = articleId;

        const marks = this.getMarksForArticle(articleId);
        const contentEl = document.getElementById('articleContent');

        if ((article.type || 'c') === 'a') {
            this.renderDialogue(contentEl, article.content, marks);
        } else {
            this.renderNormalContent(contentEl, article.content, marks);
        }

        contentEl.querySelectorAll('.word').forEach(span => {
            span.addEventListener('click', (e) => {
                e.stopPropagation();
                this.cycleWordMark(span);
            });
        });

        contentEl.querySelectorAll('[data-segment-index]').forEach(seg => {
            seg.addEventListener('click', (e) => {
                if (e.target.closest('.word')) return;
                const idx = parseInt(seg.dataset.segmentIndex);
                if (!isNaN(idx)) AudioPlayer.playFromSegment && AudioPlayer.playFromSegment(idx);
            });
        });

        this.renderMarkedWords(articleId);
    },

    parseDialogue(text) {
        const normalizeSpeaker = (tag) => {
            const t = String(tag || '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (/^(w|woman|female|speaker\s*1|q)$/.test(t)) return 'w';
            if (/^(m|man|male|speaker\s*2|a)$/.test(t)) return 'm';
            return null;
        };

        const speakerPattern = /\b(W|M|Woman|Man|Female|Male|Speaker\s*1|Speaker\s*2|Q|A)\s*:\s*/gi;
        const matches = [];
        let m;
        while ((m = speakerPattern.exec(text)) !== null) {
            matches.push({ tag: m[1], index: m.index, end: m.index + m[0].length });
        }

        const turns = [];
        for (let i = 0; i < matches.length; i++) {
            const speaker = normalizeSpeaker(matches[i].tag);
            if (!speaker) continue;
            const textStart = matches[i].end;
            const textEnd = i + 1 < matches.length ? matches[i + 1].index : text.length;
            const content = text.slice(textStart, textEnd).replace(/\r?\n/g, ' ').trim();
            if (content) turns.push({ speaker, text: content });
        }

        if (turns.length === 0) {
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length > 0) {
                let speaker = 'w';
                for (const line of lines) {
                    if (line) {
                        turns.push({ speaker, text: line });
                        speaker = speaker === 'w' ? 'm' : 'w';
                    }
                }
            }
        }

        return turns;
    },

    renderDialogue(contentEl, content, marks) {
        const turns = this.parseDialogue(content);
        const speakerLabels = { w: '女', m: '男' };
        const speakerClasses = { w: 'speaker-w', m: 'speaker-m' };

        if (turns.length === 0) {
            this.renderNormalContent(contentEl, content, marks);
            return;
        }

        contentEl.className = 'article-text article-dialogue';
        contentEl.innerHTML = turns.map((t, i) => {
            const words = this.tokenizeWords(t.text);
            const html = words.map(w => {
                const word = w.toLowerCase();
                const markType = marks[word] || '';
                return `<span class="word ${markType ? 'mark-' + markType : ''}" data-word="${this.escapeHtml(w)}" data-type="${markType}">${this.escapeHtml(w)}</span>`;
            }).join(' ') || this.escapeHtml(t.text);
            return `<div class="dialogue-turn ${speakerClasses[t.speaker]}" data-segment-index="${i}" data-speaker="${t.speaker}">
                <span class="speaker-label">${speakerLabels[t.speaker]}</span>
                <div class="dialogue-text">${html}</div>
            </div>`;
        }).join('');
    },

    renderNormalContent(contentEl, content, marks) {
        contentEl.className = 'article-text';
        const sentences = content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
        const segments = sentences.length > 1 ? sentences : (content.trim() ? [content.trim()] : []);

        if (segments.length === 0) {
            contentEl.innerHTML = '';
            return;
        }

        contentEl.innerHTML = segments.map((sent, i) => {
            const words = this.tokenizeWords(sent);
            const html = words.map(w => {
                const word = w.toLowerCase();
                const markType = marks[word] || '';
                return `<span class="word ${markType ? 'mark-' + markType : ''}" data-word="${this.escapeHtml(w)}" data-type="${markType}">${this.escapeHtml(w)}</span>`;
            }).join(' ') || this.escapeHtml(sent);
            return `<span class="content-segment" data-segment-index="${i}">${html}</span>`;
        }).join(' ');
    },

    tokenizeWords(text) {
        return text.match(/[\w'-]+|[^\w\s]/g) || [];
    },

    cycleWordMark(span) {
        const word = span.dataset.word;
        const types = ['', 'new', 'unclear', 'repeat'];
        let idx = types.indexOf(span.dataset.type || '');
        idx = (idx + 1) % types.length;
        const newType = types[idx];

        if (newType) {
            this.setWordMark(this.currentArticleId, word, newType);
        } else {
            this.removeWordMark(this.currentArticleId, word);
        }

        const wordLower = (word || '').toLowerCase();
        const contentEl = document.getElementById('articleContent');
        contentEl?.querySelectorAll('.word').forEach(s => {
            if ((s.dataset.word || '').toLowerCase() === wordLower) {
                s.dataset.type = newType;
                s.className = 'word' + (newType ? ' mark-' + newType : '');
            }
        });

        this.renderMarkedWords(this.currentArticleId);
    },

    renderMarkedWords(articleId) {
        const container = document.getElementById('markedWordsList');
        const marks = this.getMarksForArticle(articleId);
        const entries = Object.entries(marks);
        const meta = Storage.get(Storage.keys.VOCAB_META, {});

        if (entries.length === 0) {
            container.innerHTML = '<p class="empty-hint">点击文中单词可标记</p>';
            return;
        }

        const labels = { new: '新单词', unclear: '听不出来', repeat: '需要重复' };
        container.innerHTML = entries.map(([word, type]) => {
            const key = word.toLowerCase();
            const m = meta[key] || {};
            const translation = m.translation;
            const isNew = type === 'new';
            const hasTranslation = !!translation;
            let transHtml = '';
            if (isNew && hasTranslation) {
                transHtml = `<span class="marked-word-trans">${this.escapeHtml(translation)}</span>`;
            } else if (isNew && typeof WordAPI !== 'undefined') {
                transHtml = `<button class="btn-load-def" data-word="${this.escapeHtml(word)}">加载释义</button>`;
            }
            return `
            <div class="marked-word-item">
                <div class="marked-word-main">
                    <strong>${this.escapeHtml(word)}</strong>
                    <span class="type-badge ${type}">${labels[type]}</span>
                </div>
                ${transHtml ? `<div class="marked-word-extra">${transHtml}</div>` : ''}
            </div>`;
        }).join('');

        container.querySelectorAll('.btn-load-def').forEach(btn => {
            btn.addEventListener('click', (e) => this.loadDefinitionForMarkedWord(e.target.dataset.word));
        });
    },

    async loadDefinitionForMarkedWord(word) {
        if (!word || typeof WordAPI === 'undefined') return;
        const btn = document.querySelector(`.btn-load-def[data-word="${word.replace(/"/g, '\\"')}"]`);
        if (btn) btn.textContent = '加载中...';
        await WordAPI.fetchWordDetails(word);
        this.renderMarkedWords(this.currentArticleId);
    },

    clearAllMarks() {
        if (!this.currentArticleId) return;
        if (!confirm('清除本文所有单词标记？')) return;
        const marks = this.getWordMarks();
        marks[this.currentArticleId] = {};
        Storage.set(Storage.keys.WORD_MARKS, marks);
        this.loadArticleForReading(this.currentArticleId);
    },

    escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }
};
