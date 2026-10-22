const fs = require('fs');
const { execSync } = require('child_process');

// 1. استخراج هاش الـ Commit الحالي من Vercel أو Git
let commitHash = process.env.VERCEL_GIT_COMMIT_SHA 
  ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8) 
  : '';

if (!commitHash) {
  try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim();
  } catch (err) {
    commitHash = Date.now().toString(36);
  }
}

// 2. استبدال الهاش لكافة ملفات الـ JS في مجلد js/ تلقائياً
const htmlPath = './index.html';
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');

  // هذا النمط يطابق أي ملف ينتهي بـ .js?v= داخل مجلد js/
  html = html.replace(/(js\/[a-zA-Z0-9_-]+\.js\?v=)[^"']+/g, `$1${commitHash}`);

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`[Cache-Bust] Successfully updated all JS files to version: ${commitHash}`);
} else {
  console.error('[Cache-Bust] index.html not found!');
}
