/**
 * 学习练习模块 - 4 种题型
 * 1. 听音记单词 2. 六级真题 3. 逐句跟读 4. 句子倾听默写
 */
const PracticeManager = {
    currentType: null,
    currentIndex: 0,
    words: [],
    questions: [],
    sentences: [],
    article: null,
    recognition: null,

    TYPES: {
        listen_word: { id: 'listen_word', name: '听音记单词', icon: '🎧', desc: '播放单词发音，输入英文拼写' },
        cet6_quiz: { id: 'cet6_quiz', name: '六级真题题型', icon: '✍️', desc: '选词填空、六级听力题' },
        shadow: { id: 'shadow', name: '逐句跟读训练', icon: '🗣️', desc: '跟读句子，系统打分，80分以上过关' },
        dictation: { id: 'dictation', name: '句子倾听默写', icon: '📝', desc: '听句子，默写，词间留空' }
    },

    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('practiceTypeSelect')?.addEventListener('click', (e) => {
            const card = e.target.closest('.practice-type-card');
            if (card?.dataset?.type) this.startPractice(card.dataset.type);
        });
        document.getElementById('practiceBack')?.addEventListener('click', () => this.showTypeSelect());
    },

    stopPractice() {
        window.speechSynthesis?.cancel();
        if (typeof AudioPlayer !== 'undefined') AudioPlayer.stop();
    },

    showTypeSelect() {
        const practiceEl = document.getElementById('practiceArea');
        const planPage = document.getElementById('page-plan');
        if (practiceEl) practiceEl.classList.remove('active');
        if (planPage) planPage.classList.remove('in-practice');
        this.currentType = null;
        this.stopPractice();
        PlanManager.render();
    },

    startPractice(typeId) {
        this.currentType = typeId;
        const practiceEl = document.getElementById('practiceArea');
        const planPage = document.getElementById('page-plan');
        if (practiceEl) practiceEl.classList.add('active');
        if (planPage) planPage.classList.add('in-practice');

        if (typeId === 'listen_word') this.runListenWord();
        else if (typeId === 'cet6_quiz') this.runCet6Quiz();
        else if (typeId === 'shadow') this.runShadow();
        else if (typeId === 'dictation') this.runDictation();
    },

    // ========== 题型1：听音记单词 ==========
    async runListenWord() {
        this.words = VocabularyManager.getNewWords().map(w => w.word);
        if (this.words.length === 0) {
            this.renderPracticeUI('听音记单词', '<p class="empty-hint">暂无生词，请先在阅读中标记新单词</p><button class="btn btn-primary" id="dictationBack1">返回</button>');
            document.getElementById('dictationBack1')?.addEventListener('click', () => this.showTypeSelect());
            return;
        }
        this.words = this.shuffle([...this.words]);
        this.currentIndex = 0;
        this.renderListenWord();
    },

    renderListenWord() {
        const w = this.words[this.currentIndex];
        const total = this.words.length;
        const html = `
            <div class="practice-header">
                <h3>听音记单词</h3>
                <span class="practice-progress">${this.currentIndex + 1} / ${total}</span>
            </div>
            <div class="listen-word-area">
                <button class="btn btn-primary btn-large" id="listenWordPlay">🔊 播放发音</button>
                <div class="form-group">
                    <label>输入英文拼写：</label>
                    <input type="text" id="listenWordInput" placeholder="输入单词..." autocomplete="off" spellcheck="false">
                </div>
                <button class="btn btn-primary" id="listenWordSubmit">提交</button>
                <p id="listenWordFeedback" class="feedback"></p>
            </div>
        `;
        this.renderPracticeUI('听音记单词', html);

        document.getElementById('listenWordPlay')?.addEventListener('click', () => {
            if (w) VocabularyManager.pronounceWord(w);
        });
        document.getElementById('listenWordInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('listenWordSubmit')?.click();
        });
        document.getElementById('listenWordSubmit')?.addEventListener('click', () => this.checkListenWord(w));
        document.getElementById('listenWordInput')?.focus();
    },

    checkListenWord(correctWord) {
        const input = document.getElementById('listenWordInput')?.value.trim().toLowerCase();
        const fb = document.getElementById('listenWordFeedback');
        if (!input) {
            fb.textContent = '请输入单词';
            fb.className = 'feedback wrong';
            return;
        }
        const correct = correctWord.toLowerCase() === input.toLowerCase();
        if (correct) {
            fb.textContent = '✓ 正确！';
            fb.className = 'feedback correct';
            this.currentIndex++;
            if (this.currentIndex >= this.words.length) {
                this.showPracticeComplete('听音记单词', `完成！共 ${this.words.length} 个单词`);
                return;
            }
            setTimeout(() => this.renderListenWord(), 600);
        } else {
            fb.textContent = `错误，正确答案：${correctWord}`;
            fb.className = 'feedback wrong';
        }
    },

    // ========== 题型2：六级真题 ==========
    runCet6Quiz() {
        const articles = ArticlesManager.articles;
        if (articles.length === 0) {
            this.renderPracticeUI('六级真题', '<p class="empty-hint">暂无文章，请先上传文章</p><button class="btn btn-primary" id="quizBack">返回</button>');
            document.getElementById('quizBack')?.addEventListener('click', () => this.showTypeSelect());
            return;
        }
        const html = `
            <div class="practice-header">
                <h3>六级真题题型</h3>
            </div>
            <div class="quiz-setup-inline">
                <select id="practiceQuizArticle">
                    <option value="">选择文章</option>
                    ${articles.map(a => `<option value="${a.id}">${this.escapeHtml(a.title)}</option>`).join('')}
                </select>
                <button class="btn btn-primary" id="practiceGenerateQuiz">生成题目</button>
            </div>
            <div id="practiceQuizContainer" class="quiz-container"></div>
            <div class="practice-actions">
                <button class="btn btn-outline" id="practiceQuizBack">返回</button>
            </div>
        `;
        this.renderPracticeUI('六级真题', html);

        document.getElementById('practiceGenerateQuiz')?.addEventListener('click', () => {
            const aid = document.getElementById('practiceQuizArticle')?.value;
            if (!aid) { alert('请选择文章'); return; }
            const article = ArticlesManager.getArticle(aid);
            if (!article) return;
            this.questions = QuizManager.generateQuestions(article.content);
            this.renderPracticeQuiz();
        });
        document.getElementById('practiceQuizBack')?.addEventListener('click', () => this.showTypeSelect());
    },

    renderPracticeQuiz() {
        const container = document.getElementById('practiceQuizContainer');
        if (!container) return;
        container.innerHTML = this.questions.map((q, i) => `
            <div class="quiz-question" data-index="${i}">
                <h4>${i + 1}. ${this.escapeHtml(q.question)}</h4>
                <ul class="quiz-options">
                    ${q.options.map((opt, j) => `
                        <li data-option="${j}" data-correct="${q.correct}">${String.fromCharCode(65 + j)}. ${this.escapeHtml(String(opt))}</li>
                    `).join('')}
                </ul>
            </div>
        `).join('') + '<div class="quiz-score" id="practiceQuizScore" style="display:none;"></div>';

        container.querySelectorAll('.quiz-options li').forEach(li => {
            li.addEventListener('click', () => this.selectPracticeQuizOption(li));
        });
    },

    selectPracticeQuizOption(li) {
        const questionEl = li.closest('.quiz-question');
        if (questionEl.dataset.answered === 'true') return;

        const options = questionEl.querySelectorAll('li');
        const correct = parseInt(li.dataset.correct);

        options.forEach((opt, i) => {
            opt.classList.remove('selected');
            if (i === correct) opt.classList.add('correct');
            else if (parseInt(li.dataset.option) === i) opt.classList.add('wrong');
        });
        li.classList.add('selected');
        questionEl.dataset.answered = 'true';

        const questions = document.querySelectorAll('#practiceQuizContainer .quiz-question');
        const answered = document.querySelectorAll('#practiceQuizContainer .quiz-question[data-answered="true"]');
        if (answered.length >= questions.length) {
            let correctCount = 0;
            questions.forEach(q => {
                const sel = q.querySelector('li.selected');
                if (sel && sel.dataset.option === q.querySelector('li[data-correct]')?.dataset.correct) correctCount++;
            });
            const scoreEl = document.getElementById('practiceQuizScore');
            if (scoreEl) {
                scoreEl.style.display = 'block';
                scoreEl.textContent = `测验完成！正确 ${correctCount}/${questions.length} 题`;
            }
            if (typeof PlanManager !== 'undefined') {
                PlanManager.recordStudyActivity(new Date().toISOString().slice(0, 10));
            }
        }
    },

    // ========== 题型3：逐句跟读 ==========
    runShadow() {
        const articles = ArticlesManager.articles;
        if (articles.length === 0) {
            this.renderPracticeUI('逐句跟读', '<p class="empty-hint">暂无文章</p><button class="btn btn-primary" id="shadowBack">返回</button>');
            document.getElementById('shadowBack')?.addEventListener('click', () => this.showTypeSelect());
            return;
        }
        const html = `
            <div class="practice-header">
                <h3>逐句跟读训练</h3>
            </div>
            <div class="shadow-setup">
                <select id="shadowArticle">
                    <option value="">选择文章</option>
                    ${articles.map(a => `<option value="${a.id}">${this.escapeHtml(a.title)}</option>`).join('')}
                </select>
                <button class="btn btn-primary" id="shadowStart">开始</button>
            </div>
            <div id="shadowArea" style="display:none;"></div>
        `;
        this.renderPracticeUI('逐句跟读', html);

        document.getElementById('shadowStart')?.addEventListener('click', () => {
            const aid = document.getElementById('shadowArticle')?.value;
            if (!aid) { alert('请选择文章'); return; }
            this.article = ArticlesManager.getArticle(aid);
            if (!this.article) return;
            this.sentences = this.getSentences(this.article);
            if (this.sentences.length === 0) { alert('文章无有效句子'); return; }
            document.querySelector('.shadow-setup').style.display = 'none';
            this.currentIndex = 0;
            this.renderShadowSentence();
        });
    },

    getSentences(contentOrArticle) {
        let content = typeof contentOrArticle === 'string' ? contentOrArticle : contentOrArticle?.content;
        if (!content) return [];
        if (typeof contentOrArticle === 'object' && contentOrArticle.id) {
            const segs = AudioPlayer.getSegments(contentOrArticle);
            return segs.map(s => s.text).filter(t => t && t.trim().length > 5 && t.length < 300);
        }
        return content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 5 && s.length < 300);
    },

    renderShadowSentence() {
        const area = document.getElementById('shadowArea');
        area.style.display = 'block';
        const sent = this.sentences[this.currentIndex];
        const total = this.sentences.length;
        const passScore = 80;

        area.innerHTML = `
            <div class="shadow-progress">
                <div class="progress-bar"><div class="progress-fill" style="width:${(this.currentIndex / total) * 100}%"></div></div>
                <span>${this.currentIndex + 1} / ${total}</span>
            </div>
            <div class="shadow-sentence" id="shadowSentence">${this.escapeHtml(sent)}</div>
            <button class="btn btn-primary" id="shadowPlay">🔊 播放</button>
            <button class="btn btn-primary" id="shadowRecord">🎤 开始跟读</button>
            <p id="shadowStatus" class="shadow-status"></p>
            <p id="shadowScore" class="shadow-score"></p>
        `;

        document.getElementById('shadowPlay')?.addEventListener('click', () => {
            this.speakSentence(sent);
        });
        document.getElementById('shadowRecord')?.addEventListener('click', () => {
            this.startShadowRecord(sent);
        });
    },

    speakSentence(text) {
        if (!window.speechSynthesis) return;
        const accent = typeof AudioPlayer !== 'undefined' ? AudioPlayer.getAccent() : 'en-US';
        const u = new SpeechSynthesisUtterance(text);
        u.lang = accent;
        u.rate = 0.95;
        const voices = speechSynthesis.getVoices().filter(v =>
            accent === 'en-GB' ? /en-gb/i.test(v.lang) : /en-us/i.test(v.lang)
        );
        const v = voices[0];
        if (v) u.voice = v;
        speechSynthesis.speak(u);
    },

    startShadowRecord(expected) {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('当前浏览器不支持语音识别，请使用 Chrome');
            return;
        }
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        const statusEl = document.getElementById('shadowStatus');
        const scoreEl = document.getElementById('shadowScore');
        const btn = document.getElementById('shadowRecord');

        statusEl.textContent = '正在聆听...';
        btn.textContent = '聆听中...';
        btn.disabled = true;

        recognition.onresult = (e) => {
            const transcript = (e.results[0][0].transcript || '').trim();
            const score = this.compareSimilarity(expected, transcript);
            scoreEl.textContent = `得分：${score}`;
            scoreEl.className = 'shadow-score ' + (score >= 80 ? 'pass' : 'fail');

            if (score >= 80) {
                statusEl.textContent = '✓ 过关！';
                this.currentIndex++;
                if (this.currentIndex >= this.sentences.length) {
                    this.showPracticeComplete('逐句跟读', `完成！共 ${this.sentences.length} 句`);
                    return;
                }
                setTimeout(() => this.renderShadowSentence(), 800);
            } else {
                statusEl.textContent = `未达 80 分，请重读（当前 ${score} 分）`;
                btn.textContent = '🎤 重新跟读';
                btn.disabled = false;
            }
        };

        recognition.onerror = () => {
            statusEl.textContent = '识别失败，请重试';
            btn.textContent = '🎤 开始跟读';
            btn.disabled = false;
        };

        recognition.onend = () => {
            if (btn.disabled && statusEl.textContent === '正在聆听...') {
                statusEl.textContent = '未检测到语音，请重试';
                btn.textContent = '🎤 开始跟读';
                btn.disabled = false;
            }
        };

        recognition.start();
    },

    compareSimilarity(a, b) {
        const na = a.toLowerCase().replace(/[^a-z\s'-]/g, '').split(/\s+/).filter(Boolean);
        const nb = b.toLowerCase().replace(/[^a-z\s'-]/g, '').split(/\s+/).filter(Boolean);
        if (na.length === 0) return 100;
        let match = 0;
        const minLen = Math.min(na.length, nb.length);
        for (let i = 0; i < minLen; i++) {
            if (na[i] === nb[i]) match++;
        }
        return Math.round((match / na.length) * 100);
    },

    // ========== 题型4：句子倾听默写（重点） ==========
    runDictation() {
        const articles = ArticlesManager.articles;
        if (articles.length === 0) {
            this.renderPracticeUI('句子倾听默写', '<p class="empty-hint">暂无文章</p><button class="btn btn-primary" id="dictationBack">返回</button>');
            document.getElementById('dictationBack')?.addEventListener('click', () => this.showTypeSelect());
            return;
        }
        const html = `
            <div class="practice-header">
                <h3>句子倾听默写</h3>
            </div>
            <div class="dictation-setup">
                <select id="dictationArticle">
                    <option value="">选择文章</option>
                    ${articles.map(a => `<option value="${a.id}">${this.escapeHtml(a.title)}</option>`).join('')}
                </select>
                <button class="btn btn-primary" id="dictationStart">开始</button>
            </div>
            <div id="dictationArea" style="display:none;"></div>
        `;
        this.renderPracticeUI('句子倾听默写', html);

        document.getElementById('dictationStart')?.addEventListener('click', () => {
            const aid = document.getElementById('dictationArticle')?.value;
            if (!aid) { alert('请选择文章'); return; }
            this.article = ArticlesManager.getArticle(aid);
            if (!this.article) return;
            this.sentences = this.getSentences(this.article);
            if (this.sentences.length === 0) { alert('文章无有效句子'); return; }
            document.querySelector('.dictation-setup').style.display = 'none';
            this.currentIndex = 0;
            this.userAnswer = '';
            this.renderDictationSentence();
        });
    },

    renderDictationSentence() {
        const area = document.getElementById('dictationArea');
        area.style.display = 'block';
        const sent = this.sentences[this.currentIndex];
        const total = this.sentences.length;

        if (!this.userAnswer) this.userAnswer = '';

        area.innerHTML = `
            <div class="dictation-progress">
                <div class="progress-bar"><div class="progress-fill" style="width:${(this.currentIndex / total) * 100}%"></div></div>
                <span>${this.currentIndex + 1} / ${total}</span>
            </div>
            <div class="dictation-controls">
                <button class="btn btn-primary btn-large" id="dictationPlay">🔊 播放句子</button>
            </div>
            <div class="dictation-input-wrap">
                <label>默写（词间用空格分隔）：</label>
                <input type="text" id="dictationInput" placeholder="在此输入听到的句子..." value="${this.escapeHtml(this.userAnswer)}" autocomplete="off" spellcheck="false">
            </div>
            <div class="dictation-actions">
                <button class="btn btn-primary" id="dictationSubmit">提交</button>
            </div>
            <p id="dictationFeedback" class="feedback"></p>
        `;

        document.getElementById('dictationPlay')?.addEventListener('click', () => {
            this.speakSentence(sent);
        });
        document.getElementById('dictationInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('dictationSubmit')?.click();
        });
        document.getElementById('dictationSubmit')?.addEventListener('click', () => this.checkDictation(sent));
        document.getElementById('dictationInput')?.focus();
    },

    checkDictation(correctSentence) {
        const input = document.getElementById('dictationInput')?.value.trim();
        const fb = document.getElementById('dictationFeedback');
        if (!input) {
            fb.textContent = '请输入句子';
            fb.className = 'feedback wrong';
            return;
        }

        const correctWords = this.normalizeWords(correctSentence);
        const userWords = this.normalizeWords(input);

        if (correctWords.join(' ') === userWords.join(' ')) {
            fb.textContent = '✓ 完全正确！';
            fb.className = 'feedback correct';
            this.currentIndex++;
            this.userAnswer = '';
            if (this.currentIndex >= this.sentences.length) {
                this.showPracticeComplete('句子倾听默写', `完成！共 ${this.sentences.length} 句`);
                return;
            }
            setTimeout(() => this.renderDictationSentence(), 600);
        } else {
            const kept = [];
            const len = Math.min(correctWords.length, userWords.length);
            for (let i = 0; i < len; i++) {
                if (correctWords[i].toLowerCase() === userWords[i].toLowerCase()) {
                    kept.push(userWords[i]);
                } else {
                    kept.push('_______');
                }
            }
            for (let i = len; i < correctWords.length; i++) kept.push('_______');
            this.userAnswer = kept.join(' ');
            fb.textContent = '有错误，已保留正确词块，请修正后重新提交';
            fb.className = 'feedback wrong';
            this.renderDictationSentence();
        }
    },

    normalizeWords(s) {
        return s.replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
    },

    // ========== 通用 ==========
    renderPracticeUI(title, content) {
        const area = document.getElementById('practiceArea');
        if (!area) return;
        area.innerHTML = `
            <div class="practice-inner">
                <button class="btn btn-outline practice-back" id="practiceBack">← 返回</button>
                <div class="practice-content">${content}</div>
            </div>
        `;
        document.getElementById('practiceBack')?.addEventListener('click', () => this.showTypeSelect());
    },

    showPracticeComplete(title, msg) {
        const html = `
            <div class="practice-complete">
                <h3>${title}</h3>
                <p class="complete-msg">${msg}</p>
                <button class="btn btn-primary" id="practiceCompleteBack">返回</button>
            </div>
        `;
        this.renderPracticeUI(title, html);
        document.getElementById('practiceCompleteBack')?.addEventListener('click', () => this.showTypeSelect());
        PlanManager.recordStudyActivity(new Date().toISOString().slice(0, 10));
    },

    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    },

    escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s || '';
        return div.innerHTML;
    }
};
