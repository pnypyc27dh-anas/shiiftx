// ========================================================================
// SHIIFT X — وحدة المظهر العام (الوضع الليلي والنهاري)
// ========================================================================

function toggleTheme() {
    const html = document.documentElement;
    const icon = document.getElementById('theme-toggle-icon');

    if (icon) icon.classList.add('theme-rotating');

    setTimeout(() => {
        const isDark = html.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcon(isDark);

        setTimeout(() => {
            if (icon) icon.classList.remove('theme-rotating');
        }, 200);
    }, 150);
}

function updateThemeIcon(isDark) {
    const icon = document.getElementById('theme-toggle-icon');
    if (!icon) return;
    if (isDark) {
        icon.className = "ph-fill ph-sun text-xl text-amber-400";
    } else {
        icon.className = "ph-fill ph-moon text-xl text-slate-700";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const isDark = document.documentElement.classList.contains('dark');
    updateThemeIcon(isDark);
});
