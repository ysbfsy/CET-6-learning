/**
 * Firebase 登录与云端同步
 */
const FirebaseAuth = {
    auth: null,
    db: null,
    unsubscribe: null,

    init() {
        this.bindAuthModal();
        if (typeof firebase === 'undefined' || !FirebaseConfig?.apiKey || FirebaseConfig.apiKey === 'YOUR_API_KEY') {
            this.renderLoginStatus(false);
            return;
        }

        try {
            firebase.initializeApp(FirebaseConfig);
            this.auth = firebase.auth();
            this.db = firebase.firestore();

            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    this.loadUserData(user.uid);
                    this.renderLoginStatus(true, user.email);
                } else {
                    this.clearSync();
                    this.renderLoginStatus(false);
                }
            });

            this.renderLoginStatus(false);
        } catch (e) {
            console.error('Firebase init error:', e);
            this.renderLoginStatus(false);
        }
    },

    _mergeValue(key, localVal, remoteVal) {
        if (remoteVal === undefined) return localVal;
        if (localVal === null || localVal === undefined) return remoteVal;
        if (key === Storage.keys.ARTICLES) {
            const local = Array.isArray(localVal) ? localVal : [];
            const remote = Array.isArray(remoteVal) ? remoteVal : [];
            if (remote.length === 0) return local;
            if (local.length === 0) return remote;
            const map = new Map();
            remote.forEach(a => map.set(a.id, a));
            local.forEach(a => map.set(a.id, a));
            return Array.from(map.values());
        }
        if (key === Storage.keys.WORD_MARKS || key === Storage.keys.VOCAB_META) {
            const local = localVal && typeof localVal === 'object' ? localVal : {};
            const remote = remoteVal && typeof remoteVal === 'object' ? remoteVal : {};
            return { ...remote, ...local };
        }
        if (key === Storage.keys.TASKS) {
            const local = Array.isArray(localVal) ? localVal : [];
            const remote = Array.isArray(remoteVal) ? remoteVal : [];
            if (remote.length === 0) return local;
            if (local.length === 0) return remote;
            const map = new Map();
            remote.forEach(t => map.set(t.id || t.date + t.content, t));
            local.forEach(t => map.set(t.id || t.date + t.content, t));
            return Array.from(map.values());
        }
        if (key === Storage.keys.STUDY_HISTORY) {
            const local = localVal && typeof localVal === 'object' ? localVal : {};
            const remote = remoteVal && typeof remoteVal === 'object' ? remoteVal : {};
            const merged = { ...remote };
            Object.keys(local).forEach(d => {
                const l = Array.isArray(local[d]) ? local[d] : [];
                const r = Array.isArray(merged[d]) ? merged[d] : [];
                if (l.length > 0 || r.length > 0) {
                    const map = new Map();
                    r.forEach(x => map.set(JSON.stringify(x), x));
                    l.forEach(x => map.set(JSON.stringify(x), x));
                    merged[d] = Array.from(map.values());
                }
            });
            return merged;
        }
        return remoteVal;
    },

    loadUserData(uid) {
        this.db.collection('users').doc(uid).get().then(doc => {
            if (doc.exists) {
                const remote = doc.data();
                Storage.setSuppressSync(true);
                Object.keys(Storage.keys).forEach(k => {
                    const key = Storage.keys[k];
                    if (remote[key] !== undefined) {
                        const localVal = Storage.get(key);
                        const merged = this._mergeValue(key, localVal, remote[key]);
                        Storage.set(key, merged);
                    }
                });
                Storage.setSuppressSync(false);
                this.saveAllToFirestore(uid);
            } else {
                this.saveAllToFirestore(uid);
            }
            this.setupSync(uid);
            this.triggerReload();
        }).catch(() => this.setupSync(uid));
    },

    saveAllToFirestore(uid) {
        if (!this.db || !uid) return;
        const data = {};
        Object.values(Storage.keys).forEach(key => {
            const val = Storage.get(key);
            if (val !== null) data[key] = val;
        });
        if (Object.keys(data).length) {
            this.db.collection('users').doc(uid).set(data, { merge: true }).catch(e => console.error(e));
        }
    },

    setupSync(uid) {
        Storage.setSyncCallback((key, value) => this.saveToFirestore(uid, key, value));
    },

    saveToFirestore(uid, key, value) {
        if (!this.db || !uid) return;
        this.db.collection('users').doc(uid).set(
            { [key]: value },
            { merge: true }
        ).catch(e => console.error('Firestore save error:', e));
    },

    clearSync() {
        Storage.clearSyncCallbacks();
    },

    triggerReload() {
        if (typeof ArticlesManager !== 'undefined') ArticlesManager.init?.();
        if (typeof PlanManager !== 'undefined') PlanManager.init?.();
        if (typeof VocabularyManager !== 'undefined') VocabularyManager.render?.();
    },

    async register(email, password) {
        if (!this.auth) throw new Error('Firebase 未配置');
        const cred = await this.auth.createUserWithEmailAndPassword(email, password);
        return cred.user;
    },

    async login(email, password) {
        if (!this.auth) throw new Error('Firebase 未配置');
        const cred = await this.auth.signInWithEmailAndPassword(email, password);
        return cred.user;
    },

    async logout() {
        if (this.auth) await this.auth.signOut();
    },

    renderLoginStatus(loggedIn, email = '') {
        const html = loggedIn
            ? `<span class="user-email">${email}</span><button class="btn btn-primary btn-small btn-logout">退出</button>`
            : '<button class="btn btn-primary btn-small btn-login">登录 / 注册</button>';
        [document.getElementById('userStatus'), document.getElementById('userStatusHeader')].forEach(el => {
            if (!el) return;
            el.innerHTML = html;
        });
        document.querySelectorAll('.btn-logout').forEach(btn => btn.addEventListener('click', () => this.logout()));
        document.querySelectorAll('.btn-login').forEach(btn => btn.addEventListener('click', () => this.openLoginModal()));
    },

    openLoginModal() {
        document.getElementById('authModal')?.classList.add('active');
        const errEl = document.getElementById('authError');
        if (errEl) errEl.textContent = '';
    },

    closeLoginModal() {
        document.getElementById('authModal')?.classList.remove('active');
    },

    bindAuthModal() {
        const modal = document.getElementById('authModal');
        if (!modal || modal.dataset.bound === 'true') return;
        modal.dataset.bound = 'true';

        modal.querySelector('[data-close="authModal"]')?.addEventListener('click', () => this.closeLoginModal());
        modal.addEventListener('click', (e) => { if (e.target === modal) this.closeLoginModal(); });

        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const isLogin = tab.dataset.tab === 'login';
                document.getElementById('authSubmit').textContent = isLogin ? '登录' : '注册';
                document.getElementById('authForm').dataset.mode = isLogin ? 'login' : 'register';
            });
        });

        document.getElementById('authForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail')?.value?.trim();
            const password = document.getElementById('authPassword')?.value;
            const errEl = document.getElementById('authError');
            const submitBtn = document.getElementById('authSubmit');
            if (!email || !password) {
                if (errEl) errEl.textContent = '请填写邮箱和密码';
                return;
            }
            if (!this.auth) {
                if (errEl) errEl.textContent = 'Firebase 未加载，请检查网络（可能被拦截）后刷新';
                return;
            }

            if (errEl) errEl.textContent = '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.dataset.originalText = submitBtn.textContent;
                submitBtn.textContent = '处理中...';
            }

            try {
                if (document.getElementById('authForm')?.dataset.mode === 'register') {
                    await this.register(email, password);
                } else {
                    await this.login(email, password);
                }
                this.closeLoginModal();
            } catch (err) {
                const msg = err.code === 'auth/email-already-in-use' ? '该邮箱已注册，请直接登录' :
                    err.code === 'auth/invalid-email' ? '邮箱格式不正确' :
                    err.code === 'auth/weak-password' ? '密码至少6位' :
                    err.code === 'auth/user-not-found' ? '该邮箱未注册' :
                    err.code === 'auth/wrong-password' ? '密码错误' :
                    err.code === 'auth/network-request-failed' ? '网络请求失败，请检查网络' :
                    err.message || '操作失败';
                if (errEl) errEl.textContent = msg;
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = submitBtn.dataset.originalText || '登录';
            }
        });
    }
};
