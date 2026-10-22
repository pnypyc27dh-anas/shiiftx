const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// 1. جميع ملفات الـ HTML في المشروع
const htmlFiles = [
    'index.html',
    'marketing-partner.html',
    'admin.html',
    'agent.html'
];

// 2. جميع ملفات الجافاسكربت المطلوب كسر الكاش لها
const jsFiles = [
    'js/config.js',
    'js/ui.js',
    'js/auth.js',
    'js/transactions.js',
    'js/store.js',
    'js/chat.js',
    'js/partner-app.js',
    'js/admin-app.js',
    'js/agent-app.js',
    'js/theme.js'
];

// حساب الهاش لكل ملف JS موجود
const fileHashes = {};
jsFiles.forEach(fileRel => {
    const fullPath = path.join(__dirname, fileRel);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath);
        fileHashes[fileRel] = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
    }
});

// تحديث كافة صفحات HTML
htmlFiles.forEach(htmlFile => {
    const fullHtmlPath = path.join(__dirname, htmlFile);
    if (!fs.existsSync(fullHtmlPath)) return;

    let html = fs.readFileSync(fullHtmlPath, 'utf8');
    let modified = false;

    Object.keys(fileHashes).forEach(fileRel => {
        const hash = fileHashes[fileRel];
        const escapedPath = fileRel.replace(/[\/\]/g, '[\/\\]');
        const regex = new RegExp(`${escapedPath}(\\?v=[a-zA-Z0-9_-]+)?`, 'g');
        
        if (regex.test(html)) {
            html = html.replace(regex, `${fileRel}?v=${hash}`);
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(fullHtmlPath, html, 'utf8');
        console.log(`✓ تم تحديث كسر الكاش في: ${htmlFile}`);
    }
});

console.log('✓ تم الانتهاء من معالجة جميع صفحات التطبيق بنجاح.');
