/**
 * 六级听力题目自动生成
 * 基于文章内容提取关键信息生成选择题
 */
const QuizManager = {
    init() {
        document.getElementById('generateQuiz')?.addEventListener('click', () => this.generateQuiz());
    },

    generateQuiz() {
        const articleId = document.getElementById('quizArticleSelect')?.value;
        if (!articleId) {
            alert('请先选择一篇文章');
            return;
        }

        const article = ArticlesManager.getArticle(articleId);
        if (!article) return;

        const questions = this.generateQuestions(article.content);
        this.renderQuiz(questions);
    },

    /**
     * 从文章中提取并生成六级风格听力理解题
     */
    generateQuestions(content) {
        const questions = [];
        const sentences = this.extractSentences(content);

        if (sentences.length < 2) {
            return [{
                question: "According to the passage, what is the main topic?",
                options: ["The passage doesn't specify", "A general discussion", "Various topics", "Unclear"],
                correct: 0
            }];
        }

        const usedIndices = new Set();

        // 1. 主旨题
        const mainIdeaQ = this.createMainIdeaQuestion(content, sentences);
        if (mainIdeaQ) questions.push(mainIdeaQ);

        // 2. 细节题 & 词汇题
        const numExtra = Math.min(4, Math.floor(sentences.length / 2));
        for (let i = 0; i < numExtra; i++) {
            let idx = Math.floor(Math.random() * sentences.length);
            while (usedIndices.has(idx)) idx = (idx + 1) % sentences.length;
            usedIndices.add(idx);
            const q = this.createQuestionFromSentence(sentences[idx], sentences) || 
                      this.createDetailQuestion(sentences[idx], sentences);
            if (q) questions.push(q);
        }

        return questions.length > 0 ? questions : [{
            question: "What can we infer from this passage?",
            options: ["The author presents factual information", "The passage discusses multiple viewpoints", "Further reading is recommended", "The topic requires more research"],
            correct: 0
        }];
    },

    createMainIdeaQuestion(content, sentences) {
        const keywords = this.extractKeywords(content);
        if (keywords.length < 2) return null;
        const correctTopic = keywords.slice(0, 2).join(' and ');
        const distractors = ['personal experiences', 'historical events', 'scientific methods', 'cultural differences'].filter(
            d => !correctTopic.toLowerCase().includes(d)
        ).slice(0, 3);
        const options = [correctTopic, ...distractors].sort(() => Math.random() - 0.5);
        return {
            question: "What is the passage mainly about?",
            options,
            correct: options.indexOf(correctTopic)
        };
    },

    extractKeywords(content) {
        const stop = new Set('the a an is are was were to of in on at for with by and or but it'.split(' '));
        const words = content.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
        const freq = {};
        words.forEach(w => {
            if (!stop.has(w)) freq[w] = (freq[w] || 0) + 1;
        });
        return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
    },

    createDetailQuestion(sentence, sentences) {
        if (sentence.length < 20) return null;
        const target = sentence.length > 60 ? sentence.slice(0, 60) + '...' : sentence;
        const others = sentences.filter(s => s !== sentence && s.length > 15);
        if (others.length < 2) return null;
        const distractors = others.slice(0, 3).map(s => s.length > 60 ? s.slice(0, 60) + '...' : s);
        const options = [target, ...distractors].sort(() => Math.random() - 0.5);
        return {
            question: "According to the passage, which of the following is mentioned?",
            options,
            correct: options.indexOf(target)
        };
    },

    extractSentences(content) {
        return content
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 20 && s.length < 200);
    },

    createQuestionFromSentence(sentence, allSentences) {
        const words = sentence.split(/\s+/);
        if (words.length < 4) return null;

        const fillerWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'and', 'or', 'but'];
        const contentWords = words.filter(w => w.length > 3 && !fillerWords.includes(w.toLowerCase()));

        if (contentWords.length < 2) return null;

        const blankIdx = Math.floor(Math.random() * contentWords.length);
        const blankWord = contentWords[blankIdx];
        const blanked = sentence.replace(new RegExp(blankWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '_____');

        const distractors = this.generateDistractors(blankWord, allSentences);
        if (distractors.length < 3) return null;

        const options = [blankWord, ...distractors].sort(() => Math.random() - 0.5);
        const correct = options.indexOf(blankWord);

        return {
            question: `Listen to the sentence and choose the word that best completes it: "${blanked}"`,
            options,
            correct
        };
    },

    generateDistractors(word, sentences) {
        const wordList = new Set();
        sentences.forEach(s => {
            s.split(/\s+/).forEach(w => {
                const clean = w.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
                if (clean.length > 2 && clean !== word.toLowerCase()) {
                    wordList.add(w.replace(/[^a-zA-Z'-]/g, ''));
                }
            });
        });
        const arr = [...wordList];
        const result = [];
        while (result.length < 3 && arr.length > 0) {
            const idx = Math.floor(Math.random() * arr.length);
            result.push(arr.splice(idx, 1)[0]);
        }
        return result;
    },

    renderQuiz(questions) {
        const container = document.getElementById('quizContainer');
        container.innerHTML = questions.map((q, i) => `
            <div class="quiz-question" data-index="${i}">
                <h4>${i + 1}. ${q.question}</h4>
                <ul class="quiz-options">
                    ${q.options.map((opt, j) => `
                        <li data-option="${j}" data-correct="${q.correct}">${String.fromCharCode(65 + j)}. ${opt}</li>
                    `).join('')}
                </ul>
            </div>
        `).join('') + '<div class="quiz-score" id="quizScore" style="display:none;"></div>';

        container.querySelectorAll('.quiz-options li').forEach(li => {
            li.addEventListener('click', () => this.selectOption(li));
        });
    },

    selectOption(li) {
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

        this.updateQuizScore();
    },

    updateQuizScore() {
        const questions = document.querySelectorAll('.quiz-question[data-index]');
        const answered = document.querySelectorAll('.quiz-question[data-answered="true"]');
        if (answered.length < questions.length) return;

        let correct = 0;
        questions.forEach(q => {
            const selected = q.querySelector('li.selected');
            if (selected && selected.dataset.option === q.querySelector('li[data-correct]')?.dataset.correct) {
                correct++;
            }
        });

        const scoreEl = document.getElementById('quizScore');
        scoreEl.style.display = 'block';
        scoreEl.textContent = `测验完成！正确 ${correct}/${questions.length} 题`;
        if (typeof PlanManager !== 'undefined') {
            PlanManager.recordStudyActivity(new Date().toISOString().slice(0, 10));
        }
    }
};
