const axios = require('axios');

const API_URL = process.env.PROXABDULLAH_API_URL ||
    'https://apis-proxabdullah.zone.id/api/gemini';

function getApiKey() {
    return process.env.PROXABDULLAH_API_KEY ||
        process.env.GEMINI_API_KEY ||
        // Bundled fallback keeps the bot plug-and-play after hosting.
        'PROxABDULLAH';
}

async function askProxAbdullah(prompt) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('PROXABDULLAH_API_KEY is not configured');
    }

    const response = await axios.get(API_URL, {
        params: {
            prompt,
            apikey: apiKey
        },
        timeout: Number(process.env.PROXABDULLAH_TIMEOUT_MS || 20000),
        maxContentLength: 1024 * 1024
    });

    const body = response.data || {};
    const result = body.response ?? body.result ?? body.text ?? body.answer;
    if (result === undefined || result === null) {
        throw new Error('ProxAbdullah API returned no response');
    }

    return typeof result === 'string' ? result.trim() : JSON.stringify(result);
}

module.exports = {
    askProxAbdullah,
    API_URL
};