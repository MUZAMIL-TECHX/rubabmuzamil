const axios = require('axios');

const API_URL = process.env.LLAMA_API_URL ||
    'https://llama.gtech-apiz.workers.dev/';

function getApiKey() {
    return String(process.env.LLAMA_API_KEY || '').trim();
}

function extractText(body) {
    if (typeof body === 'string') return body;
    if (!body || typeof body !== 'object') return '';

    const candidates = [
        body.response,
        body.result,
        body.text,
        body.answer,
        body.reply,
        body.message,
        body.data,
        body.data?.response,
        body.data?.result,
        body.data?.text,
        body.data?.answer,
        body.data?.reply
    ];

    const value = candidates.find(item => item !== undefined && item !== null);
    return typeof value === 'string' ? value : value ? JSON.stringify(value) : '';
}

async function askLlama(text) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('LLAMA_API_KEY is not configured');
    }

    const response = await axios.get(API_URL, {
        params: {
            apikey: apiKey,
            text: String(text || '')
        },
        timeout: Number(process.env.LLAMA_TIMEOUT_MS || 20000),
        maxContentLength: 1024 * 1024
    });

    const result = extractText(response.data).trim();
    if (!result) {
        throw new Error('Llama API returned no response');
    }
    return result;
}

module.exports = {
    askLlama,
    API_URL
};