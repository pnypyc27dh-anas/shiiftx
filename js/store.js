// ========================================================================
// SHIIFT X — وحدة المتجر والشراء والتمويل (Store & Checkout Controller)
// ========================================================================

// متغيرات التحكم في الحالة (State Variables)
let globalProductsRaw = [];
let selectedProductId = null;
let selectedItemName = "";
let selectedItemPrice = 0;
let selectedProductType = "CODE"; // CODE أو ID
let inputPlayerId = "";
let inputPlayerIdConfirm = "";
let activeCoupon = null;
let discountedPrice = 0;
let currentUser = null;
let currentUserRole = "customer";

// 0. دالة مساعدة لضمان جلب المستخدم والملف الشخصي مهما كانت رتبته
async function ensureAuthenticatedUser() {
    if (currentUser && currentUser.id) {
        return currentUser;
    }

    try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            currentUser = null;
            currentUserRole = "customer";
            return null;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, balance, first_name, last_name')
            .eq('id', user.id)
            .maybeSingle();

        currentUser = {
            ...user,
            ...(profile || {})
        };
        currentUserRole = profile?.role || 'customer';
        return currentUser;
    } catch (e) {
        console.error("Error ensuring auth user:", e);
        return null;
    }
}

// 1. جلب المنتجات النشطة من قاعدة البيانات مباشرة
async function fetchStoreProductsDirectly() { 
    const { data: prods, error } = await supabase
        .from('products')
        .select('*')
        .in('status', ['active', 'نشط']);

    if (error) {
        console.error("Error fetching products:", error);
        return;
    }

    if (prods) {
        globalProductsRaw = prods.map(p => ({
            id: p.id, 
            category: p.category, 
            platform: p.platform, 
            package_name: p.package_name, 
            price: parseFloat(p.price), 
            type: p.product_type, 
            image_url: p.image_url
        }));

        const storeView = document.getElementById('view-store');
        if (storeView && !storeView.classList.contains('hidden')) {
            renderMainCategoriesView();
        }
    }
}

// 2. عرض مجموعات وتصنيفات المتجر الرئيسية
function renderMainCategoriesView() {
    const titleText = document.getElementById('store-title-text');
    if (titleText) titleText.innerHTML = `متجر المجموعات الرقمية`;
    
    const backBtn = document.getElementById('store-nested-back-btn');
    if (backBtn) backBtn.classList.add('hidden');

    const innerGrid = document.getElementById('store-interactive-box'); 
    if (!innerGrid) return;
    innerGrid.innerHTML = `<div id="dash-categories-container" class="grid grid-cols-2 gap-4"></div>`;
    
    const categories = [...new Set(globalProductsRaw.map(p => p.category))];
    const container = document.getElementById('dash-categories-container');

    categories.forEach(cat => {
        const div = document.createElement('div'); 
        div.className = "glass-panel flex flex-col items-center justify-center gap-3 h-32 cursor-pointer font-black text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/80 hover:border-blue-500/50 transition";
        div.innerHTML = `<span>${cat}</span>`; 
        div.onclick = () => renderNestedPlatformsView(cat); 
        container.appendChild(div);
    });
}

