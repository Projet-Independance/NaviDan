const fs = require('fs');
const path = require('path');

const srcMobile = path.join(__dirname, '..', 'src', 'mobile');
const distMobile = path.join(__dirname, '..', 'dist-mobile');
const assetsDir = path.join(__dirname, '..', 'assets');

if (!fs.existsSync(distMobile)) {
  fs.mkdirSync(distMobile, { recursive: true });
}

// Copy files from src/mobile to dist-mobile
const files = fs.readdirSync(srcMobile);
for (const file of files) {
  const srcFile = path.join(srcMobile, file);
  const destFile = path.join(distMobile, file);
  fs.copyFileSync(srcFile, destFile);
}

// Copy icon
if (fs.existsSync(path.join(assetsDir, 'icon.png'))) {
  fs.copyFileSync(path.join(assetsDir, 'icon.png'), path.join(distMobile, 'icon.png'));
}

console.log('✓ dist-mobile prêt pour Capacitor');

