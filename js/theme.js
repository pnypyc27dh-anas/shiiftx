// ========================================================================
// SHIIFT X — وحدة المظهر العام (الوضع الليلي والنهاري) المحسنة
// ========================================================================

function updateThemeIcon(isDark) {
    const icon = document.getElementById('theme-toggle-icon');
    if (!icon) return;
    icon.className = isDark 
        ? "ph-fill ph-sun text-xl text-amber-400" 
        : "ph-fill ph-moon text-xl text-slate-700";
}

function toggleTheme() {
    const html = document.documentElement;
    const icon = document.getElementById('theme-toggle-icon');

    if (icon) icon.classList.add('theme-rotating');

    // قلب الوضع فوراً دون تأخير
    const isDark = html.classList.toggle('dark');
    try {
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch (_) {}
    
    updateThemeIcon(isDark);

    if (icon) {
        setTimeout(() => {
            icon.classList.remove('theme-rotating');
        }, 200);
    }
}

// استعادة الثيم المحفوظ ومزامنة الأيقونة فور جاهزية الـ DOM
(function initTheme() {
    const applyTheme = () => {
        try {
            const savedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

            document.documentElement.classList.toggle('dark', isDark);
            updateThemeIcon(isDark);
        } catch (_) {
            const isDark = document.documentElement.classList.contains('dark');
            updateThemeIcon(isDark);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyTheme, { once: true, passive: true });
    } else {
        applyTheme();
    }
})();
