const fs = require('fs');
const path = require('path');

const appRoot = __dirname;
for (const directory of ['tmp', 'temp']) {
  const target = path.join(appRoot, directory);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
}

console.log('Temporary files cleaned.');