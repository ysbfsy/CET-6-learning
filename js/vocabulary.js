/**
 * 我的生词 - 从所有文章中收集标记为「新单词」的词汇
 */
const VocabularyManager = {
    init() {
        this.bindEvents();
        this.render();
    },

    bindEvents() {
        document.getElementById('vocabSearch')?.addEventListener('input', () => this.render());
    },

    async fetchAndShowDetails(word, rowEl) {
        const detailEl = rowEl.querySelector('.vocab-detail');
        if (detailEl.dataset.loading === 'true') return;
        if (detailEl.dataset.loaded === 'true') {
            detailEl.classList.toggle('expanded');
            return;
        }
        detailEl.dataset.loading = 'true';
        detailEl.innerHTML = '<p class="loading">加载中...</p>';
        detailEl.classList.add('expanded');
        const data = await WordAPI.fetchWordDetails(word);
        detailEl.dataset.loading = 'false';
        detailEl.dataset.loaded = 'true';
        if (data?.error) {
            detailEl.innerHTML = `
                <div class="vocab-dict-card">
                    <div class="vocab-dict-pron">
                        <button class="dict-play-btn" data-word="${this.escapeHtml(word)}" data-lang="en-US" title="美音">▶</button>
                        <span class="empty-hint">暂无释义，请检查网络</span>
                    </div>
                </div>`;
            detailEl.querySelector('.dict-play-btn')?.addEventListener('click', () => this.pronounceWord(word));
            return;
        }
        const posAbbr = this.abbreviatePOS(data.partOfSpeech);
        const phoneticUk = data.phoneticUk || data.phonetic || '';
        const phoneticUs = data.phoneticUs || data.phonetic || '';
        const transParts = data.translation ? data.translation.split(/[；;]/).map(t => t.trim()).filter(Boolean) : [];
        const transItems = transParts.length ? transParts : (data.translation ? [data.translation.trim()] : []);

        const html = `
            <div class="vocab-dict-card">
                <h4 class="vocab-dict-word">${this.escapeHtml(data.word)}</h4>
                <div class="vocab-dict-pron">
                    ${(phoneticUk || phoneticUs) ? `
                    <div class="pron-row">
                        <span class="pron-label">英</span>
                        <span class="pron-ipa">${this.escapeHtml(phoneticUk)}</span>
                        <button class="dict-play-btn" data-word="${this.escapeHtml(data.word)}" data-lang="en-GB" title="英音">▶</button>
                    </div>
                    <div class="pron-row">
                        <span class="pron-label">美</span>
                        <span class="pron-ipa">${this.escapeHtml(phoneticUs)}</span>
                        <button class="dict-play-btn" data-word="${this.escapeHtml(data.word)}" data-lang="en-US" title="美音">▶</button>
                    </div>
                    ` : `<button class="dict-play-btn" data-word="${this.escapeHtml(data.word)}" data-lang="en-US" title="发音">▶ 发音</button>`}
                </div>
                <div class="dict-tabs">
                    <button class="dict-tab active" data-tab="concise">简明</button>
                    <button class="dict-tab" data-tab="oxford">牛津</button>
                    <button class="dict-tab" data-tab="newoxford">新牛津</button>
                    <button class="dict-tab" data-tab="webster">韦氏</button>
                    <button class="dict-tab" data-tab="collins">柯林斯</button>
                </div>
                <div class="dict-tab-content active" data-tab="concise">
                    <div class="vocab-dict-pos-trans">
                        ${posAbbr ? `<span class="pos-abbr">${posAbbr}</span> ` : ''}
                        ${transItems.length ? transItems.map(t => `<strong class="trans-meaning">${this.escapeHtml(t)}</strong>`).join('；') : ''}
                    </div>
                    ${data.meanings?.length ? `
                    <div class="vocab-dict-section">
                        <h5>英文释义</h5>
                        <ul class="dict-defs">
                            ${data.meanings.flatMap(m => (m.definitions || []).slice(0, 3).map(d =>
                                `<li>${this.escapeHtml(d.definition || '')}${d.example ? ` <em class="dict-ex">例：${this.escapeHtml(d.example)}</em>` : ''}</li>`
                            ).filter(Boolean)).slice(0, 6).join('')}
                        </ul>
                    </div>` : ''}
                    ${data.phrases?.length ? `<div class="vocab-dict-section"><h5>词组/近义词</h5><p class="dict-phrases">${data.phrases.map(p => this.escapeHtml(p)).join('、')}</p></div>` : ''}
                    ${data.examples?.length ? `<div class="vocab-dict-section"><h5>例句</h5><ul class="dict-examples">${data.examples.slice(0, 3).map(e => `<li>${this.escapeHtml(e)}</li>`).join('')}</ul></div>` : ''}
                </div>
                <div class="dict-tab-content" data-tab="oxford"><p class="empty-hint">敬请期待</p></div>
                <div class="dict-tab-content" data-tab="newoxford"><p class="empty-hint">敬请期待</p></div>
                <div class="dict-tab-content" data-tab="webster"><p class="empty-hint">敬请期待</p></div>
                <div class="dict-tab-content" data-tab="collins"><p class="empty-hint">敬请期待</p></div>
            </div>`;
        detailEl.innerHTML = html.trim() || '<p class="empty-hint">未找到释义</p>';
        detailEl.querySelectorAll('.dict-play-btn').forEach(btn => {
            btn.addEventListener('click', () => this.pronounceWord(btn.dataset.word, btn.dataset.lang || 'en-US'));
        });
        detailEl.querySelectorAll('.dict-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                detailEl.querySelectorAll('.dict-tab').forEach(t => t.classList.remove('active'));
                detailEl.querySelectorAll('.dict-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                detailEl.querySelector(`.dict-tab-content[data-tab="${tabId}"]`)?.classList.add('active');
            });
        });
    },

    getNewWords() {
        const marks = Storage.get(Storage.keys.WORD_MARKS, {});
        const articles = Storage.get(Storage.keys.ARTICLES, []);
        const meta = Storage.get(Storage.keys.VOCAB_META, {});
        const wordMap = {};

        let metaChanged = false;
        for (const [articleId, words] of Object.entries(marks)) {
            const article = articles.find(a => a.id === articleId);
            const articleTitle = article?.title || '未知文章';

            for (const [word, type] of Object.entries(words)) {
                if (type === 'new') {
                    if (!wordMap[word]) {
                        let savedAt = meta[word]?.savedAt;
                        if (!savedAt) {
                            savedAt = new Date().toISOString().slice(0, 10);
                            meta[word] = meta[word] || {};
                            meta[word].savedAt = savedAt;
                            metaChanged = true;
                        }
                        wordMap[word] = { word, articles: [], savedAt };
                    }
                    if (!wordMap[word].articles.includes(articleTitle)) {
                        wordMap[word].articles.push(articleTitle);
                    }
                }
            }
        }
        if (metaChanged) Storage.set(Storage.keys.VOCAB_META, meta);

        return Object.values(wordMap).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || '') || a.word.localeCompare(b.word));
    },

    pronounceWord(word, lang) {
        if (!window.speechSynthesis) {
            alert('当前浏览器不支持语音');
            return;
        }
        const accent = lang || (typeof AudioPlayer !== 'undefined' ? AudioPlayer.getAccent() : 'en-US');
        const u = new SpeechSynthesisUtterance(word);
        u.lang = accent;
        u.rate = 0.9;
        const voices = speechSynthesis.getVoices().filter(v =>
            accent === 'en-GB' ? /en-gb/i.test(v.lang) : /en-us/i.test(v.lang)
        );
        const voice = voices[0];
        if (voice) u.voice = voice;
        speechSynthesis.speak(u);
    },

    removeWord(word) {
        const marks = Storage.get(Storage.keys.WORD_MARKS, {});
        const key = word.toLowerCase();
        for (const articleId of Object.keys(marks)) {
            if (marks[articleId][key] === 'new') {
                delete marks[articleId][key];
            }
        }
        Storage.set(Storage.keys.WORD_MARKS, marks);
        const meta = Storage.get(Storage.keys.VOCAB_META, {});
        delete meta[key];
        Storage.set(Storage.keys.VOCAB_META, meta);
        this.render();
        if (ArticlesManager.currentArticleId) {
            ArticlesManager.renderMarkedWords(ArticlesManager.currentArticleId);
        }
    },

    render() {
        const searchTerm = (document.getElementById('vocabSearch')?.value || '').trim().toLowerCase();
        let words = this.getNewWords();

        if (searchTerm) {
            words = words.filter(w => w.word.toLowerCase().includes(searchTerm));
        }

        document.getElementById('vocabTotal').textContent = words.length;

        const container = document.getElementById('vocabularyList');
        if (!container) return;

        if (words.length === 0) {
            container.innerHTML = '<p class="empty-hint">暂无生词。在阅读文章中点击单词标记为「新单词」即可添加到此</p>';
            return;
        }

        const meta = Storage.get(Storage.keys.VOCAB_META, {});
        container.innerHTML = words.map(item => {
            const m = meta[item.word.toLowerCase()] || {};
            const trans = m.translation ? (m.translation.split(/[；;]/)[0] || m.translation).trim().slice(0, 30) : '';
            return `
            <div class="vocab-item">
                <div class="vocab-main">
                    <button class="vocab-play-mini" data-word="${this.escapeHtml(item.word)}" title="发音">▶</button>
                    <span class="vocab-word">${this.escapeHtml(item.word)}</span>
                    ${m.phonetic ? `<span class="vocab-phonetic-preview">${this.escapeHtml(m.phonetic)}</span>` : ''}
                    ${trans ? `<span class="vocab-trans-preview">${this.escapeHtml(trans)}${trans.length >= 30 ? '…' : ''}</span>` : ''}
                    <span class="vocab-date">${item.savedAt ? new Date(item.savedAt).toLocaleDateString('zh-CN') : '—'}</span>
                    <span class="vocab-source">${item.articles.map(a => this.escapeHtml(a)).join('、')}</span>
                    <button class="btn btn-small vocab-detail-btn" data-word="${this.escapeHtml(item.word)}">查看释义</button>
                    <button class="btn btn-small vocab-remove" data-word="${this.escapeHtml(item.word)}">移除</button>
                </div>
                <div class="vocab-detail" data-word="${this.escapeHtml(item.word)}"></div>
            </div>
        `}).join('');

        container.querySelectorAll('.vocab-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`确定从生词本移除「${btn.dataset.word}」？`)) {
                    this.removeWord(btn.dataset.word);
                }
            });
        });

        container.querySelectorAll('.vocab-detail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const row = btn.closest('.vocab-item');
                this.fetchAndShowDetails(btn.dataset.word, row);
            });
        });

        container.querySelectorAll('.vocab-play-mini').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.pronounceWord(btn.dataset.word);
            });
        });

        container.querySelectorAll('.vocab-word').forEach(span => {
            span.addEventListener('click', () => {
                const articleTitle = span.closest('.vocab-item')?.querySelector('.vocab-source')?.textContent?.split('、')[0];
                const article = ArticlesManager.articles.find(a => a.title === articleTitle);
                if (article) {
                    ArticlesManager.openArticle(article.id);
                }
            });
        });
    },

    abbreviatePOS(pos) {
        if (!pos || !pos.trim()) return '';
        const map = {
            noun: 'n.', verb: 'v.', adjective: 'adj.', adverb: 'adv.',
            pronoun: 'pron.', preposition: 'prep.', conjunction: 'conj.',
            interjection: 'interj.', determiner: 'det.', exclamation: 'excl.'
        };
        return pos.split(/[、\s,]+/).map(p => {
            const key = (p || '').toLowerCase().trim();
            return map[key] || (key ? key + '.' : '');
        }).filter(Boolean).join('、');
    },

    escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }
};
