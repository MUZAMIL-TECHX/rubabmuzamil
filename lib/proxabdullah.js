// Backwards-compatible name for older imports; all text AI now uses the
// same configured Llama endpoint as .gpt, selfchat, chatbot, and moderation.
const { askLlama, API_URL } = require('./llama');

async function askProxAbdullah(prompt) {
    return askLlama(prompt);
}

module.exports = {
    askProxAbdullah,
    API_URL
};