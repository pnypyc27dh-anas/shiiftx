let currentIosStep = 1;
const totalIosSteps = 3;

// 1. فحص أجهزة أبل (iOS)
function isIosDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTestIos = window.location.search.includes('test_install=ios');
  return (/iphone|ipad|ipod/.test(userAgent) && !window.MSStream) || isTestIos;
}

// 2. فحص أجهزة أندرويد (Android)
function isAndroidDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTestAndroid = window.location.search.includes('test_install=android');
  return /android/.test(userAgent) || isTestAndroid;
}

// 3. فحص ما إذا كان التطبيق مثبتاً ومفتوحاً كـ PWA
function isAppInstalled() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

// 4. توجيه ظهور الشريط المناسب حسب نظام الجهاز داخل شاشة تسجيل الدخول فقط
function checkBannerVisibility() {
  const loginScreen = document.getElementById('login-screen');
  const iosBanner = document.getElementById('ios-install-banner');
  const androidBanner = document.getElementById('android-download-banner');

  const isLoginVisible = loginScreen && !loginScreen.classList.contains('hidden');
  const canDisplay = isLoginVisible && !isAppInstalled();

  // إخفاء الزرين إذا كان المستخدم داخل لوحة التحكم أو التطبيق مثبت
  if (!canDisplay) {
    if (iosBanner) iosBanner.style.display = 'none';
    if (androidBanner) androidBanner.style.display = 'none';
    return;
  }

  // عرض زر آيفون لمستخدمي iOS فقط
  if (isIosDevice()) {
    if (iosBanner) iosBanner.style.display = 'flex';
    if (androidBanner) androidBanner.style.display = 'none';
  } 
  // عرض زر أندرويد لمستخدمي Android فقط
  else if (isAndroidDevice()) {
    if (androidBanner) androidBanner.style.display = 'flex';
    if (iosBanner) iosBanner.style.display = 'none';
  } 
  // إخفاء كليهما على متصفحات الكمبيوتر العادية (خارج وضع الفحص)
  else {
    if (iosBanner) iosBanner.style.display = 'none';
    if (androidBanner) androidBanner.style.display = 'none';
  }
}

// مراقبة الانتقال بين شاشة الدخول ولوحة التحكم
function setupScreenObserver() {
  const loginScreen = document.getElementById('login-screen');
  if (loginScreen) {
    const observer = new MutationObserver(() => {
      checkBannerVisibility();
    });
    observer.observe(loginScreen, { attributes: true, attributeFilter: ['class', 'style'] });
  }
}

// دوال التحكم بالنافذة المنبثقة التفاعلية لـ iOS
function openIosModal() {
  goToIosStep(1);
  const modal = document.getElementById('ios-modal');
  if (modal) modal.style.display = 'flex';
}

function closeIosModal(event) {
  if (event) event.stopPropagation();
  const modal = document.getElementById('ios-modal');
  if (modal) modal.style.display = 'none';
}

function goToIosStep(step) {
  currentIosStep = step;

  for (let i = 1; i <= totalIosSteps; i++) {
    const stepEl = document.getElementById(`ios-step-${i}`);
    const dotEl = document.getElementById(`step-dot-${i}`);
    if (stepEl) {
      if (i === currentIosStep) {
        stepEl.classList.add('active-step');
      } else {
        stepEl.classList.remove('active-step');
      }
    }
    if (dotEl) {
      if (i === currentIosStep) {
        dotEl.classList.add('active');
      } else {
        dotEl.classList.remove('active');
      }
    }
  }

  const badge = document.getElementById('wizard-step-counter');
  if (badge) badge.innerText = `خطوة ${currentIosStep} من ${totalIosSteps}`;

  const prevBtn = document.getElementById('wizard-prev-btn');
  const nextBtn = document.getElementById('wizard-next-btn');

  if (prevBtn) {
    prevBtn.style.display = currentIosStep === 1 ? 'none' : 'block';
  }

  if (nextBtn) {
    if (currentIosStep === totalIosSteps) {
      nextBtn.innerText = 'فهمت، إنهاء الدليل ✓';
    } else {
      nextBtn.innerText = 'التالي ❯';
    }
  }
}

function nextIosStep() {
  if (currentIosStep < totalIosSteps) {
    goToIosStep(currentIosStep + 1);
  } else {
    closeIosModal();
  }
}

function prevIosStep() {
  if (currentIosStep > 1) {
    goToIosStep(currentIosStep - 1);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  checkBannerVisibility();
  setupScreenObserver();
});