// 3. عرض المنصات التابعة لتصنيف محدد
function renderNestedPlatformsView(categoryName) {
    const titleText = document.getElementById('store-title-text');
    if (titleText) titleText.innerHTML = `منصات: ${categoryName}`;
    
    const backBtn = document.getElementById('store-nested-back-btn');
    if (backBtn) backBtn.classList.remove('hidden');

    const innerList = document.getElementById('store-interactive-box');
    if (!innerList) return;
    innerList.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right"></div>`;
    
    const platforms = [...new Set(globalProductsRaw.filter(p => p.category === categoryName).map(p => p.platform))];
    const container = innerList.querySelector('div');

    platforms.forEach(pName => {
        const platformItem = globalProductsRaw.find(p => p.category === categoryName && p.platform === pName);
        const iconUrl = platformItem && platformItem.image_url ? platformItem.image_url : '';

        const div = document.createElement('div');
        div.className = "card-lift bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex justify-between items-center cursor-pointer shadow-sm";
        div.onclick = () => openPlansModal(pName, categoryName);
        
        div.innerHTML = `
            <div class="flex items-center gap-3.5">
                ${iconUrl ? `<img src="${iconUrl}" alt="${pName}" referrerpolicy="no-referrer" class="w-12 h-12 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/10 p-1.5 shadow-sm">` : `<div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base">${pName[0]}</div>`}
                <div>
                    <span class="font-black text-sm text-slate-800 dark:text-slate-100 block">${pName}</span>
                    <span class="text-[10px] text-slate-400 font-bold">باقات وشحن فوري</span>
                </div>
            </div>
            <span class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm transition"><i class="ph ph-caret-left font-bold"></i></span>
        `;
        container.appendChild(div);
    });
}

// 4. فتح نافذة الباقات للمنصة المختارة
function openPlansModal(platformName, categoryName) { 
    document.getElementById('plans-modal-title').innerText = `باقات منصة ${platformName}`; 
    const container = document.getElementById('plans-container'); 
    container.innerHTML = ""; 
    
    const plans = globalProductsRaw.filter(p => p.category === categoryName && p.platform === platformName); 
    
    plans.forEach(plan => { 
        const isCode = (plan.type || '').trim().toUpperCase() === 'CODE';
        const card = document.createElement('div'); 
        card.className = "card-lift bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-[22px] flex justify-between items-center gap-3 text-right shadow-sm"; 
        
        const badgeHtml = isCode 
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"><i class="ph-fill ph-lightning"></i> كود فوري</span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"><i class="ph-fill ph-user-circle"></i> شحن بالمعرف</span>`;

        card.innerHTML = `
            <div class="flex items-center gap-3.5">
                ${plan.image_url ? `<img src="${plan.image_url}" alt="${plan.package_name}" referrerpolicy="no-referrer" class="w-12 h-12 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/10 p-1 shrink-0 shadow-inner">` : ''}
                <div class="flex flex-col gap-1">
                    <span class="text-xs font-black text-slate-800 dark:text-slate-100 leading-snug">${plan.package_name}</span>
                    <div>${badgeHtml}</div> </div> </div> <div class="flex flex-col items-end gap-1.5 shrink-0"> <span class="text-base font-black text-blue-600 dark:text-blue-400 tabular-numeric financial-amount">$${plan.price.toFixed(2)}</span>
                <button onclick="openAccountInputsModal('${plan.id}', '${plan.package_name}', ${plan.price}, '${plan.type}')" class="btn-primary text-white text-[11px] font-bold px-4 py-2 rounded-xl transition shadow-sm active:scale-95">شراء</button>
            </div>
        `; 
        container.appendChild(card); 
    }); 
    toggleView('plans-modal', true); 
}

// 5. فتح نافذة إدخال المعرف (ID) أو إشعار الكود
function openAccountInputsModal(productId, fullName, price, productType) { 
    selectedProductId = productId; 
    selectedItemName = fullName; 
    selectedItemPrice = price; 
    selectedProductType = (productType || 'CODE').trim().toUpperCase();
    
    document.getElementById('target-player-id').value = "";
    document.getElementById('target-player-id-confirm').value = "";
    
    const isIdFlow = selectedProductType === "ID"; 
    
    toggleView('id-fields-container', isIdFlow); 
    toggleView('code-fields-notice', !isIdFlow); 
    toggleView('account-inputs-modal', true); 
} 

