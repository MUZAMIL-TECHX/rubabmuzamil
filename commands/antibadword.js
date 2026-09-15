const { handleAntiBadwordCommand } = require('../lib/antibadword');
const isAdminHelper = require('../lib/isAdmin');

async function antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```For Group Admins Only!```' }, { quoted: message });
            return;
        }

        // Extract match from message. Both spellings are supported:
        // .antibadword and .antibadword(s) / .antibadwording.
        const text = message.message?.conversation ||
                    message.message?.extendedTextMessage?.text || '';
        const parts = text.trim().split(/\s+/);
        let match = parts.slice(1).join(' ').toLowerCase();
        if (/^\.antibadwordingset$/i.test(parts[0])) {
            match = `set ${parts.slice(1).join(' ')}`.trim().toLowerCase();
        }

        await handleAntiBadwordCommand(sock, chatId, message, match);
    } catch (error) {
        console.error('Error in antibadword command:', error);
        await sock.sendMessage(chatId, { text: '*Error processing antibadword command*' }, { quoted: message });
    }
}

module.exports = antibadwordCommand; 