const fs = require('fs');
const path = require('path');

const sessionDirectory = path.resolve(
  process.env.SESSION_DIR || path.join(__dirname, 'session'),
);

fs.rmSync(sessionDirectory, { recursive: true, force: true });
fs.mkdirSync(sessionDirectory, { recursive: true });
console.log(`WhatsApp session cleared: ${sessionDirectory}`);