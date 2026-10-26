// ========================================================================
// SHIIFT X — وحدة المصادقة وإدارة الحسابات (Auth Controller)
// ========================================================================

// ========================================================================
// نظام الأمان والحماية: إنهاء الجلسة التلقائي عند الخمول (Inactivity Timeout)
// ========================================================================
const INACTIVITY_LIMIT_MS = 5 * 60 * 1000; 
let inactivityTimer = null;
let isAutoLoggingOut = false;
const userActivityEvents = ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'];

function handleUserActivity() {
    if (isAutoLoggingOut) return;

    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }

    inactivityTimer = setTimeout(async () => {
        isAutoLoggingOut = true;
        console.warn("[Security] تم إنهاء الجلسة تلقائياً لعدم وجود نشاط.");

        try {
            await handleLogout();
        } catch (err) {
            console.error("[Security] خطأ أثناء تسجيل الخروج التلقائي:", err);
            await supabase.auth.signOut();
            currentUser = null;
            toggleView('dashboard-screen', false);
            toggleView('login-screen', true);
        } finally {
            showCustomAlert("تم تسجيل الخروج تلقائياً لعدم وجود نشاط حفاظاً على أمان حسابك.");
            isAutoLoggingOut = false;
        }
    }, INACTIVITY_LIMIT_MS);
}

function startInactivityTracking() {
    stopInactivityTracking();
    isAutoLoggingOut = false;
    userActivityEvents.forEach(evt => {
        window.addEventListener(evt, handleUserActivity, { passive: true });
    });
    handleUserActivity();
}

function stopInactivityTracking() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    userActivityEvents.forEach(evt => {
        window.removeEventListener(evt, handleUserActivity);
    });
}

// ========================================================================
// 1. الاستماع لتغير حالات جلسة الدخول
// ========================================================================
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
        stopInactivityTracking();
        currentFlowType = "reset";
        currentUser = session ? session.user : null;
        if (currentUser) {
            tempRegisterData = { email: currentUser.email };
        }
        closeAllModals();
        toggleView('dashboard-screen', false);
        toggleView('login-screen', true);
        
        toggleView('reg-extra-fields', false);
        toggleView('register-step-form', false);
        toggleView('register-step-otp', false);
        toggleView('register-step-password', true);
        const modalTitle = document.getElementById('register-modal-title');
        if (modalTitle) modalTitle.innerText = "تعيين كلمة المرور الجديدة";
        toggleView('register-modal', true);
    } else if (event === 'SIGNED_IN') {
        if (isSettingNewPassword) return;
        if (currentFlowType !== 'reset' && session?.user) {
            const { data: prof } = await supabase
                .from('profiles')
                .select('status, deletion_requested_at')
                .eq('id', session.user.id)
                .single();

            // 1. الحساب المحذوف نهائياً
            if (prof && (prof.status === 'deleted' || prof.status === 'محذوف')) {
                stopInactivityTracking();
                await supabase.auth.signOut();
                currentUser = null;
                toggleView('dashboard-screen', false);
                toggleView('login-screen', true);
                showCustomAlert("تم حذف هذا الحساب وبياناته نهائياً ولا يمكن استرجاعه.");
                return;
            }

            // 2. الحساب المحظور إدارياً
            if (prof && prof.status === 'banned') {
                stopInactivityTracking();
                await supabase.auth.signOut();
                currentUser = null;
                showCustomAlert("هذا الحساب محظور إدارياً. يرجى التواصل مع الإدارة.");
                return;
            }

            // 3. الحساب المعلق ضمن مهلة الـ 14 يوماً
            if (prof && (prof.status === 'inactive' || prof.status === 'معطل' || prof.deletion_requested_at)) {
                stopInactivityTracking();
                currentUser = session.user;
                updateReactivateNotice(prof);
                toggleView('dashboard-screen', false);
                toggleView('login-screen', true);
                toggleView('reactivate-modal', true);
            } else {
                currentUser = session.user;
                postLoginSetup();
            }
        }
    } else if (event === 'SIGNED_OUT') {
        stopInactivityTracking();
        currentUser = null;
    }
});

// ========================================================================
// 2. التحقق من الجلسة المخزنة عند فتح الصفحة لأول مرة
// ========================================================================
supabase.auth.getSession().then(async ({ data: { session } }) => {
    const isRecoveryHash = window.location.hash.includes('type=recovery');
    if (session && !isRecoveryHash) { 
        const { data: prof } = await supabase
            .from('profiles')
            .select('status, deletion_requested_at')
            .eq('id', session.user.id)
            .single();

        if (prof && (prof.status === 'deleted' || prof.status === 'محذوف')) {
            await supabase.auth.signOut();
            currentUser = null;
            toggleView('dashboard-screen', false);
            toggleView('login-screen', true);
            showCustomAlert("تم حذف هذا الحساب وبياناته نهائياً ولا يمكن استرجاعه.");
        } else if (prof && prof.status === 'banned') {
            await supabase.auth.signOut();
            currentUser = null;
            toggleView('dashboard-screen', false);
            toggleView('login-screen', true);
        } else if (prof && (prof.status === 'inactive' || prof.status === 'معطل' || prof.deletion_requested_at)) {
            currentUser = session.user;
            updateReactivateNotice(prof);
            toggleView('dashboard-screen', false);
            toggleView('login-screen', true);
            toggleView('reactivate-modal', true);
        } else {
            currentUser = session.user; 
            postLoginSetup(); 
        }
    }
});

