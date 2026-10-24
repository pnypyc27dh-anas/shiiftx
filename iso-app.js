// فحص ما إذا كان الجهاز يعمل بنظام iOS
function isIosDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

// فحص ما إذا كان التطبيق مفتوحاً كـ PWA مثبت أم من داخل المتصفح
function isAppInstalled() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

// تشغيل ظهور الشريط لمستخدمي Safari على آيفون فقط
function initIosInstallPrompt() {
  if (isIosDevice() && !isAppInstalled()) {
    const banner = document.getElementById('ios-install-banner');
    if (banner) {
      banner.style.display = 'flex';
    }
  }
}

// فتح النافذة المنبثقة
function openIosModal() {
  const modal = document.getElementById('ios-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

// إغلاق النافذة المنبثقة
function closeIosModal() {
  const modal = document.getElementById('ios-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// تنفيذ الفحص بمجرد اكتمال تجهيز الصفحة
document.addEventListener('DOMContentLoaded', initIosInstallPrompt);
