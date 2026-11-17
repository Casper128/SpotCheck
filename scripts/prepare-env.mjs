import fs from 'node:fs';
const filename = 'frontend/.env';
if (!fs.existsSync(filename)) fs.copyFileSync('frontend/.env.example', filename);
console.log('Frontend environment prepared. Configure the API and proxy public URLs before building.');
