// ========================================================================
// SHIIFT X — وحدة المتجر والشراء والتمويل (Store & Checkout Controller)
// ========================================================================

// ------------------------------------------------------------------------
// المتغيرات العامة وإدارة الحالة (State Management)
// ------------------------------------------------------------------------
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
let currentDeliveredCode = "";

// أيقونة التحميل الافتراضية للعلامة التجارية في حال عدم وجودها بالنطاق العام
const DEFAULT_SPINNER_SVG = `
<svg class="animate-spin h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
</svg>`;

const LOADER_ICON = (typeof BRAND_LOADER_SVG !== 'undefined') ? BRAND_LOADER_SVG : DEFAULT_SPINNER_SVG;

// ------------------------------------------------------------------------
// 0. التحقق من جلسة المستخدم والبيانات الشخصية
// ------------------------------------------------------------------------
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

// ------------------------------------------------------------------------
// 1. جلب المنتجات النشطة من قاعدة البيانات
// ------------------------------------------------------------------------
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
            price: parseFloat(p.price) || 0,
            type: (p.product_type || 'CODE').trim().toUpperCase(),
            image_url: p.image_url
        }));

        const storeView = document.getElementById('view-store');
        if (storeView && !storeView.classList.contains('hidden')) {
            renderMainCategoriesView();
        }
    }
}

// ------------------------------------------------------------------------
// 2. عرض التصنيفات والمجموعات الرئيسية
// ------------------------------------------------------------------------
function renderMainCategoriesView() {
    const titleText = document.getElementById('store-title-text');
    if (titleText) titleText.innerHTML = `متجر المجموعات الرقمية`;

    const backBtn = document.getElementById('store-nested-back-btn');
    if (backBtn) backBtn.classList.add('hidden');

    const innerGrid = document.getElementById('store-interactive-box');
    if (!innerGrid) return;
    innerGrid.innerHTML = `<div id="dash-categories-container" class="grid grid-cols-2 gap-4"></div>`;

    const categories = [...new Set(globalProductsRaw.map(p => p.category).filter(Boolean))];
    const container = document.getElementById('dash-categories-container');

    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = "glass-panel flex flex-col items-center justify-center gap-3 h-32 cursor-pointer font-black text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/80 hover:border-blue-500/50 transition rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm";
        div.innerHTML = `<span>${cat}</span>`;
        div.onclick = () => renderNestedPlatformsView(cat);
        container.appendChild(div);
    });
}

