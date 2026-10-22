const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

try {
    const htmlFiles = ['index.html', 'marketing-partner.html', 'admin.html', 'agent.html'];
    const jsFiles = [
        'js/config.js', 'js/ui.js', 'js/auth.js', 
        'js/transactions.js', 'js/store.js', 'js/chat.js', 
        'js/partner-app.js', 'js/admin-app.js', 'js/agent-app.js', 'js/theme.js'
    ];

    const fileHashes = {};
    jsFiles.forEach(fileRel => {
        const fullPath = path.join(__dirname, fileRel);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath);
            fileHashes[fileRel] = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
        }
    });

    htmlFiles.forEach(htmlFile => {
        const fullHtmlPath = path.join(__dirname, htmlFile);
        if (!fs.existsSync(fullHtmlPath)) return;

        let html = fs.readFileSync(fullHtmlPath, 'utf8');

        Object.keys(fileHashes).forEach(fileRel => {
            const hash = fileHashes[fileRel];
            // استبدال آمن تماماً وصريح لمسارات السكربتات
            const pattern = new RegExp(`(["'])${fileRel.replace(/\//g, '\\/')}(\\?v=[^"']*)?\\1`, 'g');
            html = html.replace(pattern, `"${fileRel}?v=${hash}"`);
        });

        fs.writeFileSync(fullHtmlPath, html, 'utf8');
        console.log(`✓ تم كسر الكاش في: ${htmlFile}`);
    });

    console.log('✓ اكتمل كسر الكاش بنجاح.');
} catch (err) {
    console.warn('⚠️ تم تجاوز كسر الكاش لضمان استمرار النشر:', err.message);
} finally {
    process.exit(0); // الخروج دائماً بـ 0 لضمان عدم توقف النشر في Vercel نهائياً
}