// ========================================================================
// 3. معالجة تسجيل الدخول اليدوي
// ========================================================================
async function handleLogin() { 
    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');
    const btn = document.getElementById('login-btn'); 

    const email = emailEl ? emailEl.value.trim() : '';
    const pass = passEl ? passEl.value : '';

    if (!email || !pass) return showCustomAlert("يرجى إدخال البريد الإلكتروني وكلمة المرور."); 

    if (btn) {
        btn.disabled = true; 
        btn.innerHTML = `<span class="flex items-center justify-center gap-2">${typeof BRAND_LOADER_SVG !== 'undefined' ? BRAND_LOADER_SVG : '<i class="ph ph-spinner animate-spin"></i>'} <span>جاري التحقق...</span></span>`; 
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass }); 
    
    if (error) { 
        showCustomAlert("بيانات الدخول غير صحيحة."); 
        if (btn) {
            btn.disabled = false; 
            btn.innerHTML = `<span>تسجيل الدخول</span><i class="ph ph-sign-in text-lg"></i>`; 
        }
        return;
    }

    const { data: prof } = await supabase
        .from('profiles')
        .select('status, deletion_requested_at')
        .eq('id', data.user.id)
        .single();

    if (btn) {
        btn.disabled = false; 
        btn.innerHTML = `<span>تسجيل الدخول</span><i class="ph ph-sign-in text-lg"></i>`;
    }

    // 1. فحص الحساب المحذوف نهائياً
    if (prof && (prof.status === 'deleted' || prof.status === 'محذوف')) {
        await supabase.auth.signOut();
        currentUser = null;
        return showCustomAlert("تم حذف هذا الحساب وبياناته نهائياً ولا يمكن استرجاعه.");
    }

    // 2. فحص الحظر الإداري
    if (prof && prof.status === 'banned') {
        await supabase.auth.signOut();
        currentUser = null;
        return showCustomAlert("هذا الحساب محظور إدارياً. يرجى التواصل مع الإدارة.");
    }

    // 3. فحص مهلة الـ 14 يوماً
    if (prof && (prof.status === 'inactive' || prof.status === 'معطل' || prof.deletion_requested_at)) {
        currentUser = data.user;
        updateReactivateNotice(prof);
        toggleView('reactivate-modal', true);
        return;
    }

    currentUser = data.user; 
    postLoginSetup(); 
}

// إتاحة الدالة في النطاق العام للنافذة لمنع ReferenceError
window.handleLogin = handleLogin;

// دالة مساعدة لحساب الأيام المتبقية لمهلة الحذف وعرضها في نافذة التراجع
function updateReactivateNotice(prof) {
    const descElem = document.getElementById('reactivate-modal-desc');
    if (!descElem) return;

    if (prof && prof.deletion_requested_at) {
        const reqDate = new Date(prof.deletion_requested_at);
        const deadline = new Date(reqDate.getTime() + (14 * 24 * 60 * 60 * 1000));
        const diffMs = deadline - new Date();
        const remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        descElem.innerText = `حسابك مجدول للحذف النهائي، ومتبقي لديك (${remainingDays}) يوم للتراجع قبل المسح التام لكافة بياناتك. هل ترغب في إلغاء طلب الحذف واستعادة الحساب الآن؟`;
    } else {
        descElem.innerText = "لقد تقدمت سابقاً بطلب لحذف هذا الحساب أو تم تعطيله. هل ترغب في إعادة تنشيطه والدخول إلى محفظتك؟";
    }
}

