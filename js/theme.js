// ========================================================================
// SHIIFT X — وحدة المظهر العام (الوضع الليلي والنهاري)
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

    setTimeout(() => {
        const isDark = html.classList.toggle('dark');
        try {
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        } catch (_) {}
        
        updateThemeIcon(isDark);

        setTimeout(() => {
            if (icon) icon.classList.remove('theme-rotating');
        }, 200);
    }, 150);
}

// مزامنة الأيقونة فور تحميل السكريبت مع الـ DOM المتاح دون حظر
(function initThemeIcon() {
    const applyIcon = () => {
        const isDark = document.documentElement.classList.contains('dark');
        updateThemeIcon(isDark);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyIcon, { once: true, passive: true });
    } else {
        applyIcon();
    }
})();
