// حالة المرشد التفاعلي
let currentIosStep = 1;
const totalIosSteps = 3;

function isIosDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTestMode = window.location.search.includes('test_install=true');
  return /iphone|ipad|ipod/.test(userAgent) || isTestMode;
}

function isAppInstalled() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

// تشغيل ظهور الشريط فقط في شاشة الدخول
function initIosInstallPrompt() {
  const loginScreen = document.getElementById('login-screen');
  const isLoginVisible = loginScreen && !loginScreen.classList.contains('hidden');

  if (isIosDevice() && !isAppInstalled() && isLoginVisible) {
    const banner = document.getElementById('ios-install-banner');
    if (banner) banner.style.display = 'flex';
  }
}

// فتح وإغلاق النافذة
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

// التحكم بخطوات الدليل التفاعلي
function goToIosStep(step) {
  currentIosStep = step;

  // تحديث محتوى الخطوات
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

  // تحديث العداد
  const badge = document.getElementById('wizard-step-counter');
  if (badge) badge.innerText = `خطوة ${currentIosStep} من ${totalIosSteps}`;

  // تحديث زري السابق والتالي
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

// تشغيل الفحص الأولي
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIosInstallPrompt);
} else {
  initIosInstallPrompt();
}
