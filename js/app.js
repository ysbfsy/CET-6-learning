/**
 * 主应用入口 - 导航、初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    ArticlesManager.init();
    AudioPlayer.init();
    QuizManager.init();
    VocabularyManager.init();
    AIPlanManager.init();
    PlanManager.init();
    PracticeManager.init();

    initNavigation();
    initArticleSelect();
    initClearMarks();
});

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            if (page !== 'plan') PracticeManager.stopPractice();
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(`page-${page}`).classList.add('active');
            if (page === 'vocabulary') VocabularyManager.render();
            if (page === 'plan') PracticeManager.showTypeSelect();
        });
    });
}

function initArticleSelect() {
    document.getElementById('articleSelect')?.addEventListener('change', (e) => {
        const id = e.target.value;
        const panel = document.getElementById('audioPlayerPanel');
        if (panel?.dataset?.articleId && panel.dataset.articleId !== id) {
            AudioPlayer.stop();
        }
        if (id) ArticlesManager.loadArticleForReading(id);
        else {
            document.getElementById('articleContent').innerHTML = '';
            document.getElementById('markedWordsList').innerHTML = '<p class="empty-hint">选择文章开始阅读</p>';
        }
    });
}

function initClearMarks() {
    document.getElementById('clearMarks')?.addEventListener('click', () => {
        ArticlesManager.clearAllMarks();
    });
}
