// ========================================================================
// SHIIFT X — وحدة واجهة المستخدم (UI & Modals Controller)
// ========================================================================

// 1. التحكم بظهور وإخفاء العناصر
function toggleView(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !show);
}

// 2. إغلاق جميع النوافذ المنبثقة دفعة واحدة
function closeAllModals() {
    if (typeof resetResendButtonState === 'function') resetResendButtonState();
    [
        'register-modal',
        'plans-modal',
        'account-inputs-modal',
        'purchase-modal',
        'code-delivery-modal',
        'all-orders-modal',
        'support-modal',
        'info-modal',
        'reactivate-modal'
    ].forEach(id => toggleView(id, false));
}

// 3. القائمة الجانبية المنزلقة
function toggleSideMenu(open) {
    const overlay = document.getElementById('side-menu-overlay');
    const panel = document.getElementById('side-menu-panel');
    if (!overlay || !panel) return;

    if (open) {
        overlay.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('-translate-x-full'), 10);
    } else {
        panel.classList.add('-translate-x-full');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

// 4. التنقل بين التبويبات الرئيسية (الرئيسية، المتجر، الشحن، الحساب)
function switchTab(tab) {
    closeAllModals();
    toggleSideMenu(false);

    document.querySelectorAll('.data-view').forEach(v => v.classList.add('hidden'));
    const map = {
        'home': 'view-home',
        'store': 'view-store',
        'deposit': 'view-deposit',
        'profile': 'view-profile'
    };
    toggleView(map[tab], true);

    if (tab === 'store' && typeof renderMainCategoriesView === 'function') {
        renderMainCategoriesView();
    }

    const activeClass = "bg-[#005ba3] text-white shadow-md shadow-blue-500/25";
    const inactiveClass = "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70";
    const baseBtnClass = "min-h-[44px] h-[44px] w-auto md:w-full flex items-center justify-center md:justify-start px-3.5 md:px-2 rounded-full md:rounded-xl text-xs font-bold transition-all duration-200 active:scale-95";

    ['home', 'store', 'deposit'].forEach(t => {
        const btn = document.getElementById(`float-tab-${t}`);
        if (btn) {
            btn.className = `${baseBtnClass} ${t === tab ? activeClass : inactiveClass}`;
        }
    });
}

// 5. التنبيهات المخصصة السريعة (Toast Alerts)
function showCustomAlert(msg, isError = true) {
    let cleanMsg = (msg || "") + "";

    if (isError) {
        if (cleanMsg.includes("check_transaction_player_id_format")) {
            cleanMsg = "معرف الحساب (ID) غير صالح أو يحتوي على رموز غير مدعومة.";
        } else if (cleanMsg.includes("check_transaction_serial_code_format")) {
            cleanMsg = "حدث خطأ في معالجة كود البطاقة، يرجى التواصل مع الدعم الفني.";
        } else if (cleanMsg.includes("الرصيد غير كافٍ")) {
            cleanMsg = "رصيدك الحالي غير كافٍ لإتمام العملية. يرجى شحن المحفظة أولاً.";
        } else if (cleanMsg.includes("المنتج غير متوفر")) {
            cleanMsg = "هذا المنتج غير متوفر حالياً في المخزون.";
        } else if (cleanMsg.includes("User already registered") || cleanMsg.includes("already exists")) {
            cleanMsg = "هذا الحساب أو البريد مسجل مسبقاً، يرجى تسجيل الدخول بدلاً من ذلك.";
        } else if (cleanMsg.includes("Invalid login credentials")) {
            cleanMsg = "اسم المستخدم أو كلمة المرور غير صحيحة.";
        } else if (cleanMsg.includes("NetworkError") || cleanMsg.includes("Failed to fetch")) {
            cleanMsg = "تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت.";
        } else if (cleanMsg.includes("violates") || cleanMsg.includes("constraint") || cleanMsg.includes("syntax error")) {
            cleanMsg = "تعذر إكمال العملية بسبب خطأ في البيانات المدخلة، يرجى التحقق والمحاولة مجدداً.";
        }
    }

    const existingAlert = document.getElementById('custom-toast-alert');
    if (existingAlert) existingAlert.remove();

    const toast = document.createElement('div');
    toast.id = 'custom-toast-alert';
    toast.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
        isError 
            ? 'bg-rose-500 text-white shadow-rose-500/25' 
            : 'bg-emerald-600 text-white shadow-emerald-600/25'
    }`;

    toast.innerHTML = `
        <i class="ph-bold ${isError ? 'ph-warning-circle text-lg' : 'ph-check-circle text-lg'} shrink-0"></i>
        <span class="tracking-wide">${cleanMsg}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function closeCustomAlert() {
    toggleView('custom-alert', false);
}

// 6. نسخ النصوص إلى الحافظة
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => showCustomAlert("تم النسخ بنجاح!", false));
}

// 7. إظهار وإخفاء رقم البطاقة الرقمية
function toggleCardVisibility() {
    isCardVisible = !isCardVisible;
    document.getElementById('live-card-number').innerText = isCardVisible ? rawCardNumber : "•••• •••• •••• " + lastFourDigits;
    document.getElementById('card-eye-open').style.display = isCardVisible ? 'inline' : 'none';
    document.getElementById('card-eye-closed').style.display = isCardVisible ? 'none' : 'inline';
}

