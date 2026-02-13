/**
 * 生词释义 API - 使用 Free Dictionary API + MyMemory 翻译
 */
const WordAPI = {
    dictUrl: 'https://api.dictionaryapi.dev/api/v2/entries/en',
    translateUrl: 'https://api.mymemory.translated.net/get',

    async fetchWordDetails(word) {
        const key = (word || '').toLowerCase().trim();
        if (!key) return null;

        const meta = Storage.get(Storage.keys.VOCAB_META, {});
        const cached = meta[key];
        if (cached?.translation !== undefined && cached?.meanings) {
            return { ...cached, word: key };
        }

        try {
            const [dictRes, transRes] = await Promise.all([
                fetch(`${this.dictUrl}/${encodeURIComponent(key)}`).catch(() => null),
                fetch(`${this.translateUrl}?q=${encodeURIComponent(key)}&langpair=en|zh`).catch(() => null)
            ]);

            let phonetic = '';
            let phoneticUk = '';
            let phoneticUs = '';
            let partOfSpeech = '';
            let meanings = [];
            let translation = '';
            let examples = [];

            if (dictRes?.ok) {
                const data = await dictRes.json();
                const entry = Array.isArray(data) ? data[0] : data;
                if (entry) {
                    const ph = entry.phonetics || [];
                    phonetic = entry.phonetic || ph.find(p => p.text)?.text || ph[0]?.text || '';
                    const pUk = ph.find(p => p.text && /uk|gb|british/i.test(p.audio || ''));
                    const pUs = ph.find(p => p.text && /us|american/i.test(p.audio || ''));
                    phoneticUk = pUk?.text || phonetic;
                    phoneticUs = pUs?.text || phonetic;
                    if (entry.meanings?.length) {
                        meanings = entry.meanings.map(m => ({
                            partOfSpeech: m.partOfSpeech || '',
                            definitions: (m.definitions || []).slice(0, 5).map(d => ({
                                definition: d.definition,
                                example: d.example
                            })),
                            synonyms: m.synonyms || []
                        }));
                        partOfSpeech = entry.meanings.map(m => m.partOfSpeech).filter(Boolean).join('、');
                        examples = entry.meanings.flatMap(m => 
                            (m.definitions || []).filter(d => d.example).map(d => d.example).slice(0, 3)
                        );
                    }
                }
            }

            if (transRes?.ok) {
                const transData = await transRes.json();
                translation = transData?.responseData?.translatedText || '';
            }

            const result = {
                word: key,
                phonetic,
                phoneticUk: phoneticUk || phonetic,
                phoneticUs: phoneticUs || phonetic,
                partOfSpeech,
                translation,
                meanings,
                examples,
                phrases: []
            };

            if (meanings.length) {
                const synonyms = [...new Set(meanings.flatMap(m => m.synonyms || []).slice(0, 8))];
                if (synonyms.length) result.phrases = synonyms;
            }

            const toSave = { ...(meta[key] || {}), ...result };
            meta[key] = toSave;
            Storage.set(Storage.keys.VOCAB_META, meta);

            return result;
        } catch (e) {
            console.error('WordAPI fetch error:', e);
            return { word: key, error: true };
        }
    }
};
