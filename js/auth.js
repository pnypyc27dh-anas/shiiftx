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

// 1. الاستماع لتغير حالات جلسة الدخول
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
        document.getElementById('register-modal-title').innerText = "تعيين كلمة المرور الجديدة";
        toggleView('register-modal', true);
    } else if (event === 'SIGNED_IN') {
        if (isSettingNewPassword) return; // منع التحويل للرئيسية حتى ينتهي المستخدم من تعيين كلمة المرور
        if (currentFlowType !== 'reset') {
            const { data: prof } = await supabase
                .from('profiles')
                .select('status')
                .eq('id', session.user.id)
                .single();

            if (prof && (prof.status === 'inactive' || prof.status === 'محذوف' || prof.status === 'معطل')) {
                stopInactivityTracking();
                currentUser = session.user;
                toggleView('dashboard-screen', false);
                toggleView('login-screen', true);
                toggleView('reactivate-modal', true);
            } else if (prof && prof.status === 'banned') {
                stopInactivityTracking();
                await supabase.auth.signOut();
                currentUser = null;
                showCustomAlert("هذا الحساب محظور إدارياً. يرجى التواصل مع الإدارة.");
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

// 2. التحقق من الجلسة المخزنة عند فتح الصفحة لأول مرة
supabase.auth.getSession().then(async ({ data: { session } }) => {
    const isRecoveryHash = window.location.hash.includes('type=recovery');
    if (session && !isRecoveryHash) { 
        const { data: prof } = await supabase
            .from('profiles')
            .select('status')
            .eq('id', session.user.id)
            .single();

        if (prof && (prof.status === 'inactive' || prof.status === 'محذوف' || prof.status === 'معطل')) {
            currentUser = session.user;
            toggleView('dashboard-screen', false);
            toggleView('login-screen', true);
            toggleView('reactivate-modal', true);
        } else if (prof && prof.status === 'banned') {
            await supabase.auth.signOut();
            currentUser = null;
            toggleView('dashboard-screen', false);
            toggleView('login-screen', true);
        } else {
            currentUser = session.user; 
            postLoginSetup(); 
        }
    }
});

// 3. معالجة تسجيل الدخول اليدوي
async function handleLogin() { 
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn'); 

    if (!email || !pass) return showCustomAlert("يرجى إدخال البريد الإلكتروني وكلمة المرور."); 

    btn.disabled = true; 
    btn.innerHTML = `<span class="flex items-center justify-center gap-2">${BRAND_LOADER_SVG} <span>جاري التحقق...</span></span>`; 
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass }); 
    
    if (error) { 
        showCustomAlert("بيانات الدخول غير صحيحة."); 
        btn.disabled = false; 
        btn.innerHTML = `<span>تسجيل الدخول</span><i class="ph ph-sign-in text-lg"></i>`; 
        return;
    }

    const { data: prof } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', data.user.id)
        .single();

    btn.disabled = false; 
    btn.innerHTML = `<span>تسجيل الدخول</span><i class="ph ph-sign-in text-lg"></i>`;

    if (prof && prof.status === 'banned') {
        await supabase.auth.signOut();
        currentUser = null;
        return showCustomAlert("هذا الحساب محظور إدارياً. يرجى التواصل مع الإدارة.");
    }

    if (prof && (prof.status === 'inactive' || prof.status === 'محذوف' || prof.status === 'معطل')) {
        currentUser = data.user;
        toggleView('reactivate-modal', true);
        return;
    }

    currentUser = data.user; 
    postLoginSetup(); 
}

// 4. إعادة تنشيط الحساب المعطل
async function handleConfirmReactivate() {
    const btn = document.getElementById('confirm-reactivate-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> جاري إعادة التنشيط...`;

    const { data, error } = await supabase.rpc('reactivate_my_account');
    btn.disabled = false;
    btn.innerHTML = `<i class="ph-fill ph-check-circle text-lg"></i> <span>إعادة تفعيل الحساب ومتابعة الدخول</span>`;

    if (error || (data && data.status === 'error')) {
        return showCustomAlert("فشل تفعيل الحساب: " + (error?.message || data?.message));
    }

    toggleView('reactivate-modal', false);
    showCustomAlert("تمت إعادة تفعيل حسابك بنجاح! أهلاً بك مجدداً.", false);
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
    showCustomAlert("تم إلغاء الدخول، حسابك ما زال معطلاً.", false);
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
    // بدء مراقبة الخمول التلقائي فور الدخول للوحة التحكم
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

// 14. تعديل الملف الشخصي وتعطيل الحساب
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

async function triggerDeleteAccountFlow() { 
    showCustomPrompt("أدخل كلمة المرور لتأكيد تعطيل حسابك:", async function(pass) { 
        const { error: authError } = await supabase.auth.signInWithPassword({ 
            email: currentUser.email, 
            password: pass 
        });
        if (authError) return showCustomAlert("كلمة المرور غير صحيحة."); 
        
        const { data, error } = await supabase.rpc('deactivate_my_account'); 
        
        if (error || (data && data.status === 'error')) {
            return showCustomAlert("فشل تعطيل الحساب: " + (error?.message || data?.message));
        }

        showCustomAlert("تم تعطيل حسابك بنجاح. نراك قريباً!", false); 
        handleLogout(); 
    }); 
}
