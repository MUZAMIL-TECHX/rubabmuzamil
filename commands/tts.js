const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

async function ttsCommand(sock, chatId, text, message, language = 'en') {
    if (!text) {
        await sock.sendMessage(chatId, { text: 'Please provide the text for TTS conversion.' });
        return;
    }

    const fileName = `tts-${Date.now()}.mp3`;
    const tempDir = path.join(__dirname, '..', 'temp');
    const filePath = path.join(tempDir, fileName);

    try {
        fs.mkdirSync(tempDir, { recursive: true });
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(language)}&q=${encodeURIComponent(text)}&total=1&idx=0&client=tw-ob`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!response.ok) throw new Error(`TTS request failed with ${response.status}`);
        fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
        await sock.sendMessage(chatId, {
            audio: { url: filePath },
            mimetype: 'audio/mpeg'
        }, { quoted: message });
    } catch (error) {
        await sock.sendMessage(chatId, { text: 'Error generating TTS audio.' });
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
}

module.exports = ttsCommand;