function resetCardVisibility() {
    isCardVisible = false;
    const cardEl = document.getElementById('live-card-number');
    if (cardEl) cardEl.innerText = "•••• •••• •••• " + lastFourDigits;
    const eyeOpen = document.getElementById('card-eye-open');
    if (eyeOpen) eyeOpen.style.display = 'none';
    const eyeClosed = document.getElementById('card-eye-closed');
    if (eyeClosed) eyeClosed.style.display = 'inline';
}

// 8. نافذة تأكيد كلمة المرور للإجراءات الحساسة
function showCustomPrompt(desc, callback) {
    document.getElementById('custom-prompt-desc').innerText = desc;
    document.getElementById('custom-prompt-input').value = "";
    toggleView('custom-prompt', true);
    
    document.getElementById('custom-prompt-confirm-btn').onclick = async () => {
        const val = document.getElementById('custom-prompt-input').value;
        toggleView('custom-prompt', false);
        if (val) await callback(val);
    };
}

function closeCustomPrompt() {
    toggleView('custom-prompt', false);
}

// 9. نوافذ المعلومات الموحدة (من نحن، الخصوصية، الشروط)
const INFO_CONTENT = {
    about: {
        title: "عن منصة SHIIFTX",
        icon: "ph-wallet",
        html: `
            <div class="space-y-3">
                <p class="font-medium"><strong>SHIIFTX</strong> هي منصتك الموثوقة للحصول على الاشتراكات الرقمية، بطاقات الألعاب، وتعبئة التطبيقات الترفيهية بأمان وسرعة فائقة.</p>
                <div class="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-2">
                    <h5 class="font-black text-[#005ba3] flex items-center gap-1.5"><i class="ph-fill ph-check-circle"></i> ميزات المنصة:</h5>
                    <ul class="list-disc list-inside space-y-1 text-slate-700">
                        <li>تسليم فوري ومباشر للأكواد الرقمية بعد الدفع.</li>
                        <li>دعم كامل لقنوات التحويل المحلية (Syriatel Cash, MTN, Cham).</li>
                        <li>لوحة تحكم وسجل شامل لمتابعة جميع فواتيرك وأكوادك بأي وقت.</li>
                        <li>فريق دعم فني متواجد لمساعدتك وحل أي مشكلة فوراً.</li>
                    </ul>
                </div>
            </div>
        `
    },
    privacy: {
        title: "سياسة الخصوصية وأمان البيانات",
        icon: "ph-shield-check",
        html: `
            <div class="space-y-3">
                <p class="font-medium">نحن في <strong>SHIIFTX</strong> نضع حماية بياناتك الشخصية والمالية على رأس أولوياتنا وفق البنود التالية:</p>
                <div class="border-r-2 border-blue-500 pr-3 space-y-1">
                    <h5 class="font-bold text-slate-800">1. البيانات التي نطلبها:</h5>
                    <p class="text-slate-500">نجمع فقط المعلومات الأساسية اللازمة لإنشاء الحساب ومعرف اللاعب (ID) لشحن ألعابك مباشرة.</p>
                </div>
                <div class="border-r-2 border-blue-500 pr-3 space-y-1">
                    <h5 class="font-bold text-slate-800">2. أمان كلمات المرور:</h5>
                    <p class="text-slate-500">كلمات المرور مشفرة كلياً عبر خوادم Supabase الآمنة.</p>
                </div>
            </div>
        `
    },
    terms: {
        title: "شروط وأحكام الاستخدام",
        icon: "ph-file-text",
        html: `
            <div class="space-y-3">
                <div class="border-r-2 border-blue-500 pr-3 space-y-1">
                    <h5 class="font-bold text-slate-800">1. دقة معرف اللاعب (Player ID):</h5>
                    <p class="text-slate-500">المستخدم مسؤول بالكامل عن صحة معرف الحساب المدخل عند الشحن المباشر.</p>
                </div>
                <div class="border-r-2 border-blue-500 pr-3 space-y-1">
                    <h5 class="font-bold text-slate-800">2. الأكواد الرقمية (Vouchers):</h5>
                    <p class="text-slate-500">تعتبر البطاقة الرقمية مستلمة بمجرد ظهورها على الشاشة وتسجيلها في سجلك.</p>
                </div>
            </div>
        `
    }
};

function openInfoModal(type) {
    const data = INFO_CONTENT[type];
    if (!data) return;
    toggleSideMenu(false);
    document.getElementById('info-modal-title').innerText = data.title;
    document.getElementById('info-modal-icon').innerHTML = `<i class="ph ${data.icon} text-xl"></i>`;
    document.getElementById('info-modal-content').innerHTML = data.html;
    toggleView('info-modal', true);
}

function openSupportModal() {
    toggleSideMenu(false);
    toggleView('support-modal', true);
}

async function sharePlatform() {
    toggleSideMenu(false);
    const shareData = {
        title: 'SHIIFTX - المحفظة الرقمية ومتجر الاشتراكات',
        text: 'اشحن رصيدك واشترِ بطاقات الألعاب والاشتراكات الرقمية فوراً عبر SHIIFTX.',
        url: window.location.href
    };
    if (navigator.share) {
        try { await navigator.share(shareData); } catch (e) {}
    } else {
        navigator.clipboard.writeText(window.location.href);
        showCustomAlert("تم نسخ رابط المنصة للمشاركة!", false);
    }
}