// 4. إعادة تنشيط الحساب وإلغاء طلب الحذف
async function handleConfirmReactivate() {
    const btn = document.getElementById('confirm-reactivate-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> جاري إلغاء طلب الحذف...`;

    // استدعاء RPC الآمنة التي تعيد التنشيط وتصفر تاريخ الحذف داخلياً
    const { data, error } = await supabase.rpc('reactivate_my_account');

    btn.disabled = false;
    btn.innerHTML = `<i class="ph-fill ph-check-circle text-lg"></i> <span>إعادة تفعيل الحساب ومتابعة الدخول</span>`;

    if (error || (data && data.status === 'error')) {
        return showCustomAlert("فشل تفعيل الحساب: " + (error?.message || data?.message));
    }

    toggleView('reactivate-modal', false);
    showCustomAlert("تم إلغاء طلب الحذف واستعادة حسابك بنجاح! أهلاً بك مجدداً.", false);
    postLoginSetup();
}

async function handleCancelReactivate() {
    toggleView('reactivate-modal', false);
    await supabase.auth.signOut();
    currentUser = null;
    ['login-email', 'login-password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    showCustomAlert("تم إلغاء الدخول، يبقى حسابك معلقاً ومجدولاً للحذف.", false);
}

// 5. تهيئة الواجهة بعد نجاح الدخول
function postLoginSetup() {
    toggleView('login-screen', false); 
    toggleView('dashboard-screen', true);
    switchTab('home'); 
    if (typeof silentSyncData === 'function') silentSyncData(); 
    if (typeof fetchStoreProductsDirectly === 'function') fetchStoreProductsDirectly();
    if (!syncInterval && typeof silentSyncData === 'function') {
        syncInterval = setInterval(silentSyncData, 30000);
    }
    startInactivityTracking();
}

// 6. تسجيل الخروج
async function handleLogout() { 
    stopInactivityTracking();
    toggleSideMenu(false);
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; } 
    await supabase.auth.signOut(); 
    currentUser = null; 
    ['login-email', 'login-password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    }); 
    closeAllModals(); 
    toggleView('dashboard-screen', false); 
    toggleView('login-screen', true); 

    const adminLink = document.getElementById('nav-admin-link');
    if (adminLink) adminLink.classList.add('hidden');
    
    const agentsLink = document.getElementById('nav-agents-link');
    if (agentsLink) agentsLink.classList.add('hidden');
    
    const marketingPartnerLink = document.getElementById('nav-marketing-partner-link');
    if (marketingPartnerLink) marketingPartnerLink.classList.add('hidden');
}

// 7. إظهار وإخفاء كلمة المرور في الحقول
function togglePasswordVisibility(fieldId, btnEl) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    const isPass = field.type === 'password';
    field.type = isPass ? 'text' : 'password';
    const openIcon = btnEl.querySelector('.eye-open');
    const closedIcon = btnEl.querySelector('.eye-closed');
    if (openIcon) openIcon.classList.toggle('hidden', isPass);
    if (closedIcon) closedIcon.classList.toggle('hidden', !isPass);
}

// 8. مؤقت إعادة إرسال رمز التحقق
function resetResendButtonState() {
    if (resendTimer) clearInterval(resendTimer);
    const resendBtn = document.getElementById('resend-otp-btn');
    if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.innerText = "إعادة إرسال الرمز";
    }
}

function startResendCooldown() {
    const btn = document.getElementById('resend-otp-btn');
    if (!btn) return;
    let timeLeft = 60;
    btn.disabled = true;
    btn.innerText = `إعادة الإرسال خلال (${timeLeft}) ثانية`;

    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(resendTimer);
            btn.disabled = false;
            btn.innerText = "إعادة إرسال الرمز";
        } else {
            btn.innerText = `إعادة الإرسال خلال (${timeLeft}) ثانية`;
        }
    }, 1000);
}

// 9. فتح نوافذ التسجيل واستعادة كلمة المرور
function openRegisterModal() { 
    currentFlowType = "register"; 
    resetResendButtonState();
    toggleView('reg-extra-fields', true);
    toggleView('register-step-form', true); 
    toggleView('register-step-password', false); 
    toggleView('register-step-otp', false); 
    
    document.getElementById('register-modal-title').innerText = "فتح حساب جديد"; 
    document.getElementById('reg-submit-btn-text').innerText = "المتابعة";
    
    ['reg-first-name', 'reg-last-name', 'reg-email', 'reg-phone', 'reg-new-pin', 'reg-confirm-pin', 'reg-otp-code'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = "";
    }); 
    toggleView('register-modal', true); 
}

function triggerPasswordResetFlow() { 
    closeAllModals(); 
    currentFlowType = "reset"; 
    resetResendButtonState();
    toggleView('reg-extra-fields', false);
    toggleView('register-step-form', true); 
    toggleView('register-step-otp', false); 
    toggleView('register-step-password', false); 
    
    document.getElementById('register-modal-title').innerText = "استعادة كلمة المرور"; 
    document.getElementById('reg-submit-btn-text').innerText = "إرسال رمز التحقق";
    
    const emailInput = document.getElementById('reg-email');
    emailInput.value = (currentUser && currentUser.email) ? currentUser.email : "";
    
    toggleView('register-modal', true); 
}

function openForgotPasswordModal() { 
    triggerPasswordResetFlow(); 
}

