const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { readSessionJson, getSessionSettings } = require('../lib/session_data');
const { getIndicatorConfig } = require('./indicator');

const ROOT_DATA_DIR = path.join(__dirname, '..', 'data');

// ===============================
// 🎯 CHANNEL INFO
// ===============================
const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363426106687970@newsletter',
            newsletterName: '𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋',
            serverMessageId: -1
        }
    }
};

// Helper function to add reaction
async function addReaction(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (_) {}
}

function onOff(value) {
    return value ? '🟢 ᴏɴ' : '🔴 ᴏꜰꜰ';
}

function readRootJson(fileName, fallback) {
    try {
        return JSON.parse(fs.readFileSync(path.join(ROOT_DATA_DIR, fileName), 'utf8'));
    } catch (_) {
        return fallback;
    }
}

async function settingsCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '⚙️');

        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        if (!message.key.fromMe && !isOwner) {
            await addReaction(sock, message, '⛔');
            await sock.sendMessage(chatId, {
                text: `╭┈──〔 ⛔ ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ 〕┈──⊷
┋⋄ ➠ 🔴 ᴏɴʟʏ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const isGroup = chatId.endsWith('@g.us');
        const sessionSettings = getSessionSettings(sock);
        const mode = readSessionJson(sock, 'messageCount.json', { isPublic: true });
        const antidelete = readSessionJson(sock, 'antidelete.json', { enabled: false });
        const antivv = readSessionJson(sock, 'antivv.json', { enabled: false });
        const antistatus = readSessionJson(sock, 'antistatus.json', { enabled: false, action: 'delete' });
        const autoStatus = readSessionJson(sock, 'autoStatus.json', { enabled: false, reactOn: false });
        const autoread = readSessionJson(sock, 'autoread.json', { enabled: false });
        const autotyping = readSessionJson(sock, 'autotyping.json', { enabled: false });
        const selfchat = readSessionJson(sock, 'selfchat.json', { enabled: false, mode: 'group' });
        const pmblocker = readSessionJson(sock, 'pmblocker.json', { enabled: false });
        const anticall = readSessionJson(sock, 'anticall.json', { enabled: false });
        const indicator = getIndicatorConfig(sock);
        const mention = readRootJson('mention.json', { enabled: false, type: 'text' });
        const autofollow = readRootJson('autofollow.json', []);
        const rootUserGroupData = readRootJson('userGroupData.json', { autoReaction: false });
        const userGroupData = readSessionJson(sock, 'userGroupData.json', {
            antilink: {}, antibadword: {}, welcome: {}, goodbye: {}, chatbot: {}, antitag: {},
            autoReaction: false
        });

        const groupId = isGroup ? chatId : null;
        const groupAntilink = groupId ? userGroupData.antilink?.[groupId] : null;
        const groupAntibadword = groupId ? userGroupData.antibadword?.[groupId] : null;
        const groupWelcome = groupId ? userGroupData.welcome?.[groupId] : null;
        const groupGoodbye = groupId ? userGroupData.goodbye?.[groupId] : null;
        const groupChatbot = groupId ? userGroupData.chatbot?.[groupId] : null;
        const groupAntitag = groupId ? userGroupData.antitag?.[groupId] : null;

        // ===============================
        // BUILD SETTINGS MESSAGE
        // ===============================
        let settingsMsg = `╭━━━━━━━━━━━━━━━━━━━━━╮
┃   ⚙️ sᴇᴛᴛɪɴɢs ᴘᴀɴᴇʟ
┃   𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋
╰━━━━━━━━━━━━━━━━━━━━━╯

╭┈──〔 📌 ᴘʀᴇꜰɪx ᴄᴏᴍᴍᴀɴᴅs 〕┈──⊷
┋⋄ ➠ .ʙᴏᴛᴅᴘ <ᴜʀʟ>
┋⋄ ➠ .ʙᴏᴛɴᴀᴍᴇ <ɴᴀᴍᴇ>
┋⋄ ➠ .ᴏᴡɴᴇʀɴᴜᴍʙᴇʀ <ɴᴜᴍʙᴇʀ>
┋⋄ ➠ .ᴏᴡɴᴇʀɴᴀᴍᴇ <ɴᴀᴍᴇ>
┋⋄ ➠ .ᴅᴇsᴄʀɪᴘᴛɪᴏɴ <ᴛᴇxᴛ>
┋⋄ ➠ .ᴍᴏᴅᴇ ᴘᴜʙʟɪᴄ/ᴘʀɪᴠᴀᴛᴇ
╰─────────────────────⊷

╭┈──〔 👤 ᴄᴜʀʀᴇɴᴛ sᴇssɪᴏɴ 〕┈──⊷
┋⋄ ➠ 🖼️ ʙᴏᴛ ᴅᴘ       : ${sessionSettings.botDp ? '✅ sᴇᴛ' : '❌ ᴅᴇꜰᴀᴜʟᴛ'}
┋⋄ ➠ 👑 ʙᴏᴛ ɴᴀᴍᴇ     : ${sessionSettings.botName}
┋⋄ ➠ 📞 ᴏᴡɴᴇʀ ɴᴜᴍʙᴇʀ : ${sessionSettings.ownerNumber}
┋⋄ ➠ 👤 ᴏᴡɴᴇʀ ɴᴀᴍᴇ   : ${sessionSettings.ownerName}
┋⋄ ➠ 🌍 ᴍᴏᴅᴇ         : ${mode.isPublic ? '🟢 ᴘᴜʙʟɪᴄ' : '🔴 ᴘʀɪᴠᴀᴛᴇ'}
╰─────────────────────⊷

╭┈──〔 ⚙️ ᴏᴡɴᴇʀ sᴇᴛᴛɪɴɢs 〕┈──⊷
┋⋄ ➠ .ᴀɴᴛɪᴅᴇʟᴇᴛᴇ  [${onOff(antidelete.enabled)}]
┋⋄ ➠ .ᴀɴᴛɪᴠᴠ      [${onOff(antivv.enabled)}]
┋⋄ ➠ .ᴀᴜᴛᴏsᴛᴀᴛᴜs  [${onOff(autoStatus.enabled)}]
┋⋄ ➠ .sᴛᴀᴛᴜs ʀᴇᴀᴄᴛ [${onOff(autoStatus.reactOn)}]
┋⋄ ➠ .ᴀᴜᴛᴏʀᴇᴀᴅ    [${onOff(autoread.enabled)}]
┋⋄ ➠ .ᴀᴜᴛᴏᴛʏᴘɪɴɢ  [${onOff(autotyping.enabled)}]
┋⋄ ➠ .ɪɴᴅɪᴄᴀᴛᴏʀ   [${onOff(indicator.enabled)}] (${indicator.mode})
┋⋄ ➠ .sᴇʟꜰᴄʜᴀᴛ    [${onOff(selfchat.enabled)}] (${selfchat.mode || 'group'})
┋⋄ ➠ .ᴀɴᴛɪᴄᴀʟʟ    [${onOff(anticall.enabled)}]
┋⋄ ➠ .ᴘᴍʙʟᴏᴄᴋᴇʀ  [${onOff(pmblocker.enabled)}]
┋⋄ ➠ .ᴀᴜᴛᴏʀᴇᴀᴄᴛ  [${onOff(rootUserGroupData.autoReaction)}]
┋⋄ ➠ .ᴍᴇɴᴛɪᴏɴ    [${onOff(mention.enabled)}]
┋⋄ ➠ .ᴀɴᴛɪsᴛᴀᴛᴜs [${onOff(antistatus.enabled)}] (${String(antistatus.action || 'delete').toUpperCase()})
╰─────────────────────⊷

╭┈──〔 🛠️ ᴛᴏᴏʟs 〕┈──⊷
┋⋄ ➠ .ᴄʜʀᴇᴀᴄᴛ <ᴇᴍᴏᴊɪ>
┋⋄ ➠ .ᴀᴅᴅsᴏs / .ᴅᴇʟsᴏs
┋⋄ ➠ .ᴀᴅᴅᴀᴜᴛᴏꜰᴏʟʟᴏᴡ <ᴄʜᴀɴɴᴇʟ>
┋⋄ ➠ .ʟɪsᴛᴀᴜᴛᴏꜰᴏʟʟᴏᴡ
┋⋄ ➠ .ɢᴄsᴛᴀᴛᴜs
┋⋄ ➠ .ᴄʟᴇᴀʀᴛᴍᴘ
┋⋄ ➠ .ᴄʟᴇᴀʀsᴇssɪᴏɴ
┋⋄ ➠ .sᴇᴛᴘᴘ
┋⋄ ➠ .sᴜᴅᴏ ᴀᴅᴅ/ᴅᴇʟ/ʟɪsᴛ
┋⋄ ➠ .ᴜᴘᴅᴀᴛᴇ
╰─────────────────────⊷`;

        if (groupId) {
            settingsMsg += `

╭┈──〔 👥 ɢʀᴏᴜᴘ sᴇᴛᴛɪɴɢs 〕┈──⊷
┋⋄ ➠ .ᴀɴᴛɪʟɪɴᴋ    : ${groupAntilink ? `🟢 ᴏɴ (${groupAntilink.action || 'delete'})` : '🔴 ᴏꜰꜰ'}
┋⋄ ➠ .ᴀɴᴛɪʙᴀᴅᴡᴏʀᴅ : ${groupAntibadword ? `🟢 ᴏɴ (${groupAntibadword.action || 'delete'})` : '🔴 ᴏꜰꜰ'}
┋⋄ ➠ .ᴀɴᴛɪᴛᴀɢ     : ${groupAntitag?.enabled ? `🟢 ᴏɴ (${groupAntitag.action || 'delete'})` : '🔴 ᴏꜰꜰ'}
┋⋄ ➠ .ᴡᴇʟᴄᴏᴍᴇ     : ${onOff(groupWelcome?.enabled ?? Boolean(groupWelcome))}
┋⋄ ➠ .ɢᴏᴏᴅʙʏᴇ     : ${onOff(groupGoodbye?.enabled ?? Boolean(groupGoodbye))}
┋⋄ ➠ .ᴄʜᴀᴛʙᴏᴛ     : ${onOff(groupChatbot?.enabled ?? Boolean(groupChatbot))}
╰─────────────────────⊷

╭┈──〔 📋 ɢʀᴏᴜᴘ ᴄᴏᴍᴍᴀɴᴅs 〕┈──⊷
┋⋄ ➠ .ᴀɴᴛɪʟɪɴᴋ ᴏɴ/ᴏꜰꜰ
┋⋄ ➠ .ᴀɴᴛɪʙᴀᴅᴡᴏʀᴅ ᴏɴ/ᴏꜰꜰ
┋⋄ ➠ .ᴀɴᴛɪᴛᴀɢ ᴏɴ/ᴏꜰꜰ
┋⋄ ➠ .ᴄʜᴀᴛʙᴏᴛ ᴏɴ/ᴏꜰꜰ
┋⋄ ➠ .ᴡᴇʟᴄᴏᴍᴇ ᴏɴ/ᴏꜰꜰ
┋⋄ ➠ .ɢᴏᴏᴅʙʏᴇ ᴏɴ/ᴏꜰꜰ
╰─────────────────────⊷`;
        }

        settingsMsg += `

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;

        await sock.sendMessage(chatId, { 
            text: settingsMsg,
            ...channelInfo
        }, { quoted: message });

        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Error in settings command:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `╭┈──〔 ❌ ᴇʀʀᴏʀ 〕┈──⊷
┋⋄ ➠ 🔴 ꜰᴀɪʟᴇᴅ ᴛᴏ ʀᴇᴀᴅ sᴇᴛᴛɪɴɢs
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = settingsCommand;