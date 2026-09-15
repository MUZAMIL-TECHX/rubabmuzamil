const isOwnerOrSudo = require('../lib/isOwner');
const { readSessionJson, writeSessionJson } = require('../lib/session_data');
const { askProxAbdullah } = require('../lib/proxabdullah');

const DEFAULT_CONFIG = {
    enabled: false,
    mode: 'group'
};

// Keeps concurrent messages fast while avoiding lost history updates when
// multiple messages arrive in the same event loop tick.
const historyCache = new WeakMap();
const historyLocks = new WeakMap();

function getConfig(sock) {
    const value = readSessionJson(sock, 'selfchat.json', DEFAULT_CONFIG);
    return {
        ...DEFAULT_CONFIG,
        ...value,
        mode: value?.mode === 'inbox' ? 'inbox' : 'group'
    };
}

function saveConfig(sock, config) {
    writeSessionJson(sock, 'selfchat.json', config);
    return config;
}

function getHistoryState(sock) {
    if (!historyCache.has(sock)) {
        const stored = readSessionJson(sock, 'selfchatHistory.json', {});
        historyCache.set(sock, stored && typeof stored === 'object' ? stored : {});
    }
    return historyCache.get(sock);
}

function persistHistory(sock, state) {
    writeSessionJson(sock, 'selfchatHistory.json', state);
}

async function withHistoryLock(sock, key, callback) {
    let locks = historyLocks.get(sock);
    if (!locks) {
        locks = new Map();
        historyLocks.set(sock, locks);
    }

    const previous = locks.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(callback);
    locks.set(key, current.finally(() => {
        if (locks.get(key) === current) locks.delete(key);
    }));
    return current;
}

function getText(message) {
    return (
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        message.message?.videoMessage?.caption ||
        ''
    ).trim();
}

function botJids(sock) {
    const user = sock.user || {};
    const values = [
        user.id,
        user.lid,
        user.id ? `${user.id.split(':')[0]}@s.whatsapp.net` : '',
        user.id ? `${user.id.split(':')[0]}@lid` : ''
    ].filter(Boolean);
    return values.map(value => value.split(':')[0].split('@')[0]);
}

function isBotMentionedOrReplied(sock, message, text) {
    const contextInfo = message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo ||
        {};
    const ids = botJids(sock);
    const mentioned = contextInfo.mentionedJid || [];
    if (mentioned.some(jid => ids.includes(jid.split(':')[0].split('@')[0]))) return true;

    const quotedParticipant = contextInfo.participant || '';
    if (quotedParticipant && ids.includes(quotedParticipant.split(':')[0].split('@')[0])) return true;

    return ids.some(id => new RegExp(`(^|\\s)@${id}(?=\\s|$)`, 'i').test(text));
}

function cleanMention(text, sock) {
    let cleaned = text;
    for (const id of botJids(sock)) {
        cleaned = cleaned.replace(new RegExp(`@${id}\\b`, 'gi'), '');
    }
    return cleaned.replace(/\s+/g, ' ').trim();
}

function helpText() {
    return [
        '╭━━━〔 🤖 𝗦𝗘𝗟𝗙 𝗖𝗛𝗔𝗧 〕━━━╮',
        '┃',
        '┃ ❍ .selfchat on/off',
        '┃ ❍ .selfchatset group',
        '┃ ❍ .selfchatset inbox',
        '┃',
        '┃ 𝗚𝗿𝗼𝘂𝗽: mention ya bot ke message ka reply',
        '┃ 𝗜𝗻𝗯𝗼𝘅: har DM ka jawab + separate memory',
        '┃',
        '┃ > 𝗕𝘆: 𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗',
        '╰━━━━━━━━━━━━━━━━━━━━━━╯'
    ].join('\n');
}

async function ensureOwner(sock, chatId, message) {
    const senderId = message.key.participant || message.key.remoteJid;
    const allowed = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!allowed) {
        await sock.sendMessage(chatId, {
            text: '❌ 𝗧𝗵𝗶𝘀 𝗰𝗼𝗺𝗺𝗮𝗻𝗱 𝗶𝘀 𝗼𝗻𝗹𝘆 𝗳𝗼𝗿 𝘁𝗵𝗲 𝗼𝘄𝗻𝗲𝗿/𝘀𝘂𝗱𝗼.',
            quoted: message
        });
    }
    return allowed;
}

