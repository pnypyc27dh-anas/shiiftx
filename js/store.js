// ========================================================================
// SHIIFT X — وحدة المتجر والشراء والتمويل (Store & Checkout Controller)
// ========================================================================

// ------------------------------------------------------------------------
// المتغيرات العامة وإدارة الحالة (آمنة ضد خطأ إعادة التصريح)
// ------------------------------------------------------------------------
window.globalProductsRaw = window.globalProductsRaw || [];
window.selectedProductId = window.selectedProductId || null;
window.selectedItemName = window.selectedItemName || "";
window.selectedItemPrice = window.selectedItemPrice || 0;
window.selectedProductType = window.selectedProductType || "CODE";
window.inputPlayerId = window.inputPlayerId || "";
window.inputPlayerIdConfirm = window.inputPlayerIdConfirm || "";
window.activeCoupon = window.activeCoupon || null;
window.discountedPrice = window.discountedPrice || 0;
window.currentUser = window.currentUser || null;
window.currentUserRole = window.currentUserRole || "customer";
window.currentDeliveredCode = window.currentDeliveredCode || "";

// أيقونة التحميل الافتراضية للعلامة التجارية
const DEFAULT_SPINNER_SVG = `
<svg class="animate-spin h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
</svg>`;

const LOADER_ICON = (typeof BRAND_LOADER_SVG !== 'undefined') ? BRAND_LOADER_SVG : DEFAULT_SPINNER_SVG;

