const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// 1. قائمة الملفات المطلوب كسر الكاش لها مع مساراتها الدقيقة
const filesToBust = [
    'js/config.js',
    'js/ui.js',
    'js/auth.js',
    'js/transactions.js',
    'js/store.js',
    'js/chat.js'
];

// 2. تحديث index.html
const htmlPath = path.join(__dirname, 'index.html');

if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');

    filesToBust.forEach(filePath => {
        const fullPath = path.join(__dirname, filePath);
        if (fs.existsSync(fullPath)) {
            // حساب بصمة محتوى الملف الفعلي
            const content = fs.readFileSync(fullPath);
            const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);

            // استبدال الرابط سواء كان بدون لاحقة أو يحتوي على ?v= قديمة
            const escapedPath = filePath.replace(/[\/\\]/g, '[\\/\\\\]');
            const regex = new RegExp(`${escapedPath}(\\?v=[a-zA-Z0-9_-]+)?`, 'g');
            
            html = html.replace(regex, `${filePath}?v=${hash}`);
        } else {
            console.warn(`⚠️ لم يتم العثور على الملف: ${filePath}`);
        }
    });

    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log('✓ تم كسر الكاش وتحديث جميع مسارات js/ في index.html بنجاح.');
} else {
    console.error('❌ لم يتم العثور على ملف index.html في المجلد الرئيسي.');
}