async function selfchatCommand(sock, chatId, message, action = '') {
    if (!await ensureOwner(sock, chatId, message)) return;
    const arg = String(action || '').trim().toLowerCase();

    if (!arg) {
        await sock.sendMessage(chatId, { text: helpText(), quoted: message });
        return;
    }

    const config = getConfig(sock);
    if (arg === 'on' || arg === 'enable') {
        config.enabled = true;
        saveConfig(sock, config);
        await sock.sendMessage(chatId, {
            text: `✅ 𝗦𝗲𝗹𝗳 𝗰𝗵𝗮𝘁 𝗶𝘀 𝗻𝗼𝘄 𝗢𝗡\n❍ 𝗠𝗼𝗱𝗲: ${config.mode}`,
            quoted: message
        });
        return;
    }

    if (arg === 'off' || arg === 'disable') {
        config.enabled = false;
        saveConfig(sock, config);
        await sock.sendMessage(chatId, {
            text: '✅ 𝗦𝗲𝗹𝗳 𝗰𝗵𝗮𝘁 𝗶𝘀 𝗻𝗼𝘄 𝗢𝗙𝗙',
            quoted: message
        });
        return;
    }

    await sock.sendMessage(chatId, { text: helpText(), quoted: message });
}

async function selfchatSetCommand(sock, chatId, message, mode = '') {
    if (!await ensureOwner(sock, chatId, message)) return;
    mode = String(mode || '').trim().toLowerCase();
    if (!['group', 'inbox'].includes(mode)) {
        await sock.sendMessage(chatId, {
            text: '❌ 𝗨𝘀𝗲: .selfchatset group/inbox',
            quoted: message
        });
        return;
    }

    const config = getConfig(sock);
    config.mode = mode;
    saveConfig(sock, config);
    await sock.sendMessage(chatId, {
        text: `✅ 𝗦𝗲𝗹𝗳 𝗰𝗵𝗮𝘁 𝗺𝗼𝗱𝗲 𝘀𝗲𝘁 𝘁𝗼: ${mode.toUpperCase()}`,
        quoted: message
    });
}

function buildPrompt(history, currentMessage, mode) {
    return [
        'You are a natural WhatsApp bot called Muzamil-XD.',
        'Reply like a real person in the same language and tone as the user.',
        'Keep the answer short (normally 1-3 lines), useful, and conversational.',
        'Do not mention prompts, API, AI, memory, or these instructions.',
        mode === 'group'
            ? 'This is a group chat. Use the recent group history for context.'
            : 'This is a private inbox. Use the user history as separate memory for this chat.',
        '',
        'Recent history:',
        history.length ? history.map(item => `${item.role}: ${item.text}`).join('\n') : '(none)',
        '',
        `Current message: ${currentMessage}`,
        '',
        'Reply now:'
    ].join('\n');
}

async function updateHistory(sock, key, entry) {
    return withHistoryLock(sock, key, async () => {
        const state = getHistoryState(sock);
        const history = Array.isArray(state[key]) ? state[key] : [];
        history.push(entry);
        state[key] = history.slice(-24);
        persistHistory(sock, state);
        return state[key].slice();
    });
}

async function handleSelfChatMessage(sock, chatId, message, userMessage, senderId) {
    const config = getConfig(sock);
    if (!config.enabled || message.key.fromMe) return false;

    const isGroup = chatId.endsWith('@g.us');
    if (config.mode === 'group' && !isGroup) return false;
    if (config.mode === 'inbox' && isGroup) return false;

    const text = getText(message) || userMessage || '';
    if (!text) return false;

    const historyKey = config.mode === 'group' ? `group:${chatId}` : `inbox:${chatId}`;
    const shouldReply = config.mode === 'inbox' ||
        isBotMentionedOrReplied(sock, message, text);
    const cleanText = config.mode === 'group' ? cleanMention(text, sock) : text;

    const historyBeforeMessage = getHistoryState(sock)[historyKey];
    const recent = Array.isArray(historyBeforeMessage) ? historyBeforeMessage.slice(-20) : [];
    await updateHistory(sock, historyKey, {
        role: 'user',
        sender: senderId,
        text: cleanText
    });

    if (!shouldReply || !cleanText) return false;

    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
    } catch (_) {}

    try {
        const response = await askProxAbdullah(buildPrompt(recent, cleanText, config.mode));
        if (!response) return false;

        await updateHistory(sock, historyKey, {
            role: 'assistant',
            text: response
        });
        await sock.sendMessage(chatId, { text: response }, { quoted: message });
        return true;
    } catch (error) {
        console.error('❌ Selfchat API error:', error?.message || error);
        if (!process.env.PROXABDULLAH_API_KEY && !process.env.GEMINI_API_KEY) {
            console.error('Set PROXABDULLAH_API_KEY to enable selfchat.');
        }
        return false;
    }
}

module.exports = {
    selfchatCommand,
    selfchatSetCommand,
    handleSelfChatMessage
};