// ------------------------------------------------------------------------
// دالة تعقيم النصوص لمنع هجمات XSS
// ------------------------------------------------------------------------
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ------------------------------------------------------------------------
// 0. التحقق من جلسة المستخدم والبيانات الشخصية
// ------------------------------------------------------------------------
async function ensureAuthenticatedUser() {
    if (window.currentUser && window.currentUser.id) {
        return window.currentUser;
    }

    try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            window.currentUser = null;
            window.currentUserRole = "customer";
            return null;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, balance, first_name, last_name')
            .eq('id', user.id)
            .maybeSingle();

        window.currentUser = {
            ...user,
            ...(profile || {})
        };
        window.currentUserRole = profile?.role || 'customer';
        return window.currentUser;
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
        window.globalProductsRaw = prods.map(p => ({
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
    if (titleText) titleText.textContent = `متجر المجموعات الرقمية`;

    const backBtn = document.getElementById('store-nested-back-btn');
    if (backBtn) backBtn.classList.add('hidden');

    const innerGrid = document.getElementById('store-interactive-box');
    if (!innerGrid) return;
    innerGrid.innerHTML = `<div id="dash-categories-container" class="grid grid-cols-2 gap-4"></div>`;

    const categories = [...new Set(window.globalProductsRaw.map(p => p.category).filter(Boolean))];
    const container = document.getElementById('dash-categories-container');

    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = "glass-panel flex flex-col items-center justify-center gap-3 h-32 cursor-pointer font-black text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/80 hover:border-blue-500/50 transition rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm";
        
        const span = document.createElement('span');
        span.textContent = cat;
        div.appendChild(span);

        div.onclick = () => renderNestedPlatformsView(cat);
        container.appendChild(div);
    });
}

// ------------------------------------------------------------------------
// 3. عرض المنصات التابعة لتصنيف محدد
// ------------------------------------------------------------------------
function renderNestedPlatformsView(categoryName) {
    const titleText = document.getElementById('store-title-text');
    if (titleText) titleText.textContent = `منصات: ${categoryName}`;

    const backBtn = document.getElementById('store-nested-back-btn');
    if (backBtn) {
        backBtn.classList.remove('hidden');
        backBtn.onclick = () => renderMainCategoriesView();
    }

    const innerList = document.getElementById('store-interactive-box');
    if (!innerList) return;
    innerList.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right"></div>`;

    const platforms = [...new Set(window.globalProductsRaw.filter(p => p.category === categoryName).map(p => p.platform).filter(Boolean))];
    const container = innerList.querySelector('div');

    platforms.forEach(pName => {
        const platformItem = window.globalProductsRaw.find(p => p.category === categoryName && p.platform === pName);
        const iconUrl = platformItem && platformItem.image_url ? platformItem.image_url : '';

        const div = document.createElement('div');
        div.className = "card-lift bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex justify-between items-center cursor-pointer shadow-sm hover:border-blue-500/40 transition";
        div.onclick = () => openPlansModal(pName, categoryName);

        const safePName = escapeHtml(pName);
        div.innerHTML = `
            <div class="flex items-center gap-3.5">
                ${iconUrl ? `<img src="${encodeURI(iconUrl)}" alt="${safePName}" referrerpolicy="no-referrer" class="w-12 h-12 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/10 p-1.5 shadow-sm">` : `<div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base">${safePName[0]}</div>`}
                <div>
                    <span class="font-black text-sm text-slate-800 dark:text-slate-100 block">${safePName}</span>
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
    if (modalTitle) modalTitle.textContent = `باقات منصة ${platformName}`;

    const container = document.getElementById('plans-container');
    if (!container) return;
    container.innerHTML = "";

    const plans = window.globalProductsRaw.filter(p => p.category === categoryName && p.platform === platformName);

    plans.forEach(plan => {
        const isCode = plan.type === 'CODE';
        const card = document.createElement('div');
        card.className = "card-lift bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-[22px] flex justify-between items-center gap-3 text-right shadow-sm";

        const badgeHtml = isCode
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"><i class="ph-fill ph-lightning"></i> كود فوري</span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"><i class="ph-fill ph-user-circle"></i> شحن بالمعرف</span>`;

        const safePackageName = escapeHtml(plan.package_name);

        card.innerHTML = `
            <div class="flex items-center gap-3.5">
                ${plan.image_url ? `<img src="${encodeURI(plan.image_url)}" alt="${safePackageName}" referrerpolicy="no-referrer" class="w-12 h-12 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/10 p-1 shrink-0 shadow-inner">` : ''}
                <div class="flex flex-col gap-1">
                    <span class="text-xs font-black text-slate-800 dark:text-slate-100 leading-snug">${safePackageName}</span>
                    <div>${badgeHtml}</div>
                </div>
            </div>
            <div class="flex flex-col items-end gap-1.5 shrink-0">
                <span class="text-base font-black text-blue-600 dark:text-blue-400 tabular-numeric financial-amount">$${plan.price.toFixed(2)}</span>
                <button onclick="openAccountInputsModal('${plan.id}')" class="btn-primary text-white text-[11px] font-bold px-4 py-2 rounded-xl transition shadow-sm active:scale-95 bg-blue-600 hover:bg-blue-700">شراء</button>
            </div>
        `;
        container.appendChild(card);
    });
    toggleView('plans-modal', true);
}

// ------------------------------------------------------------------------
// 5. نافذة إدخال المعرف (ID) أو تنبيه الكود المباشر
// ------------------------------------------------------------------------
function openAccountInputsModal(productId) {
    const plan = window.globalProductsRaw.find(p => p.id === productId);
    if (!plan) return;

    window.selectedProductId = plan.id;
    window.selectedItemName = plan.package_name;
    window.selectedItemPrice = plan.price;
    window.selectedProductType = plan.type;

    const idInput = document.getElementById('target-player-id');
    const idConfirmInput = document.getElementById('target-player-id-confirm');
    if (idInput) idInput.value = "";
    if (idConfirmInput) idConfirmInput.value = "";

    const isIdFlow = window.selectedProductType === "ID";

    toggleView('id-fields-container', isIdFlow);
    toggleView('code-fields-notice', !isIdFlow);
    toggleView('account-inputs-modal', true);
}

// ------------------------------------------------------------------------
// 6. شاشة مراجعة الطلب والفاتورة النهائية
// ------------------------------------------------------------------------
function proceedToReview() {
    const isIdFlow = window.selectedProductType === "ID";

    if (isIdFlow) {
        window.inputPlayerId = (document.getElementById('target-player-id')?.value || '').trim();
        window.inputPlayerIdConfirm = (document.getElementById('target-player-id-confirm')?.value || '').trim();

        if (!window.inputPlayerId) {
            return showCustomAlert("يرجى إدخال معرف اللاعب (Player ID).");
        }
        if (window.inputPlayerId !== window.inputPlayerIdConfirm) {
            return showCustomAlert("معرف الحساب غير متطابق مع حقل التأكيد.");
        }

        const reviewIdElem
