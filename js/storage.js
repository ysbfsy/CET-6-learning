/**
 * 统一数据存储 - LocalStorage + 可选 Firebase 云端同步
 */
const Storage = {
    keys: {
        ARTICLES: 'english_listening_articles',
        WORD_MARKS: 'english_listening_word_marks',
        TASKS: 'english_listening_tasks',
        STUDY_HISTORY: 'english_listening_study_history',
        AI_API_KEY: 'english_listening_ai_api_key',
        AI_BASE_URL: 'english_listening_ai_base_url',
        VOCAB_META: 'english_listening_vocab_meta',
        TTS_ACCENT: 'english_listening_tts_accent'
    },

    _syncCallback: null,
    _suppressSync: false,

    setSuppressSync(flag) {
        this._suppressSync = !!flag;
    },

    setSyncCallback(callback) {
        this._syncCallback = callback;
    },

    clearSyncCallbacks() {
        this._syncCallback = null;
    },

    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            if (!this._suppressSync && this._syncCallback) {
                this._syncCallback(key, value);
            }
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    }
};
