const fs = require('fs');
const crypto = require('crypto');

// 1. الملفات المطلوب أتمتة كسر الكاش لها
const filesToBust = ['transactions.js', 'admin-app.js', 'store.js', 'auth.js'];

// 2. قراءة ملف index.html
let html = fs.readFileSync('index.html', 'utf8');

filesToBust.forEach(file => {
    if (fs.existsSync(file)) {
        // حساب الـ Hash بناءً على محتوى الملف الفعلي
        const content = fs.readFileSync(file);
        const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);

        // استبدال الرابط القديم بالرابط المزود بالـ Hash الجديد
        const regex = new RegExp(`${file}(\\?v=[a-zA-Z0-9_-]+)?`, 'g');
        html = html.replace(regex, `${file}?v=${hash}`);
    }
});

// 3. حفظ التعديل في index.html
fs.writeFileSync('index.html', html, 'utf8');
console.log('✓ تم كسر الكاش وتحديث الروابط في index.html بنجاح.');