// 6. المتابعة إلى شاشة مراجعة الفاتورة النهائية
function proceedToReview() { 
    const isIdFlow = selectedProductType === "ID";

    if (isIdFlow) { 
        inputPlayerId = document.getElementById('target-player-id').value.trim(); 
        inputPlayerIdConfirm = document.getElementById('target-player-id-confirm').value.trim(); 
        
        if (!inputPlayerId || inputPlayerId !== inputPlayerIdConfirm) {
            return showCustomAlert("معرف الحساب غير متطابق أو فارغ."); 
        }

        document.getElementById('review-item-player-id').innerText = inputPlayerId; 
        document.getElementById('review-item-delivery-type').innerText = `شحن مباشر`; 
        toggleView('review-id-row', true);
    } else { 
        inputPlayerId = "";
        inputPlayerIdConfirm = "";
        toggleView('review-id-row', false); 
        document.getElementById('review-item-delivery-type').innerText = `تسليم الكود فوراً`; 
    } 
    
    // تصفير بيانات الكوبون عند كل فتح جديد
    activeCoupon = null;
    discountedPrice = selectedItemPrice;
    const cInput = document.getElementById('coupon-code-input'); if (cInput) cInput.value = "";
    const cMsg = document.getElementById('coupon-status-msg'); if (cMsg) { cMsg.className = "text-[10px] mt-1.5 hidden font-bold"; cMsg.innerText = ""; }
    const dRow = document.getElementById('discount-breakdown-row'); if (dRow) { dRow.classList.add('hidden'); dRow.classList.remove('flex'); }

    toggleView('account-inputs-modal', false); 
    document.getElementById('review-item-name').innerText = selectedItemName; 
    document.getElementById('review-item-price').innerText = "$" + selectedItemPrice.toFixed(2); 
    toggleView('purchase-modal', true); 
}

// 7. تطبيق وفحص كود الخصم الترويجي (مع منع الوكلاء والشركاء)
async function applyCouponCode() {
    await ensureAuthenticatedUser();

    const input = document.getElementById('coupon-code-input');
    const statusMsg = document.getElementById('coupon-status-msg');
    const btn = document.getElementById('apply-coupon-btn');
    const code = input ? input.value.trim().toUpperCase() : '';

    // منع حسابات الشركاء والوكلاء الماليين من استخدام الكوبونات نهائياً
    if (currentUserRole === 'agent' || currentUserRole === 'marketing_partner') {
        const discountRow = document.getElementById('discount-breakdown-row');
        if (discountRow) {
            discountRow.classList.add('hidden');
            discountRow.classList.remove('flex');
        }
        document.getElementById('review-item-price').innerText = "$" + selectedItemPrice.toFixed(2);
        
        if (statusMsg) {
            statusMsg.classList.remove('hidden');
            statusMsg.className = "text-[10px] mt-1.5 text-rose-500 font-bold block";
            statusMsg.innerText = "✕ حسابات الشركاء والوكلاء غير مخولة باستخدام أي كود خصم.";
        }
        return;
    }

    if (!code) {
        activeCoupon = null;
        discountedPrice = selectedItemPrice;
        const discountRow = document.getElementById('discount-breakdown-row');
        if (discountRow) {
            discountRow.classList.add('hidden');
            discountRow.classList.remove('flex');
        }
        document.getElementById('review-item-price').innerText = "$" + selectedItemPrice.toFixed(2);
        if (statusMsg) statusMsg.classList.add('hidden');
        return;
    }

    btn.disabled = true;
    btn.innerText = "...";

    try {
        const { data: coupon, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code)
            .eq('is_active', true)
            .single();

        if (error || !coupon) {
            activeCoupon = null;
            discountedPrice = selectedItemPrice;
            const discountRow = document.getElementById('discount-breakdown-row');
            if (discountRow) {
                discountRow.classList.add('hidden');
                discountRow.classList.remove('flex');
            }
            document.getElementById('review-item-price').innerText = "$" + selectedItemPrice.toFixed(2);
            
            if (statusMsg) {
                statusMsg.classList.remove('hidden');
                statusMsg.className = "text-[10px] mt-1.5 text-rose-500 font-bold block";
                statusMsg.innerText = "✕ رمز القسيمة غير صالح أو منتهي الصلاحية.";
            }
        } else {
            activeCoupon = coupon;
            const discountAmt = (selectedItemPrice * (coupon.discount_percent / 100.0));
            discountedPrice = Math.max(0, selectedItemPrice - discountAmt);

            document.getElementById('discount-label-text').innerText = `خصم القسيمة (${coupon.discount_percent}%):`;
            document.getElementById('discount-val-text').innerText = `-$${discountAmt.toFixed(2)}`;
            
            const discountRow = document.getElementById('discount-breakdown-row');
            if (discountRow) {
                discountRow.classList.remove('hidden');
                discountRow.classList.add('flex');
            }
            document.getElementById('review-item-price').innerText = "$" + discountedPrice.toFixed(2);

            if (statusMsg) {
                statusMsg.classList.remove('hidden');
                statusMsg.className = "text-[10px] mt-1.5 text-emerald-600 dark:text-emerald-400 font-bold block";
                statusMsg.innerText = `✓ تم تطبيق الخصم بنجاح! وفرت $${discountAmt.toFixed(2)}`;
            }
        }
    } catch (err) {
        console.error("Coupon check error:", err);
    } finally {
        btn.disabled = false;
        btn.innerText = "تطبيق";
    }
}

