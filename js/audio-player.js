/**
 * 智能音频播放 - Web Speech API TTS
 * 支持男女声区分、倍速、进度、点击断点播放
 */
const AudioPlayer = {
    synth: null,
    voices: [],
    femaleVoice: null,
    maleVoice: null,
    defaultVoice: null,
    segments: [],
    currentIndex: 0,
    isPlaying: false,
    speed: 1,
    pauseBetweenTurns: 180,

    init() {
        this.synth = window.speechSynthesis;
        if (!this.synth) {
            this.bindEvents();
            return false;
        }

        this.loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }

        this.bindEvents();
        const accent = this.getAccent();
        ['audioPlayerAccent', 'readingAccent'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = accent;
        });
        document.getElementById('readingAccent')?.addEventListener('change', (e) => {
            this.setAccent(e.target.value);
            const playerEl = document.getElementById('audioPlayerAccent');
            if (playerEl) playerEl.value = e.target.value;
        });
        return true;
    },

    getAccent() {
        return Storage.get(Storage.keys.TTS_ACCENT, 'en-US');
    },

    setAccent(accent) {
        Storage.set(Storage.keys.TTS_ACCENT, accent);
        this.loadVoices();
    },

    loadVoices() {
        this.voices = this.synth.getVoices();
        if (this.voices.length === 0) return;

        const accent = this.getAccent();
        const isUS = accent === 'en-US';
        const excludeOther = v => isUS ? /en-us/i.test(v.lang) : /en-gb/i.test(v.lang);
        const strictVoices = this.voices.filter(excludeOther);

        if (strictVoices.length === 0) return;

        const femaleNames = /female|woman|samantha|karen|victoria|zira|susan|emily|anna|lucy|sara|jenny|moira|kate|tessa|aria|fiona|helen|hazel|laura|claire|libby/i;
        const maleNames = /male|man|daniel|alex|david|mark|george|james|paul|ryan|tom|ralph|fred|bruce|nick|harry|leo/i;
        const isFemale = v => (femaleNames.test(v.name) || v.name.toLowerCase().includes('female')) && !maleNames.test(v.name);
        const isMale = v => (maleNames.test(v.name) || v.name.toLowerCase().includes('male')) && !femaleNames.test(v.name);

        const femaleCandidates = strictVoices.filter(isFemale);
        const maleCandidates = strictVoices.filter(isMale);

        this.femaleVoice = femaleCandidates[0] || strictVoices.find(isFemale);
        this.maleVoice = maleCandidates[0] || strictVoices.find(isMale);

        if (this.femaleVoice && this.maleVoice && this.femaleVoice === this.maleVoice) {
            this.maleVoice = maleCandidates.find(v => v !== this.femaleVoice) || maleCandidates[1] || null;
        }
        if (!this.maleVoice && this.femaleVoice) {
            this.maleVoice = maleCandidates.find(v => v !== this.femaleVoice) || strictVoices.find(v => v !== this.femaleVoice && isMale(v));
        }
        if (!this.femaleVoice && this.maleVoice) {
            this.femaleVoice = femaleCandidates.find(v => v !== this.maleVoice) || strictVoices.find(v => v !== this.maleVoice && isFemale(v));
        }
        if (this.femaleVoice && this.femaleVoice === this.maleVoice && strictVoices.length >= 2) {
            const other = strictVoices.find(v => v !== this.femaleVoice);
            if (other) this.maleVoice = other;
        }
        this.defaultVoice = this.maleVoice || this.femaleVoice || strictVoices[0];
    },

    ensureVoicesLoaded() {
        if (this.voices.length === 0) this.loadVoices();
        return this.voices.length > 0;
    },

    isSupported() {
        return !!window.speechSynthesis;
    },

    testSpeak() {
        if (!this.synth) return;
        const u = new SpeechSynthesisUtterance('Hello. Can you hear me?');
        u.lang = this.getAccent();
        u.rate = this.speed;
        u.volume = 1;
        const voice = this.defaultVoice;
        if (voice) u.voice = voice;
        this.synth.speak(u);
    },

    bindEvents() {
        document.getElementById('audioPlayBtn')?.addEventListener('click', () => this.toggleFromReading());
        document.getElementById('audioPlayerPlay')?.addEventListener('click', () => this.toggle());
        document.getElementById('audioPlayerSpeed')?.addEventListener('change', (e) => {
            this.speed = parseFloat(e.target.value);
        });
        document.getElementById('audioPlayerAccent')?.addEventListener('change', (e) => {
            this.setAccent(e.target.value);
            const readingEl = document.getElementById('readingAccent');
            if (readingEl) readingEl.value = e.target.value;
        });
        document.getElementById('audioPlayerClose')?.addEventListener('click', () => this.hidePlayer());
        document.getElementById('audioPlayerTest')?.addEventListener('click', () => this.testSpeak());

        window.addEventListener('beforeunload', () => this.stop());
        window.addEventListener('pagehide', () => this.stop());
    },

    getSegments(article) {
        const type = article.type || 'c';
        if (type === 'a' || type === 'b') {
            return ArticlesManager.parseDialogue(article.content).map((t, i) => ({
                index: i,
                text: t.text,
                speaker: t.speaker
            }));
        }
        const sentences = article.content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
        const segs = sentences.length > 1 ? sentences : (article.content.trim() ? [article.content.trim()] : []);
        return segs.map((text, i) => ({ index: i, text, speaker: null }));
    },

    showPlayer(article) {
        const panel = document.getElementById('audioPlayerPanel');
        if (!panel) return;
        panel.classList.add('active');
        panel.dataset.articleId = article.id;
        this.segments = this.getSegments(article);
        this.currentIndex = 0;
        this.updateProgress(0);
        const accentEl = document.getElementById('audioPlayerAccent');
        if (accentEl) accentEl.value = this.getAccent();
        document.getElementById('audioPlayerSpeed').value = this.speed;
        this.syncToolbarPlayButton();
    },

    hidePlayer() {
        document.getElementById('audioPlayerPanel')?.classList.remove('active');
        this.stop();
        this.syncToolbarPlayButton();
    },

    syncToolbarPlayButton() {
        const panel = document.getElementById('audioPlayerPanel');
        const toolbarBtn = document.getElementById('audioPlayBtn');
        if (!toolbarBtn) return;
        if (panel?.classList.contains('active')) {
            toolbarBtn.style.display = 'none';
        } else {
            toolbarBtn.style.display = '';
        }
    },

    play(article, fromIndex = 0) {
        if (!this.isSupported()) {
            alert('当前浏览器不支持语音合成，请使用 Chrome、Edge 或 Safari');
            return;
        }

        this.synth?.cancel();
        this.showPlayer(article);
        this.ensureVoicesLoaded();
        const safeIndex = Math.max(0, Math.min(fromIndex, this.segments.length - 1));
        this.currentIndex = safeIndex >= this.segments.length ? 0 : safeIndex;
        this.isPlaying = true;
        this.updateUIState(true);
        this.speakNext(article);
    },

    speakNext(article) {
        if (!this.isPlaying || this.currentIndex >= this.segments.length) {
            this.isPlaying = false;
            this.updateUIState(false);
            return;
        }

        this.loadVoices();
        const seg = this.segments[this.currentIndex];
        if (!seg || !seg.text || !seg.text.trim()) {
            this.currentIndex++;
            this.speakNext(article);
            return;
        }

        this.highlightSegment(this.currentIndex);
        this.scrollToSegment(this.currentIndex);

        const u = new SpeechSynthesisUtterance(seg.text.trim());
        u.rate = this.speed;
        u.volume = 1;
        u.lang = this.getAccent();
        let voice = this.defaultVoice;
        if (seg.speaker === 'w') {
            voice = this.femaleVoice || this.defaultVoice;
            u.pitch = this.femaleVoice ? 1 : 1.18;
        } else if (seg.speaker === 'm') {
            voice = this.maleVoice || this.defaultVoice;
            u.pitch = this.maleVoice ? 1 : 0.88;
        } else {
            u.pitch = 1;
        }
        if (voice) u.voice = voice;

        const idx = this.currentIndex;
        u.onend = () => {
            if (idx !== this.currentIndex) return;
            this.currentIndex++;
            const nextSeg = this.segments[this.currentIndex];
            const isDialogue = seg.speaker !== null;
            const switchingSpeaker = isDialogue && nextSeg && nextSeg.speaker !== seg.speaker;
            const delay = switchingSpeaker ? this.pauseBetweenTurns : 50;
            setTimeout(() => this.speakNext(article), delay);
        };

        u.onerror = (e) => {
            if (idx !== this.currentIndex) return;
            this.currentIndex++;
            this.speakNext(article);
        };

        try {
            this.synth.speak(u);
        } catch (err) {
            this.currentIndex++;
            this.speakNext(article);
        }
    },

    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            const id = document.getElementById('audioPlayerPanel')?.dataset?.articleId;
            const article = id ? ArticlesManager.getArticle(id) : null;
            if (article) {
                const fromIndex = this.currentIndex >= this.segments.length ? 0 : this.currentIndex;
                this.play(article, fromIndex);
            }
        }
    },

    toggleFromReading() {
        if (!this.isSupported()) {
            alert('当前浏览器不支持语音合成，请使用 Chrome、Edge 或 Safari');
            return;
        }
        const article = ArticlesManager.getArticle(ArticlesManager.currentArticleId);
        if (!article) {
            alert('请先选择一篇文章');
            return;
        }
        if (this.isPlaying && document.getElementById('audioPlayerPanel')?.dataset?.articleId === article.id) {
            this.toggle();
        } else {
            this.play(article, 0);
        }
    },

    stop() {
        this.isPlaying = false;
        this.synth?.cancel();
        this.updateUIState(false);
    },

    playFromSegment(index) {
        const id = document.getElementById('audioPlayerPanel')?.dataset?.articleId ||
            ArticlesManager.currentArticleId;
        const article = id ? ArticlesManager.getArticle(id) : null;
        if (article) {
            this.stop();
            setTimeout(() => this.play(article, index), 100);
        }
    },

    updateProgress(index) {
        const total = this.segments.length;
        const pct = total ? Math.round((index / total) * 100) : 0;
        const fill = document.getElementById('audioPlayerProgressFill');
        const label = document.getElementById('audioPlayerProgressLabel');
        if (fill) fill.style.width = pct + '%';
        if (label) label.textContent = `${index}/${total}`;
    },

    updateUIState(playing) {
        const btn = document.getElementById('audioPlayerPlay');
        if (btn) btn.textContent = playing ? '⏸ 暂停' : '▶ 播放';
    },

    highlightSegment(index) {
        document.querySelectorAll('[data-segment-index]').forEach(el => {
            el.classList.toggle('playing', parseInt(el.dataset.segmentIndex) === index);
        });
        this.updateProgress(index);
    },

    scrollToSegment(index) {
        const el = document.querySelector(`[data-segment-index="${index}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};