// 10. إرسال طلب التسجيل أو استعادة كلمة المرور
async function submitRegistration() { 
    const email = document.getElementById('reg-email').value.trim();
    if (!email) return showCustomAlert("البريد الإلكتروني إلزامي."); 
    
    const btn = document.getElementById('reg-submit-btn');

    if (currentFlowType === "register") { 
        const fName = document.getElementById('reg-first-name').value.trim();
        const lName = document.getElementById('reg-last-name').value.trim();
        const phone = document.getElementById('reg-phone').value.trim(); 
        
        if (!fName || !lName || !phone) return showCustomAlert("يرجى ملء كافة الخانات."); 
        
        tempRegisterData = { firstName: fName, lastName: lName, email: email, phone: phone }; 
        
        btn.disabled = true;
        btn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> إرسال رمز التحقق...`;

        const tempPassword = "Temp#" + Math.random().toString(36).slice(-8) + "Aa1!";

        const { data: signUpData, error } = await supabase.auth.signUp({
            email: email,
            password: tempPassword,
            options: { 
                data: { 
                    first_name: fName, 
                    last_name: lName, 
                    phone: phone 
                } 
            }
        });

        btn.disabled = false;
        btn.innerHTML = `<span id="reg-submit-btn-text">المتابعة</span> <i class="ph ph-arrow-left"></i>`;

        if (error) return showCustomAlert(error.message);

        if (signUpData?.user && (!signUpData.user.identities || signUpData.user.identities.length === 0)) {
            toggleView('register-modal', false);
            document.getElementById('login-email').value = email;
            return showCustomAlert("هذا البريد مسجل مسبقاً. يرجى تسجيل الدخول.");
        }

        isSettingNewPassword = true;
        showCustomAlert("تم إرسال رمز التحقق إلى بريدك الإلكتروني.", false);
        toggleView('register-step-form', false); 
        toggleView('register-step-otp', true);
        document.getElementById('register-modal-title').innerText = "تأكيد الرمز";
        startResendCooldown();

    } else { 
        tempRegisterData = { email: email }; 
        btn.disabled = true;
        btn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> إرسال رمز التحقق...`;
        
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        btn.disabled = false;
        btn.innerHTML = `<span id="reg-submit-btn-text">إرسال رمز التحقق</span> <i class="ph ph-arrow-left"></i>`;
        
        showCustomAlert("إذا كان هذا البريد مسجلاً لدينا، فستصلك تعليمات الاستعادة.", false);
        toggleView('register-step-form', false); 
        toggleView('register-step-otp', true); 
        document.getElementById('register-modal-title').innerText = "تأكيد الرمز";
        startResendCooldown();
    } 
}

// 11. التحقق من كود الـ 6 أرقام (OTP)
async function verifyRegistrationOtp() { 
    const code = document.getElementById('reg-otp-code').value.trim();
    const btn = document.getElementById('otp-verify-btn'); 
    
    if (!code || code.length < 6) return showCustomAlert("أدخل الرمز كاملاً (6 أرقام)."); 
    
    btn.disabled = true; 
    btn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> جاري التحقق...`; 
    
    const { data, error } = await supabase.auth.verifyOtp({
        email: tempRegisterData.email, 
        token: code, 
        type: currentFlowType === "register" ? 'signup' : 'recovery'
    }); 
    
    btn.disabled = false; 
    btn.innerText = "تأكيد الرمز";

    if (error) { 
        return showCustomAlert("الرمز غير صحيح أو منتهي الصلاحية."); 
    } 
    
    showCustomAlert("تم تأكيد الرمز بنجاح! عيّن كلمة المرور الخاصة بك الآن.", false);
    
    toggleView('register-step-otp', false);
    document.getElementById('reg-new-pin').value = "";
    document.getElementById('reg-confirm-pin').value = "";
    document.getElementById('register-modal-title').innerText = "تعيين كلمة المرور";
    toggleView('register-step-password', true);

    const modalBox = document.querySelector('#register-modal > div');
    if (modalBox) {
        modalBox.classList.remove('slide-up-modal');
        void modalBox.offsetWidth;
        modalBox.classList.add('slide-up-modal');
    }

    setTimeout(() => {
        const passInput = document.getElementById('reg-new-pin');
        if (passInput) passInput.focus();
    }, 100);
}

// 12. تعيين كلمة المرور النهائية بعد التحقق
async function executeFinalAccountCreationOrReset() { 
    const password = document.getElementById('reg-new-pin').value;
    const cPassword = document.getElementById('reg-confirm-pin').value;
    const btn = document.getElementById('final-register-btn'); 
    
    if (password !== cPassword) return showCustomAlert("كلمات المرور غير متطابقة."); 
    if (password.length < 8) return showCustomAlert("الحد الأدنى لكلمة المرور 8 خانات."); 
    
    btn.disabled = true; 
    btn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> جاري الحفظ...`; 
    
    const { error } = await supabase.auth.updateUser({ password: password }); 
    
    btn.disabled = false; 
    btn.innerHTML = `<i class="ph-fill ph-check-circle text-lg"></i> تأكيد وحفظ`;

    if (error) return showCustomAlert("فشل تحديث كلمة المرور: " + error.message); 
    
    isSettingNewPassword = false;

    showCustomAlert("تم إنشاء وتأكيد الحساب بنجاح! سجّل دخولك بكلمتك الجديدة.", false);
    
    await supabase.auth.signOut();
    currentUser = null;
    toggleView('register-modal', false);
    document.getElementById('login-email').value = tempRegisterData.email;
    document.getElementById('login-password').value = "";
    switchTab('home');
    toggleView('dashboard-screen', false);
    toggleView('login-screen', true);
}

