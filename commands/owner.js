const { getSessionSettings } = require('../lib/session_data');

async function ownerCommand(sock, chatId) {
    const settings = getSessionSettings(sock);
    const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${settings.ownerName}
TEL;waid=${settings.ownerNumber}:${settings.ownerNumber}
END:VCARD
`;

    await sock.sendMessage(chatId, {
        contacts: { displayName: settings.ownerName, contacts: [{ vcard }] },
    });
}

module.exports = ownerCommand;
