const fs = require('fs');

function readJsonSafe(path, fallback) {
    try {
        const txt = fs.readFileSync(path, 'utf8');
        return JSON.parse(txt);
    } catch (_) {
        return fallback;
    }
}

const isOwnerOrSudo = require('../lib/isOwner');
const { readSessionJson, getSessionSettings } = require('../lib/session_data');

async function addReaction(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (error) {}
}

async function settingsCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '⚙️');

        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!message.key.fromMe && !isOwner) {
            await addReaction(sock, message, '⛔');
            await sock.sendMessage(chatId, { 
                text: 'Only bot owner can use this command!'
            }, { quoted: message });
            return;
        }

        const isGroup = chatId.endsWith('@g.us');
        const mode = readSessionJson(sock, 'messageCount.json', { isPublic: true });
        const autoStatus = readSessionJson(sock, 'autoStatus.json', { enabled: false });
        const autoread = readSessionJson(sock, 'autoread.json', { enabled: false });
        const autotyping = readSessionJson(sock, 'autotyping.json', { enabled: false });
        const pmblocker = readSessionJson(sock, 'pmblocker.json', { enabled: false });
        const anticall = readSessionJson(sock, 'anticall.json', { enabled: false });
        const userGroupData = readSessionJson(sock, 'userGroupData.json', {
            antilink: {}, antibadword: {}, welcome: {}, goodbye: {}, chatbot: {}, antitag: {}
        });
        const autoReaction = Boolean(userGroupData.autoReaction);

        const groupId = isGroup ? chatId : null;
        const antilinkOn = groupId ? Boolean(userGroupData.antilink && userGroupData.antilink[groupId]) : false;
        const antibadwordOn = groupId ? Boolean(userGroupData.antibadword && userGroupData.antibadword[groupId]) : false;
        const welcomeOn = groupId ? Boolean(userGroupData.welcome && userGroupData.welcome[groupId]) : false;
        const goodbyeOn = groupId ? Boolean(userGroupData.goodbye && userGroupData.goodbye[groupId]) : false;
        const chatbotOn = groupId ? Boolean(userGroupData.chatbot && userGroupData.chatbot[groupId]) : false;
        const antitagCfg = groupId ? (userGroupData.antitag && userGroupData.antitag[groupId]) : null;

        // Build settings message - MENU STYLE
        const sessionSettings = getSessionSettings(sock);
        let settingsMsg = `
╭━━━〔 ⚙️ *BOT SETTINGS* 〕━━━┈⊷
┃ ❍ Bot Name  : ${sessionSettings.botName}
┃ ❍ Owner     : ${sessionSettings.ownerName}
┃ ❍ Number    : ${sessionSettings.ownerNumber}
┃ ❍ Mode     : ${mode.isPublic ? 'Public' : 'Private'}
┃ ❍ Auto Status : ${autoStatus.enabled ? 'ON' : 'OFF'}
┃ ❍ Autoread    : ${autoread.enabled ? 'ON' : 'OFF'}
┃ ❍ Autotyping  : ${autotyping.enabled ? 'ON' : 'OFF'}
┃ ❍ PM Blocker  : ${pmblocker.enabled ? 'ON' : 'OFF'}
┃ ❍ Anticall    : ${anticall.enabled ? 'ON' : 'OFF'}
┃ ❍ Auto React  : ${autoReaction ? 'ON' : 'OFF'}
╰━━━━━━━━━━━━━━━━┈⊷`;

        if (groupId) {
            // Antilink
            let antilinkText = 'OFF';
            if (antilinkOn) {
                const al = userGroupData.antilink[groupId];
                antilinkText = `ON (${al.action || 'delete'})`;
            }

            // Antibadword
            let antibadwordText = 'OFF';
            if (antibadwordOn) {
                const ab = userGroupData.antibadword[groupId];
                antibadwordText = `ON (${ab.action || 'delete'})`;
            }

            // Antitag
            let antitagText = 'OFF';
            if (antitagCfg && antitagCfg.enabled) {
                antitagText = `ON (${antitagCfg.action || 'delete'})`;
            }

            settingsMsg += `

╭━━━〔 👥 *GROUP SETTINGS* 〕━━━┈⊷
┃ ❍ Antilink    : ${antilinkText}
┃ ❍ Antibadword : ${antibadwordText}
┃ ❍ Welcome     : ${welcomeOn ? 'ON' : 'OFF'}
┃ ❍ Goodbye     : ${goodbyeOn ? 'ON' : 'OFF'}
┃ ❍ Chatbot     : ${chatbotOn ? 'ON' : 'OFF'}
┃ ❍ Antitag     : ${antitagText}
╰━━━━━━━━━━━━━━━━┈⊷`;
        } else {
            settingsMsg += `

╭━━━〔 💡 *INFO* 〕━━━┈⊷
┃ ❍ Group settings will be shown
┃ ❍ when used inside a group.
╰━━━━━━━━━━━━━━━━┈⊷`;
        }

        settingsMsg += `

> 𝐂𝐑𝐄𝐀𝐓𝐄𝐑: Muzamil Khan`;

        await sock.sendMessage(chatId, { 
            text: settingsMsg
        }, { quoted: message });

        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Error in settings command:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, { 
            text: 'Failed to read settings.'
        }, { quoted: message });
    }
}

module.exports = settingsCommand;