// 13. إعادة إرسال كود OTP
async function resendOtpCode() {
    const btn = document.getElementById('resend-otp-btn');
    if (!tempRegisterData || !tempRegisterData.email) {
        return showCustomAlert("حدث خطأ، يرجى إعادة المحاولة من البداية.");
    }

    btn.disabled = true;
    btn.innerText = "جاري الإرسال...";

    let error = null;

    if (currentFlowType === "register") {
        const res = await supabase.auth.signInWithOtp({
            email: tempRegisterData.email
        });
        error = res.error;
    } else {
        const res = await supabase.auth.resetPasswordForEmail(tempRegisterData.email);
        error = res.error;
    }

    if (error) {
        btn.disabled = false;
        btn.innerText = "إعادة إرسال الرمز";
        return showCustomAlert("فشل الإرسال: " + error.message);
    }

    showCustomAlert("تم إرسال رمز جديد إلى بريدك بنجاح!", false);
    document.getElementById('reg-otp-code').value = "";
    startResendCooldown();
}

// 14. تعديل الملف الشخصي
async function handleUpdateProfileView() { 
    const fName = document.getElementById('prof-first-name').value.trim();
    const lName = document.getElementById('prof-last-name').value.trim();
    const phone = document.getElementById('prof-phone').value.trim(); 
    if (!fName || !lName || !phone) return showCustomAlert("يجب تعبئة كافة الحقول."); 
    const { error } = await supabase.from('profiles').update({ first_name: fName, last_name: lName, phone: phone }).eq('id', currentUser.id);
    if (!error) { 
        showCustomAlert("تم تعديل البيانات بنجاح.", false); 
        if (typeof silentSyncData === 'function') silentSyncData(); 
        switchTab('home'); 
    } 
}

// ========================================================================
// وحدة إدارة تغيير كلمة المرور والتحقق عبر الرمز (OTP)
// ========================================================================

let otpCountdownTimer = null;
let currentOtpTargetEmail = '';

// 1. فتح نافذة تغيير كلمة المرور وتعبئة بريد الجلسة
async function openChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    const emailInput = document.getElementById('change-pwd-email-input');

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !session.user || !session.user.email) {
        showCustomAlert('يجب تسجيل الدخول أولاً لتغيير كلمة المرور.');
        return;
    }

    if (emailInput) {
        emailInput.value = session.user.email;
    }

    if (modal) {
        modal.classList.remove('hidden');
    }
}

// 2. إغلاق نافذة تغيير كلمة المرور
function closeChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.add('hidden');
}

// 3. إرسال رمز التحقق الأولي
window.handleSendChangePasswordOTP = async function(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById('change-pwd-email-input');
    const email = emailInput ? emailInput.value.trim() : ((typeof currentUser !== 'undefined' && currentUser?.email) || '');
    const btn = document.getElementById('send-change-otp-btn');

    if (!email) {
        return showCustomAlert('تعذر تحديد البريد الإلكتروني.');
    }

    window.currentOtpTargetEmail = email;

    if (btn) {
        btn.disabled = true;
        btn.innerText = 'جاري إرسال الرمز...';
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;

        showCustomAlert('تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح.', false);
        
        window.closeChangePasswordModal();
        if (typeof toggleSideMenu === 'function') toggleSideMenu(false);

        currentFlowType = "reset";
        tempRegisterData = { email: email };
        if (typeof resetResendButtonState === 'function') resetResendButtonState();
        
        const regModal = document.getElementById('register-modal');
        if (regModal) {
            regModal.classList.remove('hidden');
            regModal.style.display = 'flex';
            regModal.style.zIndex = '140';
        }

        const otpStep = document.getElementById('register-step-otp');
        if (otpStep) {
            otpStep.classList.remove('hidden');
            otpStep.style.display = 'block';
        }

        ['register-step-form', 'register-step-password', 'reg-extra-fields'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        });
        
        const regTitle = document.getElementById('register-modal-title');
        if (regTitle) regTitle.innerText = "تأكيد الرمز";

        const otpInput = document.getElementById('reg-otp-code');
        if (otpInput) {
            otpInput.value = "";
            setTimeout(() => otpInput.focus(), 150);
        }
        
        if (typeof startResendCooldown === 'function') startResendCooldown();
        if (typeof window.startOtpCountdown === 'function') window.startOtpCountdown(60);

    } catch (err) {
        const errMsg = err?.message || String(err);
        if (errMsg.includes('429') || errMsg.includes('security purposes') || errMsg.includes('rate limit')) {
            showCustomAlert('يرجى الانتظار لمدة دقيقة واحدة قبل طلب رمز جديد حفاظاً على الأمان.');
        } else {
            showCustomAlert('فشل الإرسال: ' + errMsg);
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph-bold ph-paper-plane-tilt"></i> <span>إرسال رمز التحقق</span>';
        }
    }
};