// ------------------------------------------------------------------------
// 3. عرض المنصات التابعة لتصنيف محدد
// ------------------------------------------------------------------------
function renderNestedPlatformsView(categoryName) {
    const titleText = document.getElementById('store-title-text');
    if (titleText) titleText.innerHTML = `منصات: ${categoryName}`;

    const backBtn = document.getElementById('store-nested-back-btn');
    if (backBtn) {
        backBtn.classList.remove('hidden');
        backBtn.onclick = () => renderMainCategoriesView();
    }

    const innerList = document.getElementById('store-interactive-box');
    if (!innerList) return;
    innerList.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right"></div>`;

    const platforms = [...new Set(globalProductsRaw.filter(p => p.category === categoryName).map(p => p.platform).filter(Boolean))];
    const container = innerList.querySelector('div');

    platforms.forEach(pName => {
        const platformItem = globalProductsRaw.find(p => p.category === categoryName && p.platform === pName);
        const iconUrl = platformItem && platformItem.image_url ? platformItem.image_url : '';

        const div = document.createElement('div');
        div.className = "card-lift bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex justify-between items-center cursor-pointer shadow-sm hover:border-blue-500/40 transition";
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

// ------------------------------------------------------------------------
// 4. فتح نافذة الباقات للمنصة المختارة
// ------------------------------------------------------------------------
function openPlansModal(platformName, categoryName) {
    const modalTitle = document.getElementById('plans-modal-title');
    if (modalTitle) modalTitle.innerText = `باقات منصة ${platformName}`;

    const container = document.getElementById('plans-container');
    if (!container) return;
    container.innerHTML = "";

    const plans = globalProductsRaw.filter(p => p.category === categoryName && p.platform === platformName);

    plans.forEach(plan => {
        const isCode = plan.type === 'CODE';
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
                    <div>${badgeHtml}</div>
                </div>
            </div>
            <div class="flex flex-col items-end gap-1.5 shrink-0">
                <span class="text-base font-black text-blue-600 dark:text-blue-400 tabular-numeric financial-amount">$${plan.price.toFixed(2)}</span>
                <button onclick="openAccountInputsModal('${plan.id}', '${plan.package_name.replace(/'/g, "\\'")}', ${plan.price}, '${plan.type}')" class="btn-primary text-white text-[11px] font-bold px-4 py-2 rounded-xl transition shadow-sm active:scale-95 bg-blue-600 hover:bg-blue-700">شراء</button>
            </div>
        `;
        container.appendChild(card);
    });
    toggleView('plans-modal', true);
}

// ------------------------------------------------------------------------
// 5. نافذة إدخال المعرف (ID) أو تنبيه الكود المباشر
// ------------------------------------------------------------------------
function openAccountInputsModal(productId, fullName, price, productType) {
    selectedProductId = productId;
    selectedItemName = fullName;
    selectedItemPrice = price;
    selectedProductType = (productType || 'CODE').trim().toUpperCase();

    const idInput = document.getElementById('target-player-id');
    const idConfirmInput = document.getElementById('target-player-id-confirm');
    if (idInput) idInput.value = "";
    if (idConfirmInput) idConfirmInput.value = "";

    const isIdFlow = selectedProductType === "ID";

    toggleView('id-fields-container', isIdFlow);
    toggleView('code-fields-notice', !isIdFlow);
    toggleView('account-inputs-modal', true);
}

// ------------------------------------------------------------------------
// 6. شاشة مراجعة الطلب والفاتورة النهائية
// ------------------------------------------------------------------------
function proceedToReview() {
    const isIdFlow = selectedProductType === "ID";

    if (isIdFlow) {
        inputPlayerId = (document.getElementById('target-player-id')?.value || '').trim();
        inputPlayerIdConfirm = (document.getElementById('target-player-id-confirm')?.value || '').trim();

        if (!inputPlayerId) {
            return showCustomAlert("يرجى إدخال معرف اللاعب (Player ID).");
        }
        if (inputPlayerId !== inputPlayerIdConfirm) {
            return showCustomAlert("معرف الحساب غير متطابق مع حقل التأكيد.");
        }

        const reviewIdElem = document.getElementById('review-item-player-id');
        if (reviewIdElem) reviewIdElem.innerText = inputPlayerId;

        const deliveryTypeElem = document.getElementById('review-item-delivery-type');
        if (deliveryTypeElem) deliveryTypeElem.innerText = `شحن مباشر بالمعرف`;

        toggleView('review-id-row', true);
    } else {
        inputPlayerId = "";
        inputPlayerIdConfirm = "";
        toggleView('review-id-row', false);

        const deliveryTypeElem = document.getElementById('review-item-delivery-type');
        if (deliveryTypeElem) deliveryTypeElem.innerText = `تسليم الكود فوراً`;
    }

    // تصفير حالة الكوبون عند المراجعة
    activeCoupon = null;
    discountedPrice = selectedItemPrice;

    const cInput = document.getElementById('coupon-code-input');
    if (cInput) cInput.value = "";

    const cMsg = document.getElementById('coupon-status-msg');
    if (cMsg) {
        cMsg.className = "text-[10px] mt-1.5 hidden font-bold";
        cMsg.innerText = "";
    }

    const dRow = document.getElementById('discount-breakdown-row');
    if (dRow) {
        dRow.classList.add('hidden');
        dRow.classList.remove('flex');
    }

    toggleView('account-inputs-modal', false);

    const nameElem = document.getElementById('review-item-name');
    if (nameElem) nameElem.innerText = selectedItemName;

    const priceElem = document.getElementById('review-item-price');
    if (priceElem) priceElem.innerText = "$" + selectedItemPrice.toFixed(2);

    toggleView('purchase-modal', true);
}

// ------------------------------------------------------------------------
// 7. تطبيق وفحص كود الخصم الترويجي
// ------------------------------------------------------------------------
async function applyCouponCode() {
    await ensureAuthenticatedUser();

    const input = document.getElementById('coupon-code-input');
    const statusMsg = document.getElementById('coupon-status-msg');
    const btn = document.getElementById('apply-coupon-btn');
    const code = input ? input.value.trim().toUpperCase() : '';
    const discountRow = document.getElementById('discount-breakdown-row');
    const priceDisplay = document.getElementById('review-item-price');

    // استثناء حسابات الشركاء والوكلاء من تطبيق الكوبونات
    if (currentUserRole === 'agent' || currentUserRole === 'marketing_partner') {
        if (discountRow) {
            discountRow.classList.add('hidden');
            discountRow.classList.remove('flex');
        }
        if (priceDisplay) priceDisplay.innerText = "$" + selectedItemPrice.toFixed(2);

        if (statusMsg) {
            statusMsg.classList.remove('hidden');
            statusMsg.className = "text-[10px] mt-1.5 text-rose-500 font-bold block";
            statusMsg.innerText = "✕ حسابات الشركاء والوكلاء غير مخولة باستخدام أي كود خصم.";
        }
        return;
    }

    // إعادة التعيين في حال تفريغ الحقل
    if (!code) {
        activeCoupon = null;
        discountedPrice = selectedItemPrice;
        if (discountRow) {
            discountRow.classList.add('hidden');
            discountRow.classList.remove('flex');
        }
        if (priceDisplay) priceDisplay.innerText = "$" + selectedItemPrice.toFixed(2);
        if (statusMsg) statusMsg.classList.add('hidden');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerText = "...";
    }

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

            if (discountRow) {
                discountRow.classList.add('hidden');
                discountRow.classList.remove('flex');
            }
            if (priceDisplay) priceDisplay.innerText = "$" + selectedItemPrice.toFixed(2);

            if (statusMsg) {
                statusMsg.classList.remove('hidden');
                statusMsg.className = "text-[10px] mt-1.5 text-rose-500 font-bold block";
                statusMsg.innerText = "✕ رمز القسيمة غير صالح أو منتهي الصلاحية.";
            }
        } else {
            activeCoupon = coupon;
            const discountAmt = (selectedItemPrice * (coupon.discount_percent / 100.0));
            discountedPrice = Math.max(0, selectedItemPrice - discountAmt);

            const labelElem = document.getElementById('discount-label-text');
            if (labelElem) labelElem.innerText = `خصم القسيمة (${coupon.discount_percent}%):`;

            const valElem = document.getElementById('discount-val-text');
            if (valElem) valElem.innerText = `-$${discountAmt.toFixed(2)}`;

            if (discountRow) {
                discountRow.classList.remove('hidden');
                discountRow.classList.add('flex');
            }
            if (priceDisplay) priceDisplay.innerText = "$" + discountedPrice.toFixed(2);

            if (statusMsg) {
                statusMsg.classList.remove('hidden');
                statusMsg.className = "text-[10px] mt-1.5 text-emerald-600 dark:text-emerald-400 font-bold block";
                statusMsg.innerText = `✓ تم تطبيق الخصم بنجاح! وفرت $${discountAmt.toFixed(2)}`;
            }
        }
    } catch (err) {
        console.error("Coupon check error:", err);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "تطبيق";
        }
    }
}

// ------------------------------------------------------------------------
// 8. تنفيذ عملية الدفع والشراء الذرية
// ------------------------------------------------------------------------
async function executeSubscriptionPurchase() {
    const buyBtn = document.querySelector('#purchase-modal button[onclick*="executeSubscriptionPurchase"]') ||
                   document.getElementById('confirm-purchase-btn');

    if (buyBtn) {
        buyBtn.disabled = true;
        buyBtn.innerHTML = `<span class="flex items-center justify-center gap-2">${LOADER_ICON} <span>جاري تنفيذ الطلب...</span></span>`;
    }

    try {
        const user = await ensureAuthenticatedUser();
        if (!user || !user.id) {
            showCustomAlert("يرجى تسجيل الدخول أولاً للمتابعة.");
            return;
        }

        if (!selectedProductId) {
            showCustomAlert("يرجى اختيار باقة صالحة للشراء.");
            return;
        }

        const isDirectId = selectedProductType === 'ID';
        let finalPlayerId = null;
        let finalPlayerIdConfirm = null;

        if (isDirectId) {
            finalPlayerId = (inputPlayerId || '').trim();
            finalPlayerIdConfirm = (inputPlayerIdConfirm || '').trim();

            if (!finalPlayerId) {
                showCustomAlert("يرجى إدخال معرف اللاعب (Player ID).");
                return;
            }

            if (finalPlayerIdConfirm && finalPlayerId !== finalPlayerIdConfirm) {
                showCustomAlert("معرف اللاعب غير متطابق مع التأكيد.");
                return;
            }
        }

        // استدعاء دالة الشراء الذرية في Supabase
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

        if (r?.status === 'error' || r?.status === 'failed') {
            showCustomAlert(r.message || "تعذر إتمام العملية.");
            return;
        }

        // إغلاق نوافذ المتجر
        toggleView('purchase-modal', false);
        toggleView('plans-modal', false);
        if (typeof closeAllModals === 'function') closeAllModals();

        // عرض شاشة النتيجة الملائمة
        if (r?.mode === 'CODE' && r?.code) {
            showCodeDeliveryModal(r.code, selectedItemName);
        } else {
            showDirectIdSuccessModal({
                itemName: selectedItemName,
                playerId: finalPlayerId || '---',
                price: r?.final_price || (activeCoupon ? discountedPrice : selectedItemPrice),
                txRef: r?.tx_ref || ''
            });
        }

        // مزامنة الرصيد والبيانات
        if (typeof silentSyncData === 'function') await silentSyncData();
        if (typeof fetchUserProfile === 'function') await fetchUserProfile();

    } catch (err) {
        console.error("Purchase General Error:", err);
        showCustomAlert(err.message || "فشلت معالجة الطلب، يرجى المحاولة لاحقاً.");
    } finally {
        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.innerHTML = `
                <i class="ph-fill ph-check-circle text-lg"></i>
                <span class="tracking-wide">تأكيد ودفع</span>
            `;
        }
    }
}

// ------------------------------------------------------------------------
// 9. نافذة تأكيد طلب شحن المعرف المباشر (Direct ID)
// ------------------------------------------------------------------------
function showDirectIdSuccessModal(data) {
    const oldModal = document.getElementById('direct-id-success-modal');
    if (oldModal) oldModal.remove();

    const modalHtml = `
    <div id="direct-id-success-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[99]">
        <div class="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[28px] p-6 text-center space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div class="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                <i class="ph-fill ph-hourglass-medium animate-pulse"></i>
            </div>

            <div class="space-y-1">
                <h3 class="text-base font-black text-slate-800 dark:text-slate-100">تم استلام طلب الشحن بنجاح!</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">طلبك قيد المراجعة والشحن المباشر لحسابك الآن.</p>
            </div>

            <div class="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-xs space-y-2.5 text-right border border-slate-200/60 dark:border-slate-700/60">
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">المنتج:</span>
                    <span class="font-bold text-slate-800 dark:text-slate-200">${data.itemName}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">المعرف المستلم (ID):</span>
                    <span class="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded" dir="ltr">${data.playerId}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">المبلغ المدفوع:</span>
                    <span class="font-black text-slate-800 dark:text-slate-200">$${Number(data.price).toFixed(2)}</span>
                </div>
                ${data.txRef ? `
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">رقم المرجع:</span>
                    <span class="font-mono text-slate-500 text-[10px]">${data.txRef}</span>
                </div>` : ''}
                <div class="flex justify-between items-center border-t border-slate-200/60 dark:border-slate-700/60 pt-2 text-amber-600 dark:text-amber-400 font-bold">
                    <span class="flex items-center gap-1"><i class="ph ph-clock"></i> وقت التنفيذ المتوقع:</span>
                    <span>5 - 15 دقيقة</span>
                </div>
            </div>

            <p class="text-[11px] text-slate-400">يمكنك متابعة حالة الطلب في أي وقت عبر <b>سجل المعاملات والطلبات</b>.</p>

            <button onclick="document.getElementById('direct-id-success-modal').remove()" class="btn-spring w-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-xs transition shadow-md cursor-pointer">
                فهمت، شكراً لك
            </button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ------------------------------------------------------------------------
// 10. تسليم ومشاركة الكود الرقمي
// ------------------------------------------------------------------------
function showCodeDeliveryModal(code, itemName) {
    currentDeliveredCode = code;
    const codeElem = document.getElementById('delivered-code-text');
    if (codeElem) codeElem.innerText = code;

    const itemElem = document.getElementById('delivery-item-name');
    if (itemElem) itemElem.innerText = itemName || "البطاقة الرقمية";

    const codeBox = codeElem ? codeElem.parentElement : null;
    if (codeBox) codeBox.classList.add('code-shimmer-box');

    toggleView('code-delivery-modal', true);
}

function copyDeliveredCode() {
    if (!currentDeliveredCode) return;
    navigator.clipboard.writeText(currentDeliveredCode).then(() => {
        showCustomAlert("تم نسخ كود البطاقة بنجاح!", false);
    }).catch(() => {
        showCustomAlert("تعذر النسخ التلقائي للرمز.");
    });
}

async function shareDeliveredCode() {
    if (!currentDeliveredCode) return;
    const shareData = {
        title: 'كود البطاقة الرقمية - SHIIFT X',
        text: `كود البطاقة الخاص بك: ${currentDeliveredCode}\nتم الشراء عبر منصة SHIIFT X.`
    };
    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            // إلغاء المشاركة بواسطة المستخدم
        }
    } else {
        copyDeliveredCode();
    }
}

// ------------------------------------------------------------------------
// 11. دوال شحن الرصيد المباشر (Deposit Form)
// ------------------------------------------------------------------------
function updateDirectWalletInfo() {
    const select = document.getElementById('sub-payment-method');
    const walletBox = document.getElementById('direct-official-wallet-num');
    const labelBox = document.getElementById('direct-gateway-name-label');
    if (!select || !walletBox) return;

    const selectedOpt = select.options[select.selectedIndex];
    const walletNum = selectedOpt ? selectedOpt.getAttribute('data-wallet') : '---';
    const gatewayName = selectedOpt ? selectedOpt.value : '';

    walletBox.innerText = walletNum || '---';
    if (labelBox) labelBox.innerText = `رقم حساب ${gatewayName}:`;
}

function setPresetAmount(val, btnEl) {
    const input = document.getElementById('sub-form-amount-select');
    if (input) input.value = val;

    document.querySelectorAll('.amount-preset-btn').forEach(btn => {
        btn.className = "amount-preset-btn py-2 rounded-xl text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-500 transition btn-spring";
    });

    if (btnEl) {
        btnEl.className = "amount-preset-btn py-2 rounded-xl text-xs font-mono font-bold border border-blue-600 bg-blue-600 text-white shadow-sm transition btn-spring";
    }
}

function onCustomAmountTyped() {
    document.querySelectorAll('.amount-preset-btn').forEach(btn => {
        btn.className = "amount-preset-btn py-2 rounded-xl text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-500 transition btn-spring";
    });
}

async function submitSubFinalDeposit() {
    const amtInput = document.getElementById('sub-form-amount-select');
    const rawAmt = amtInput ? amtInput.value.trim().replace(/[،,]/g, '.').replace(/[^0-9.]/g, '') : "";
    const finalAmt = parseFloat(rawAmt);
    const txNumElem = document.getElementById('sub-form-tx-number');
    const txNum = txNumElem ? txNumElem.value.trim() : "";
    const methodElem = document.getElementById('sub-payment-method');
    const method = methodElem ? methodElem.value : "";
    const btn = document.getElementById('sub-deposit-final-btn');

    if (!rawAmt || isNaN(finalAmt) || finalAmt <= 0) {
        return showCustomAlert("يرجى إدخال مبلغ صحيح للشحن.");
    }
    if (!txNum) {
        return showCustomAlert("يرجى إدخال رقم إشعار الحوالة لتأكيد العملية.");
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="flex items-center justify-center gap-2">${LOADER_ICON} <span>جاري إرسال الإشعار...</span></span>`;
    }

    try {
        const { data: res, error } = await supabase.rpc('submit_deposit_request', {
            p_amount: finalAmt,
            p_payment_method: method,
            p_receipt_num: txNum
        });

        if (error) throw error;

        if (res && res.status === 'success') {
            showCustomAlert("تم رفع طلب الشحن بنجاح وهو قيد المراجعة لدى الإدارة.", false);
            if (amtInput) amtInput.value = "";
            if (txNumElem) txNumElem.value = "";
            onCustomAmountTyped();
            if (typeof switchTab === 'function') switchTab('home');
            if (typeof silentSyncData === 'function') await silentSyncData();
        } else {
            showCustomAlert(res ? res.message : "فشل رفع الطلب، يرجى المحاولة لاحقاً.");
        }
    } catch (err) {
        console.error("Supabase Deposit RPC Error:", err);
        showCustomAlert("فشل رفع الطلب: " + (err.message || "خطأ في الاتصال بالخادم"));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="ph-fill ph-check-circle text-lg"></i> تأكيد وإرسال طلب الشحن`;
        }
    }
}