// 8. تنفيذ عملية الدفع والشراء الذرية لكافة أنواع الباقات
async function executeSubscriptionPurchase() {
    const buyBtn = document.querySelector('#purchase-modal button[onclick*="executeSubscriptionPurchase"]');
    if (buyBtn) {
        buyBtn.disabled = true;
        buyBtn.innerText = "جاري تنفيذ الطلب...";
    }

    try {
        // 1. التحقق الآمن والمباشر من المستخدم
        const user = await ensureAuthenticatedUser();
        if (!user || !user.id) {
            showCustomAlert("يرجى تسجيل الدخول أولاً للمتابعة.");
            return;
        }

        // 2. التحقق من الباقة المختارة
        if (!selectedProductId) {
            showCustomAlert("يرجى اختيار باقة صالحة للشراء.");
            return;
        }

        // 3. التحقق من متطلبات المعرف إذا كانت الباقة شحن ID
        const isDirectId = selectedProductType === 'ID';
        let finalPlayerId = null;
        let finalPlayerIdConfirm = null;

        if (isDirectId) {
            finalPlayerId = inputPlayerId ? inputPlayerId.trim() : '';
            finalPlayerIdConfirm = inputPlayerIdConfirm ? inputPlayerIdConfirm.trim() : '';

            if (!finalPlayerId) {
                showCustomAlert("يرجى إدخال معرف اللاعب (Player ID).");
                return;
            }

            if (finalPlayerIdConfirm && finalPlayerId !== finalPlayerIdConfirm) {
                showCustomAlert("معرف اللاعب غير متطابق مع التأكيد.");
                return;
            }
        }

        // 4. استدعاء الدالة الموثوقة buy_product
        const { data: r, error } = await supabase.rpc('buy_product', {
            p_user_id: user.id,
            p_product_id: selectedProductId,
            p_player_id: isDirectId ? finalPlayerId : null,
            p_player_id_confirm: isDirectId ? finalPlayerIdConfirm : null,
            p_coupon_code: activeCoupon ? activeCoupon.code.trim() : null
        });

        if (error) {
            console.error("فشل تنفيذ الشراء:", error);
            showCustomAlert(error.message || "حدث خطأ أثناء تنفيذ الطلب.");
            return;
        }

        if (r?.status === 'error') {
            showCustomAlert(r.message);
            return;
        }

        // 5. إغلاق نوافذ الشراء والمراجعة
        toggleView('purchase-modal', false);
        toggleView('plans-modal', false);

        // 6. عرض النوافذ المناسبة وفقاً لنوع الباقة
        if (r?.mode === 'CODE' && r?.code) {
            showCodeDeliveryModal(r.code, selectedItemName);
        } else {
            showDirectIdSuccessModal({
                itemName: selectedItemName,
                playerId: finalPlayerId || '---',
                price: r?.final_price || selectedItemPrice
            });
        }

        // 7. تحديث رصيد وبيانات المستخدم في الخلفية
        if (typeof silentSyncData === 'function') silentSyncData();
        if (typeof fetchUserProfile === 'function') await fetchUserProfile();

    } catch (err) {
        console.error("خطأ عام في الشراء:", err);
        showCustomAlert("تعذر إتمام العملية، يرجى المحاولة لاحقاً.");
    } finally {
        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.innerText = "تأكيد الشراء";
        }
    }
}

// 9. نافذة تأكيد طلب شحن المعرف المباشر (Direct ID)
function showDirectIdSuccessModal(data) {
    const oldModal = document.getElementById('direct-id-success-modal');
    if (oldModal) oldModal.remove();

    const modalHtml = `
    <div id="direct-id-success-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[99]">
        <div class="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[28px] p-6 text-center space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div class="w-16 h-16 bg-