// 4. محرك العداد التنازلي لإعادة الإرسال
function startOtpCountdown(seconds = 60) {
    const btn = document.getElementById('resend-otp-btn');
    const timerDisplay = document.getElementById('resend-timer');
    const icon = document.getElementById('resend-icon');

    if (!btn || !timerDisplay) return;

    if (otpCountdownTimer) {
        clearInterval(otpCountdownTimer);
        otpCountdownTimer = null;
    }

    btn.disabled = true;
    timerDisplay.classList.remove('hidden');
    if (icon) icon.classList.remove('animate-spin');

    let remaining = seconds;
    timerDisplay.innerText = `(${remaining}s)`;

    otpCountdownTimer = setInterval(() => {
        remaining--;

        if (remaining > 0) {
            timerDisplay.innerText = `(${remaining}s)`;
        } else {
            clearInterval(otpCountdownTimer);
            otpCountdownTimer = null;
            btn.disabled = false;
            timerDisplay.classList.add('hidden');
        }
    }, 1000);
}

// 5. معالجة إعادة إرسال الرمز
async function handleResendChangePasswordOTP() {
    const btn = document.getElementById('resend-otp-btn');
    const icon = document.getElementById('resend-icon');

    if (!currentOtpTargetEmail) {
        showCustomAlert('تعذر العثور على البريد الإلكتروني للعملية.');
        return;
    }

    btn.disabled = true;
    if (icon) icon.classList.add('animate-spin');

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(currentOtpTargetEmail);
        if (error) throw error;

        showCustomAlert('تمت إعادة إرسال رمز التحقق بنجاح.', false);
        startOtpCountdown(60);

    } catch (err) {
        showCustomAlert('خطأ أثناء إعادة الإرسال: ' + (err.message || err));
        btn.disabled = false;
    } finally {
        if (icon) icon.classList.remove('animate-spin');
    }
}

// ========================================================================
// وحدة حذف الحساب عبر رمز التحقق بالبريد (OTP Deletion Controller)
// ========================================================================

let delOtpCountdownTimer = null;
let delActiveEmail = '';

// 1. فتح نافذة الحذف وتعبئة البريد المسجل
window.triggerDeleteAccountFlow = function() {
    const modal = document.getElementById('delete-account-otp-modal');
    const emailDisplay = document.getElementById('del-account-email-display');
    const step1 = document.getElementById('del-otp-step-1');
    const step2 = document.getElementById('del-otp-step-2');

    if (!modal) return;

    delActiveEmail = (typeof currentUser !== 'undefined' && currentUser?.email) 
        ? currentUser.email 
        : '';

    if (!delActiveEmail) {
        showCustomAlert("تعذر تحديد البريد الإلكتروني للحساب الحالي.");
        return;
    }

    if (emailDisplay) emailDisplay.value = delActiveEmail;
    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');

    if (typeof toggleSideMenu === 'function') toggleSideMenu(false);
    modal.classList.remove('hidden');
};

// 2. إغلاق النافذة وتنظيف المؤقت
window.closeDeleteAccountOTPModal = function() {
    const modal = document.getElementById('delete-account-otp-modal');
    if (modal) modal.classList.add('hidden');
    if (delOtpCountdownTimer) {
        clearInterval(delOtpCountdownTimer);
        delOtpCountdownTimer = null;
    }
};

// 3. إرسال رمز التحقق المكون من 6 أرقام إلى البريد
window.handleSendDeleteAccountOTP = async function() {
    const btn = document.getElementById('send-del-otp-btn');
    const step1 = document.getElementById('del-otp-step-1');
    const step2 = document.getElementById('del-otp-step-2');
    const codeInput = document.getElementById('del-otp-code-input');

    if (!delActiveEmail) {
        return showCustomAlert("البريد الإلكتروني غير متوفر.");
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> <span>جاري إرسال الرمز...</span>`;
    }

    try {
        const { error } = await supabase.auth.signInWithOtp({
            email: delActiveEmail,
            options: { shouldCreateUser: false }
        });

        if (error) throw error;

        showCustomAlert("تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح.", false);

        if (step1) step1.classList.add('hidden');
        if (step2) step2.classList.remove('hidden');

        if (codeInput) {
            codeInput.value = '';
            setTimeout(() => codeInput.focus(), 150);
        }

        startDeleteOtpCountdown(60);

    } catch (err) {
        const errMsg = err?.message || String(err);
        if (errMsg.includes('429') || errMsg.includes('security purposes') || errMsg.includes('rate limit')) {
            showCustomAlert("يرجى الانتظار لمدة دقيقة واحدة قبل طلب رمز جديد حفاظاً على الأمان.");
        } else {
            showCustomAlert("فشل إرسال رمز التحقق: " + errMsg);
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="ph-bold ph-paper-plane-tilt text-base"></i> <span>إرسال رمز التحقق للحذف</span>`;
        }
    }
};

