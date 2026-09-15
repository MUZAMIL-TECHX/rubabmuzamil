const { readSessionJson, writeSessionJson } = require('../lib/session_data');

function readState(sock) {
    return readSessionJson(sock, 'anticall.json', { enabled: false });
}

function writeState(sock, enabled) {
    writeSessionJson(sock, 'anticall.json', { enabled: !!enabled });
}

async function anticallCommand(sock, chatId, message, args) {
    const state = readState(sock);
    const sub = (args || '').trim().toLowerCase();

    if (!sub || (sub !== 'on' && sub !== 'off' && sub !== 'status')) {
        await sock.sendMessage(chatId, { text: '*ANTICALL*\n\n.anticall on  - Enable auto-block on incoming calls\n.anticall off - Disable anticall\n.anticall status - Show current status' }, { quoted: message });
        return;
    }

    if (sub === 'status') {
        await sock.sendMessage(chatId, { text: `Anticall is currently *${state.enabled ? 'ON' : 'OFF'}*.` }, { quoted: message });
        return;
    }

    const enable = sub === 'on';
    writeState(sock, enable);
    await sock.sendMessage(chatId, { text: `Anticall is now *${enable ? 'ENABLED' : 'DISABLED'}*.` }, { quoted: message });
}

module.exports = { anticallCommand, readState };


