const fs = require('fs');
const { execSync } = require('child_process');

// 1. الحصول على الهاش من Vercel تلقائياً، أو من Git المحلي، أو طابع زمني كبديل آمن
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

// 2. استبدال أي قيمة تأتي بعد ?v= داخل ملف index.html أياً كان شكلها
const htmlPath = './index.html';
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // يطابق auth.js?v= متبوعة بأي نص أو رقم حتى علامة التنصيص
  html = html.replace(/(js\/auth\.js\?v=)[^"']+/g, `$1${commitHash}`);
  
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`[Cache-Bust] Successfully updated auth.js hash to: ${commitHash}`);
} else {
  console.error('[Cache-Bust] index.html not found!');
}