// 4. مؤقت 60 ثانية لزر إعادة الإرسال
function startDeleteOtpCountdown(seconds = 60) {
    const btn = document.getElementById('del-resend-btn');
    const timerDisplay = document.getElementById('del-resend-timer');
    const icon = document.getElementById('del-resend-icon');

    if (!btn || !timerDisplay) return;

    if (delOtpCountdownTimer) {
        clearInterval(delOtpCountdownTimer);
        delOtpCountdownTimer = null;
    }

    btn.disabled = true;
    timerDisplay.classList.remove('hidden');
    if (icon) icon.classList.remove('animate-spin');

    let remaining = seconds;
    timerDisplay.innerText = `(${remaining}s)`;

    delOtpCountdownTimer = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            timerDisplay.innerText = `(${remaining}s)`;
        } else {
            clearInterval(delOtpCountdownTimer);
            delOtpCountdownTimer = null;
            btn.disabled = false;
            timerDisplay.classList.add('hidden');
        }
    }, 1000);
}

// 5. إعادة إرسال رمز التحقق
window.handleResendDeleteAccountOTP = async function() {
    const btn = document.getElementById('del-resend-btn');
    const icon = document.getElementById('del-resend-icon');

    if (!delActiveEmail) return;

    btn.disabled = true;
    if (icon) icon.classList.add('animate-spin');

    try {
        const { error } = await supabase.auth.signInWithOtp({
            email: delActiveEmail,
            options: { shouldCreateUser: false }
        });

        if (error) throw error;

        showCustomAlert("تمت إعادة إرسال رمز التحقق بنجاح.", false);
        const codeInput = document.getElementById('del-otp-code-input');
        if (codeInput) codeInput.value = '';
        startDeleteOtpCountdown(60);

    } catch (err) {
        showCustomAlert("فشل إعادة الإرسال: " + (err.message || err));
        btn.disabled = false;
    } finally {
        if (icon) icon.classList.remove('animate-spin');
    }
};

// 6. التحقق من الرمز وتنفيذ جدولة الحذف عبر دالة RPC الآمنة
window.handleVerifyAndDeleteAccount = async function() {
    const codeInput = document.getElementById('del-otp-code-input');
    const token = codeInput ? codeInput.value.trim() : '';
    const btn = document.getElementById('confirm-del-with-otp-btn');

    if (!token || token.length < 6) {
        return showCustomAlert("يرجى إدخال رمز التحقق كاملاً (6 أرقام).");
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> <span>جاري التحقق من الرمز...</span>`;
    }

    try {
        // التحقق من صحة رمز الـ OTP
        const { error: verifyError } = await supabase.auth.verifyOtp({
            email: delActiveEmail,
            token: token,
            type: 'email'
        });

        if (verifyError) {
            throw new Error("رمز التحقق غير صحيح أو منتهي الصلاحية.");
        }

        // تنفيذ طلب الحذف والتعطيل في خطوة واحدة آمنة عبر الخادم
        const { data: rpcData, error: rpcError } = await supabase.rpc('request_account_deletion');
        if (rpcError || (rpcData && rpcData.status === 'error')) {
            throw new Error(rpcError?.message || rpcData?.message || "فشل تسجيل طلب الحذف");
        }

        closeDeleteAccountOTPModal();
        showCustomAlert("تم تأكيد الرمز بنجاح وجدولة حذف الحساب. لديك مهلة 14 يوماً للتراجع.", false);

        // تسجيل الخروج تلقائياً بعد ثانية ونصف
        setTimeout(() => {
            handleLogout();
        }, 1500);

    } catch (err) {
        showCustomAlert(err.message || "حدث خطأ أثناء تأكيد العملية.");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="ph-bold ph-trash"></i> <span>تأكيد الحذف النهائي</span>`;
        }
    }
};

// ========================================================================
// وحدة إدارة تغيير كلمة المرور للمستخدم المسجل
// ========================================================================

let cpCountdownTimer = null;
let cpActiveEmail = '';

// 1. فتح النافذة وتهيئة المرحلة الأولى
window.openChangePasswordModal = async function() {
    const modal = document.getElementById('change-password-modal');
    const emailInput = document.getElementById('change-pwd-email-input');
    const reqForm = document.getElementById('cp-step-request-form');
    const verifyForm = document.getElementById('cp-step-verify-form');
    const subtitle = document.getElementById('cp-modal-subtitle');

    if (!modal) return;

    if (reqForm) reqForm.classList.remove('hidden');
    if (verifyForm) verifyForm.classList.add('hidden');
    if (subtitle) subtitle.innerText = "سيتم إرسال رمز أمان إلى بريدك المسجل";

    let userEmail = (typeof currentUser !== 'undefined' && currentUser?.email) ? currentUser.email : '';
    if (!userEmail && typeof supabase !== 'undefined') {
        const { data: { session } } = await supabase.auth.getSession();
        userEmail = session?.user?.email || '';
    }

    if (!userEmail) {
        showCustomAlert('يجب تسجيل الدخول أولاً لتغيير كلمة المرور.');
        return;
    }

    cpActiveEmail = userEmail;
    if (emailInput) emailInput.value = userEmail;

    if (typeof toggleSideMenu === 'function') toggleSideMenu(false);
    modal.classList.remove('hidden');
};

