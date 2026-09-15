const settings = {
  packname: 'MUZAMIL-XD',
  author: 'Muzamil Khan',
  botName: "MUZAMIL-XD",
  botOwner: 'Muzamil Khan', // Your name
  ownerNumber: process.env.OWNER_NUMBER || '923433740855', // Country code + number, without + or spaces
  giphyApiKey: process.env.GIPHY_API_KEY || '',
  commandMode: "public",
  maxStoreMessages: 20, 
  storeWriteInterval: 10000,
  description: "This is a bot for managing group commands and automating tasks.",
  version: "3.0.7",
  updateZipUrl: "https://github.com/MUZAMIL-TECHX/muzamil/archive/refs/heads/main.zip",
};

module.exports = settings;
