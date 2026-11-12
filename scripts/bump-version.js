// scripts/bump-version.js
// Автоматически увеличивает последнюю цифру версии (+1) во всех файлах Dev-репозитория.
// Запуск: npm run bump

const fs = require('fs');
const path = require('path');

const DEV_ROOT = path.resolve(__dirname, '..');
const DEV_WWW = path.join(DEV_ROOT, 'www');
const indexHtmlPath = path.join(DEV_WWW, 'index.html');

// 1. Читаем текущую версию из www/index.html (или package.json)
let currentVersion = null;
if (fs.existsSync(indexHtmlPath)) {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const match = html.match(/window\.APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (match) currentVersion = match[1];
}

if (!currentVersion) {
  const pkgPath = path.join(DEV_ROOT, 'package.json');
  if (fs.existsSync(pkgPath)) {
    currentVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  }
}

if (!currentVersion) {
  console.error('❌ Не удалось определить текущую версию.');
  process.exit(1);
}

// 2. Увеличиваем последнюю числовую часть на +1 (1.38.29 -> 1.38.30, 1.38 -> 1.39)
const parts = currentVersion.split('.');
const lastIdx = parts.length - 1;
const lastNum = parseInt(parts[lastIdx], 10);

if (isNaN(lastNum)) {
  console.error(`❌ Некорректный формат версии: ${currentVersion}`);
  process.exit(1);
}

parts[lastIdx] = String(lastNum + 1);
const nextVersion = parts.join('.');

console.log(`\n🔼 Обновление версии Dev: ${currentVersion} -> ${nextVersion}\n`);

// 3. Обновляем www/index.html и www/telemetry.js
['index.html', 'telemetry.js'].forEach(file => {
  const fp = path.join(DEV_WWW, file);
  if (!fs.existsSync(fp)) return;
  let content = fs.readFileSync(fp, 'utf8');
  content = content.replace(/window\.APP_VERSION\s*=\s*['"][^'"]+['"]/g, `window.APP_VERSION = '${nextVersion}'`);
  content = content.replace(/window\.APP_VERSION\s*\|\|\s*['"][^'"]+['"]/g, `window.APP_VERSION || '${nextVersion}'`);
  fs.writeFileSync(fp, content, 'utf8');
  console.log(`   ✔ www/${file}`);
});

// 4. Обновляем www/update_manifest.json (если нужно держать в синхроне с APP_VERSION)
const manifestPath = path.join(DEV_WWW, 'update_manifest.json');
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.version = nextVersion;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`   ✔ www/update_manifest.json`);
  } catch (e) {
    console.warn('   ⚠ Не удалось распарсить www/update_manifest.json');
  }
}

// 5. Обновляем package.json
const pkgPath = path.join(DEV_ROOT, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = nextVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`   ✔ package.json`);
}

console.log(`\n✅ Готово! Текущая версия Dev: v${nextVersion}\n`);