// 2. إغلاق النافذة وتنظيف المؤقت
window.closeChangePasswordModal = function() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.add('hidden');
    if (cpCountdownTimer) {
        clearInterval(cpCountdownTimer);
        cpCountdownTimer = null;
    }
};

// 3. إرسال رمز التحقق
window.handleSendChangePasswordOTP = async function(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('send-change-otp-btn');
    const reqForm = document.getElementById('cp-step-request-form');
    const verifyForm = document.getElementById('cp-step-verify-form');
    const subtitle = document.getElementById('cp-modal-subtitle');

    if (!cpActiveEmail) {
        return showCustomAlert('تعذر تحديد البريد الإلكتروني.');
    }

    if (btn) {
        btn.disabled = true;
        btn.innerText = 'جاري إرسال الرمز...';
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(cpActiveEmail);
        if (error) throw error;

        showCustomAlert('تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح.', false);

        if (reqForm) reqForm.classList.add('hidden');
        if (verifyForm) verifyForm.classList.remove('hidden');
        if (subtitle) subtitle.innerText = "أدخل رمز التحقق المكون من 6 أرقام";

        const otpInput = document.getElementById('cp-otp-code-input');
        if (otpInput) {
            otpInput.value = '';
            setTimeout(() => otpInput.focus(), 150);
        }

        startChangePasswordTimer(60);

    } catch (err) {
        const errMsg = err?.message || String(err);
        if (errMsg.includes('429') || errMsg.includes('security purposes') || errMsg.includes('rate limit')) {
            showCustomAlert('يرجى الانتظار لمدة دقيقة واحدة قبل طلب رمز جديد حفاظاً على الأمان.');
        } else {
            showCustomAlert('فشل الإرسال: ' + errMsg);
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph-bold ph-paper-plane-tilt"></i> <span>إرسال رمز التحقق</span>';
        }
    }
};

// 4. مؤقت إعادة الإرسال (60 ثانية)
function startChangePasswordTimer(seconds = 60) {
    const btn = document.getElementById('cp-resend-btn');
    const timerDisplay = document.getElementById('cp-resend-timer');
    const icon = document.getElementById('cp-resend-icon');

    if (!btn || !timerDisplay) return;

    if (cpCountdownTimer) {
        clearInterval(cpCountdownTimer);
        cpCountdownTimer = null;
    }

    btn.disabled = true;
    timerDisplay.classList.remove('hidden');
    if (icon) icon.classList.remove('animate-spin');

    let remaining = seconds;
    timerDisplay.innerText = `(${remaining}s)`;

    cpCountdownTimer = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            timerDisplay.innerText = `(${remaining}s)`;
        } else {
            clearInterval(cpCountdownTimer);
            cpCountdownTimer = null;
            btn.disabled = false;
            timerDisplay.classList.add('hidden');
        }
    }, 1000);
}

// 5. إعادة إرسال الرمز
window.handleResendChangePasswordOTP = async function() {
    const btn = document.getElementById('cp-resend-btn');
    const icon = document.getElementById('cp-resend-icon');

    if (!cpActiveEmail) {
        return showCustomAlert('تعذر العثور على البريد الإلكتروني.');
    }

    if (btn) btn.disabled = true;
    if (icon) icon.classList.add('animate-spin');

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(cpActiveEmail);
        if (error) throw error;

        showCustomAlert('تمت إعادة إرسال رمز جديد إلى بريدك بنجاح!', false);
        const otpInput = document.getElementById('cp-otp-code-input');
        if (otpInput) otpInput.value = '';
        startChangePasswordTimer(60);

    } catch (err) {
        showCustomAlert('فشل الإرسال: ' + (err.message || err));
        if (btn) btn.disabled = false;
    } finally {
        if (icon) icon.classList.remove('animate-spin');
    }
};

// 6. التحقق من الرمز فقط وتسليم المتابعة لنافذة كلمة المرور
window.handleVerifyChangePasswordOTP = async function(e) {
    if (e) e.preventDefault();
    const token = document.getElementById('cp-otp-code-input').value.trim();
    const btn = document.getElementById('cp-submit-otp-btn');

    if (!token || token.length < 6) {
        return showCustomAlert('يرجى إدخال رمز التحقق كاملاً (6 أرقام).');
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="ph ph-spinner animate-spin text-base"></i> جاري التحقق...`;
    }

    try {
        tempRegisterData = { email: cpActiveEmail };
        currentFlowType = "reset";

        const { error: verifyError } = await supabase.auth.verifyOtp({
            email: cpActiveEmail,
            token: token,
            type: 'recovery'
        });

        if (verifyError) {
            throw new Error('الرمز غير صحيح أو منتهي الصلاحية.');
        }

        window.closeChangePasswordModal();

    } catch (err) {
        showCustomAlert(err.message || 'حدث خطأ أثناء تأكيد الرمز.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span>تأكيد الرمز</span> <i class="ph-bold ph-arrow-left"></i>`;
        }
    }
};
