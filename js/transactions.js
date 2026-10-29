// ========================================================================
// SHIIFT X — وحدة المعاملات المالية والفواتير (Ledger & Receipts)
// ========================================================================

// 1. قاموس إعدادات أنواع المعاملات والأيقونات والألوان الموحدة
const TX_OP_CONFIG = {
    'Deposit': { label: 'شحن الرصيد', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50', icon: 'ph-bold ph-arrow-down-left' },
    'شحن رصيد': { label: 'شحن الرصيد', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50', icon: 'ph-bold ph-arrow-down-left' },
    'Purchase Digital Code': { label: 'شراء بطاقة رقمية', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/50', icon: 'ph-bold ph-barcode' },
    'شراء كود رقمي': { label: 'شراء بطاقة رقمية', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/50', icon: 'ph-bold ph-barcode' },
    'Direct ID Top-up': { label: 'شحن عبر ID', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-900/50', icon: 'ph-bold ph-game-controller' },
    'شحن مباشر (ID)': { label: 'شحن عبر ID', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-900/50', icon: 'ph-bold ph-game-controller' },
    'Refund': { label: 'استرداد', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50', icon: 'ph-bold ph-arrow-u-up-left' },
    'استرجاع رصيد': { label: 'استرداد', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50', icon: 'ph-bold ph-arrow-u-up-left' },
    'Agent Wallet Transfer': { label: 'تحويل رصيد', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/50', icon: 'ph-bold ph-paper-plane-tilt' },
    'تحويل رصيد': { label: 'تحويل رصيد', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/50', icon: 'ph-bold ph-paper-plane-tilt' },
    'Agent Financial Commission': { label: 'عمولة', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/50', icon: 'ph-bold ph-seal-percent' },
    'عمولة': { label: 'عمولة', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/50', icon: 'ph-bold ph-seal-percent' },
    'Marketing Partner Commission': { label: 'ارباح التسويق', color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-900/50', icon: 'ph-bold ph-megaphone' },
    'Affiliate Commission': { label: 'ارباح التسويق', color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-900/50', icon: 'ph-bold ph-megaphone' },
    'ارباح التسويق': { label: 'ارباح التسويق', color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-900/50', icon: 'ph-bold ph-megaphone' },
    'Commission Payout': { label: 'صرف الارباح', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/50', icon: 'ph-bold ph-money' },
    'صرف الارباح': { label: 'صرف الارباح', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/50', icon: 'ph-bold ph-money' }
};

// 2. المزامنة الدورية الهادئة للرصيد، الصلاحيات، وسجل العمليات
async function silentSyncData() { 
    if (!currentUser) return;
    
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile) {
        const adminLink = document.getElementById('nav-admin-link');
        if (adminLink) {
            adminLink.classList.toggle('hidden', profile.role !== 'admin');
        }

        const agentsLink = document.getElementById('nav-agents-link');
        if (agentsLink) {
            agentsLink.classList.toggle('hidden', profile.role !== 'agent' && profile.role !== 'admin');
        }

        const partnerLink = document.getElementById('nav-marketing-partner-link');
        if (partnerLink) {
            partnerLink.classList.toggle('hidden', profile.role !== 'marketing_partner' && profile.role !== 'admin');
        }

        currentUserRole = profile.role || 'customer';
        currentWalletBalance = parseFloat(profile.balance || 0); 
        
        const balanceEl = document.getElementById('live-balance');
        if (balanceEl) balanceEl.innerText = "$" + currentWalletBalance.toFixed(2); 

        const fullName = (profile.first_name || '') + " " + (profile.last_name || '');
        const clientNameEl = document.getElementById('live-client-name');
        const navNameEl = document.getElementById('nav-user-name');
        if (clientNameEl) clientNameEl.innerText = fullName.trim() || 'عميل معتمد';
        if (navNameEl) navNameEl.innerText = fullName.trim() || 'عميل معتمد';

        rawCardNumber = profile.card_number || "0000 0000 0000 0000"; 
        lastFourDigits = rawCardNumber.substring(rawCardNumber.length - 4); 
        if (typeof resetCardVisibility === 'function') resetCardVisibility(); 

        const fNameInput = document.getElementById('prof-first-name');
        const lNameInput = document.getElementById('prof-last-name');
        const phoneInput = document.getElementById('prof-phone');
        if (fNameInput) fNameInput.value = profile.first_name || "";
        if (lNameInput) lNameInput.value = profile.last_name || "";
        if (phoneInput) phoneInput.value = profile.phone || "";

        const joinDateEl = document.getElementById('live-join-date');
        if (joinDateEl && profile.created_at) {
            joinDateEl.innerText = new Date(profile.created_at).toLocaleDateString('en-GB');
        }
    }
    
    // جلب المعاملات المالية الحديثة
    const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (txs) {
        globalTransactionsRaw = txs.map(t => ({
            type: t.transaction_type, 
            details: t.details, 
            amount: t.amount + " $",
            date: new Date(t.created_at).toLocaleString('en-US', { hour12: false }),
            status: t.status, 
            tx_id: t.transaction_ref, 
            serial_code: t.serial_code,
            delivery_type: t.delivery_type,
            player_id: t.player_id,
            raw: t
        }));
        renderRecentDashboardTransactions(globalTransactionsRaw);
    }
}

// 3. عرض أحدث المعاملات في الواجهة الرئيسية
function renderRecentDashboardTransactions(txArray) {
    const container = document.getElementById('dashboard-recent-tx');
    if (!container) return;
    container.innerHTML = "";

    if (!txArray || txArray.length === 0) {
        container.innerHTML = `
            <div class="py-10 text-center text-slate-400 dark:text-slate-500 space-y-1.5">
                <i class="ph ph-receipt-x text-2xl opacity-40"></i>
                <p class="text-xs font-bold">لا توجد معاملات مسجلة حتى الآن</p>
            </div>`;
        return;
    }

    txArray.slice(0, 5).forEach(tx => {
        container.appendChild(createTransactionCardElement(tx));
    });
}

// 4. بناء عنصر بطاقة المعاملة الذكية
function createTransactionCardElement(tx) {
    const card = document.createElement('div');
    card.className = "group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 mb-3 space-y-3 cursor-pointer";

    const rawTx = tx.raw || {};
    const statusKey = (tx.status || rawTx.status || '').toLowerCase();
    const numAmount = parseFloat(rawTx.amount || parseFloat(tx.amount) || 0);

    const isRefund = tx.type === 'Refund' || tx.type === 'استرجاع رصيد' || tx.type === 'استرداد';
    const isDeposit = tx.type === 'Deposit' || tx.type === 'شحن رصيد' || tx.type === 'شحن الرصيد';
    const isAgentTransferOut = tx.type === 'Agent Wallet Transfer' || tx.type === 'تحويل وكيل صادر' || tx.type === 'تحويل رصيد';
    const isAgentCommission = tx.type === 'Agent Financial Commission' || tx.type === 'عمولة وكيل مالي' || tx.type === 'عمولة';
    const isPartnerCommission = tx.type === 'Marketing Partner Commission' || tx.type === 'Affiliate Commission' || tx.type === 'أرباح شريك تسويقي' || tx.type === 'ارباح التسويق';
    const isCommissionPayout = tx.type === 'Commission Payout' || tx.type === 'صرف أرباح كاش' || tx.type === 'صرف الارباح';
    const isCommission = isAgentCommission || isPartnerCommission;

    const isRefundedOrder = statusKey === 'refunded' || statusKey === 'مسترجع';
    const isPending = statusKey === 'pending' || statusKey === 'معلق';
    const isRejected = statusKey === 'rejected' || statusKey === 'cancelled' || statusKey === 'مرفوض' || statusKey === 'ملغي' || statusKey === 'ملغاة';

    let rawDetails = tx.details || '';
    let cancelReason = rawTx.rejection_reason || rawTx.reason || '';
    let discountInfo = '';

    // البحث عن سبب الرفض أو الإلغاء
    if (!cancelReason) {
        const refMatch = rawDetails.match(/[\[\(](?:مسترجع|مرفوض|سبب الرفض|سبب|ملغاة|ملغي):\s*([^\]\)]+)[\]\)]/);
        if (refMatch) cancelReason = refMatch[1].trim();
    }

    const discMatch = rawDetails.match(/\(خصم كود\s*([^)]+)\)/);
    if (discMatch) discountInfo = discMatch[1].trim();

    let playerId = tx.player_id || rawTx.player_id;
    const idMatch = rawDetails.match(/ID:\s*([^\s)]+)/i);
    if (!playerId && idMatch) playerId = idMatch[1];

    // تنظيف اسم الباقة
    let cleanPackageName = rawDetails
        .replace(/[\[\(](?:مسترجع|مرفوض|سبب الرفض|سبب|ملغاة|ملغي):\s*[^\]\)]+[\]\)]/g, '')
        .replace(/\[إشعار:\s*[^\]]+\]/g, '')
        .replace(/\(ID:\s*[^)]+\)/gi, '')
        .replace(/\(خصم كود\s*[^)]+\)/gi, '')
        .replace(/استرجاع رصيد طلب مرفوض:\s*/g, '')
        .trim();

    let platformName = '';
    let packageName = cleanPackageName;
    let platformImageUrl = '';

    // تعيين العناوين والأوصاف المعتمدة للوكلاء والشركاء
    if (isAgentTransferOut) {
        platformName = 'عمليات الوكيل المعتمد';
        packageName = 'شحن رصيد للعميل';
    } else if (isAgentCommission) {
        platformName = 'ارباح الوكيل المعتمد';
        packageName = 'عمولة عن عملية شحن للعميل';
    } else if (isCommissionPayout) {
        platformName = 'سحب الارباح والعمولات';
        packageName = 'استلام مستحقات الوكيل المعتمد';
    } else if (isPartnerCommission) {
        platformName = 'شركاء التسويق';
        packageName = 'عمولة عن استخدام كود الخصم';
    } else if (typeof globalProductsRaw !== 'undefined' && globalProductsRaw.length > 0) {
        const matched = globalProductsRaw.find(p => 
            p.package_name.trim().toLowerCase() === cleanPackageName.toLowerCase() ||
            cleanPackageName.toLowerCase().includes(p.package_name.trim().toLowerCase()) ||
            p.package_name.trim().toLowerCase().includes(cleanPackageName.toLowerCase())
        );
        if (matched) {
            platformName = matched.platform;
            packageName = matched.package_name;
            platformImageUrl = matched.image_url || '';
        }
    }

    if (!platformName) {
        const methodMatch = rawDetails.match(/عبر\s*\(([^)]+)\)/);
        if (methodMatch) {
            platformName = methodMatch[1];
            packageName = 'شحن الرصيد';
        } else if (isDeposit) {
            platformName = 'قنوات الدفع المعتمدة';
            packageName = rawDetails || 'شحن الرصيد';
        } else if (isRefund) {
            platformName = 'محفظة SHIIFTX';
            packageName = cleanPackageName || 'استرداد';
        } else {
            const parts = cleanPackageName.split(' ');
            if (parts.length > 1) {
                platformName = parts[0];
                packageName = parts.slice(1).join(' ');
            } else {
                platformName = cleanPackageName || 'متجر SHIIFTX';
                packageName = 'اشتراك رقمي';
            }
        }
    }

    const opConfig = TX_OP_CONFIG[tx.type] || { 
        label: tx.type || 'معاملة مالية', 
        color: 'text-slate-600 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300', 
        icon: 'ph-bold ph-receipt' 
    };
    const opLabel = isRefundedOrder ? 'شحن عبر ID' : opConfig.label;

    // شارات الحالة المعتمدة
    let statusPill = '';
    if (isPending) {
        statusPill = `<span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/70 dark:border-amber-900/50 flex items-center gap-1 animate-pulse">
            <i class="ph-bold ph-hourglass-medium"></i>
            <span>قيد المراجعة والتدقيق</span>
        </span>`;
    } else if (isRefundedOrder) {
        statusPill = `<span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200/70 dark:border-purple-900/50 flex items-center gap-1">
            <i class="ph-bold ph-arrow-counter-clockwise"></i>
            <span>مسترجع</span>
        </span>`;
    } else if (isRejected) {
        const rejectText = (statusKey === 'cancelled' || statusKey === 'ملغي' || statusKey === 'ملغاة') ? 'ملغي' : 'مرفوض';
        statusPill = `<span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200/70 dark:border-red-900/50 flex items-center gap-1">
            <i class="ph-bold ph-x-circle"></i>
            <span>${rejectText}</span>
        </span>`;
    } else {
        statusPill = `<span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-900/50 flex items-center gap-1">
            <i class="ph-bold ph-check-circle"></i>
            <span>مكتمل</span>
        </span>`;
    }

    // عرض المبالغ المالية
    let amountHtml = '';
    if (isDeposit || isRefund || isCommission) {
        if (isPending) {
            amountHtml = `<span class="font-mono text-base font-black text-amber-600 dark:text-amber-400">+$${numAmount.toFixed(2)}</span>`;
        } else if (isRejected) {
            amountHtml = `<span class="font-mono text-sm font-bold text-slate-400 line-through">+$${numAmount.toFixed(2)}</span>`;
        } else {
            amountHtml = `<span class="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">+$${numAmount.toFixed(2)}</span>`;
        }
    } else {
        if (isRefundedOrder || isRejected) {
            amountHtml = `<span class="font-mono text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 line-through">-$${numAmount.toFixed(2)}</span>`;
        } else {
            amountHtml = `<span class="font-mono text-base font-black text-rose-600 dark:text-rose-400">-$${numAmount.toFixed(2)}</span>`;
        }
    }

    let logoMarkup = '';
    if (platformImageUrl) {
        logoMarkup = `
            <div class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 p-1.5 shrink-0 flex items-center justify-center shadow-sm">
                <img src="${platformImageUrl}" alt="${platformName}" referrerpolicy="no-referrer" class="w-full h-full object-contain">
            </div>`;
    } else {
        let fallbackIcon = isPending ? 'ph-bold ph-hourglass' : opConfig.icon;
        let fallbackColor = isPending 
            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-900/50' 
            : opConfig.color;

        logoMarkup = `
            <div class="w-12 h-12 rounded-2xl ${fallbackColor} border shrink-0 flex items-center justify-center text-xl shadow-sm">
                <i class="${fallbackIcon}"></i>
            </div>`;
    }

    // حقول المرجع والتاريخ والمعرف
    const txRef = tx.tx_id || rawTx.transaction_ref || '---';
    let chipsHtml = `
        <div class="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400 pt-0.5 font-sans">
            <span class="font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded select-all cursor-pointer hover:bg-slate-200" onclick="event.stopPropagation(); copyToClipboard('${txRef}')" title="انقر لنسخ المرجع">#${txRef}</span>
            <span>•</span>
            <span>${tx.date.split(',')[0]}</span>
            ${playerId ? `<span>•</span> <span class="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/40" dir="ltr">${isDeposit ? 'إشعار التحويل: ' : 'معرّف الحساب (ID): '}${playerId}</span>` : ''}
            ${discountInfo ? `<span>•</span> <span class="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40">خصم ${discountInfo}</span>` : ''}
        </div>
    `;

    const serialCode = tx.serial_code ? String(tx.serial_code).trim() : '';
    const hasCode = serialCode && !['null', 'undefined', 'none', '-'].includes(serialCode.toLowerCase());
    let codeRibbonHtml = '';

    if (hasCode) {
        codeRibbonHtml = `
            <div class="mt-2.5 p-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between border border-slate-800 shadow-inner" dir="ltr" onclick="event.stopPropagation()">
                <div class="flex items-center gap-2">
                    <span class="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                        <i class="ph-bold ph-key"></i>
                    </span>
                    <span class="font-mono text-xs sm:text-sm font-black tracking-widest text-emerald-400 select-all">${serialCode}</span>
                </div>
                <button onclick="copyToClipboard('${serialCode}')" class="btn-spring px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm transition cursor-pointer">
                    <i class="ph-bold ph-copy"></i>
                    <span>نسخ</span>
                </button>
            </div>
        `;
    }

    // تنبيه الرفض أو الإلغاء
    let cancelAlertHtml = '';
    if (cancelReason || isRejected || isRefundedOrder) {
        const displayReason = cancelReason || (isCommission ? 'تم إلغاء العمولة لإلغاء الطلب الأساسي' : 'تم رفض العملية من قبل الإدارة');
        const labelText = isCommission ? 'سبب الإلغاء:' : (isRefundedOrder ? 'سبب الاسترداد:' : 'سبب الرفض:');

        cancelAlertHtml = `
            <div class="mt-2 p-2 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 flex items-center gap-1.5 text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                <i class="ph-fill ph-warning-circle text-xs shrink-0"></i>
                <span>${labelText} ${displayReason}</span>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${opConfig.color}">
                <i class="${opConfig.icon}"></i>
                <span>${opLabel}</span>
            </span>
            <div class="flex items-center gap-2">
                ${statusPill}
                ${amountHtml}
            </div>
        </div>

        <div class="flex items-center gap-3.5">
            ${logoMarkup}
            <div class="min-w-0 space-y-0.5">
                <h4 class="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 truncate tracking-tight">
                    ${platformName}
                </h4>
                <p class="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                    ${packageName}
                </p>
                ${chipsHtml}
            </div>
        </div>

        ${codeRibbonHtml}
        ${cancelAlertHtml}
    `;

    card.onclick = () => openTransactionReceiptModal(tx, opLabel, platformName, packageName, numAmount, statusKey, playerId, cancelReason, platformImageUrl);

    return card;
}

// 5. فتح نافذة تفاصيل الإيصال المالي
function openTransactionReceiptModal(tx, opLabel, platformName, packageName, amount, statusKey, playerId, cancelReason, platformImageUrl) {
    const oldReceipt = document.getElementById('transaction-receipt-modal');
    if (oldReceipt) oldReceipt.remove();

    const rawTx = tx.raw || {};
    const ref = tx.tx_id || rawTx.transaction_ref || 'TX-UNKNOWN';
    const dateStr = tx.date || new Date().toLocaleString();
    const isCredit = tx.type === 'Refund' || tx.type === 'استرجاع رصيد' || tx.type === 'استرداد' || tx.type === 'Deposit' || tx.type === 'شحن رصيد' || tx.type === 'شحن الرصيد' || tx.type === 'Agent Financial Commission' || tx.type === 'عمولة' || tx.type === 'Marketing Partner Commission' || tx.type === 'Affiliate Commission' || tx.type === 'ارباح التسويق';

    let statusLabel = 'مكتمل ✓';
    let statusClass = 'text-emerald-600 dark:text-emerald-400';

    if (statusKey === 'pending' || statusKey === 'معلق') {
        statusLabel = 'قيد المراجعة والتدقيق ⏳';
        statusClass = 'text-amber-600 dark:text-amber-400 animate-pulse';
    } else if (statusKey === 'refunded' || statusKey === 'مسترجع') {
        statusLabel = 'مسترجع';
        statusClass = 'text-purple-600 dark:text-purple-400';
    } else if (statusKey === 'rejected' || statusKey === 'cancelled' || statusKey === 'مرفوض' || statusKey === 'ملغي' || statusKey === 'ملغاة') {
        statusLabel = (statusKey === 'cancelled' || statusKey === 'ملغي' || statusKey === 'ملغاة') ? 'ملغي ✕' : 'مرفوض ✕';
        statusClass = 'text-red-600';
    }

    const isCommissionTx = tx.type === 'Agent Financial Commission' || tx.type === 'عمولة' || tx.type === 'Marketing Partner Commission' || tx.type === 'Affiliate Commission' || tx.type === 'ارباح التسويق';
    const reasonTitle = isCommissionTx ? 'سبب الإلغاء:' : (statusKey === 'refunded' || statusKey === 'مسترجع' ? 'سبب الاسترداد:' : 'سبب الرفض:');

    const receiptHtml = `
    <div id="transaction-receipt-modal" class="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[120]">
        <div class="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[28px] p-6 text-right space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
            <button onclick="document.getElementById('transaction-receipt-modal').remove()" class="modal-btn-close absolute left-5 top-5 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <i class="ph ph-x font-bold text-sm"></i>
            </button>
            <div class="text-center pt-1 space-y-1">
                <span class="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full">${opLabel}</span>
                <h3 class="text-base font-black text-slate-900 dark:text-slate-100 pt-1">${platformName}</h3>
                <p class="text-xs font-bold text-slate-500 dark:text-slate-400">${packageName}</p>
                <div class="pt-2">
                    <span class="text-3xl font-black font-mono ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
                        ${isCredit ? '+' : '-'}$${amount.toFixed(2)}
                    </span>
                </div>
            </div>
            <div class="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-xs space-y-2 border border-slate-200/70 dark:border-slate-800">
                <div class="flex justify-between"><span>المرجع:</span><span class="font-mono font-bold select-all">#${ref}</span></div>
                <div class="flex justify-between"><span>التاريخ:</span><span>${dateStr}</span></div>
                <div class="flex justify-between"><span>الحالة:</span><span class="font-bold ${statusClass}">${statusLabel}</span></div>
                ${cancelReason ? `<div class="flex justify-between text-rose-500 font-bold border-t border-slate-200/50 dark:border-slate-700/50 pt-1.5"><span>${reasonTitle}</span><span>${cancelReason}</span></div>` : ''}
            </div>
            <div class="flex gap-2 pt-1">
                <button onclick="printOfficialInvoice('${ref}', '${platformName}', '${packageName}', '${amount.toFixed(2)}', '${dateStr}', '${playerId || ''}', '${statusLabel}')" class="btn-spring flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-blue-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer">
                    <i class="ph-bold ph-printer"></i>
                    <span>طباعة الفاتورة</span>
                </button>
                <button onclick="copyToClipboard('${ref}'); if(typeof showCustomAlert === 'function') showCustomAlert('تم نسخ الرقم المرجعي!', false);" class="btn-spring px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer">
                    <i class="ph-bold ph-copy text-sm"></i>
                </button>
                <button onclick="document.getElementById('transaction-receipt-modal').remove()" class="btn-spring px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer">
                    إغلاق
                </button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', receiptHtml);
}

// 6. نافذة السجل الشامل مع التصفية الذكية
let currentOrderFilter = 'ALL';

function openAllOrdersModal() {
    if (typeof toggleSideMenu === 'function') toggleSideMenu(false);
    filterOrdersHistory('ALL');
    toggleView('all-orders-modal', true);
}

function filterOrdersHistory(filterType) {
    currentOrderFilter = filterType;
    document.querySelectorAll('.order-filter-btn').forEach(btn => {
        btn.className = "order-filter-btn bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl";
    });
    if (window.event && window.event.target && window.event.target.classList) {
        window.event.target.classList.remove('bg-slate-100', 'text-slate-600');
        window.event.target.classList.add('bg-slate-900', 'text-white', 'dark:bg-white', 'dark:text-slate-900');
    }

    const container = document.getElementById('all-orders-container');
    if (!container) return;
    container.innerHTML = "";

    let list = globalTransactionsRaw;
    if (filterType === 'CODE') {
        list = list.filter(t => t.delivery_type === 'CODE' || (t.serial_code && !String(t.type).includes('ID') && !String(t.type).includes('مباشر')));
    } else if (filterType === 'DIRECT_ID') {
        list = list.filter(t => t.delivery_type === 'DIRECT_ID' || String(t.type).includes('Direct') || String(t.type).includes('مباشر'));
    } else if (filterType === 'DEPOSIT') {
        list = list.filter(t => t.type === 'Deposit' || t.type === 'شحن رصيد' || t.type === 'شحن الرصيد' || t.delivery_type === 'WALLET_DEPOSIT');
    }

    if (list.length === 0) {
        container.innerHTML = `<p class="text-center text-xs text-slate-400 py-8">لا توجد حركات مطابقة لهذا القسم.</p>`;
        return;
    }

    list.forEach(tx => {
        container.appendChild(createTransactionCardElement(tx));
    });
}

// 7. محرك توليد وطباعة الفاتورة الفاخرة
function printOfficialInvoice(ref, platform, pkg, amount, date, playerId, status) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cleanId = (playerId && playerId !== 'undefined' && playerId !== 'null') ? playerId : 'حساب مباشر / فوري';
    const cleanStatus = status || 'مكتمل وموثق ✓';
    const numAmount = parseFloat(amount || 0).toFixed(2);
    const safeRef = (ref || 'TX-SHIIFTX').trim();

    const invoiceHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>إشعار تسوية مالية - ${safeRef}</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Tajawal', sans-serif;
            background-color: #F1F5F9;
            color: #0F172A;
            padding: 40px 15px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .invoice-sheet {
            max-width: 700px;
            margin: auto;
            background: #FFFFFF;
            border-radius: 28px;
            border: 1px solid #E2E8F0;
            box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.08), 0 0 1px 1px rgba(15, 23, 42, 0.02);
            position: relative;
            overflow: hidden;
        }
        .sheet-content {
            position: relative;
            z-index: 2;
            padding: 44px 44px 36px;
        }
        .accent-bar {
            height: 6px;
            background: linear-gradient(90deg, #008B94 0%, #005ba3 50%, #5CE1E6 100%);
        }
        .header-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 28px;
            border-bottom: 1px solid #E2E8F0;
        }
        .company-meta {
            font-size: 10px;
            font-family: 'Plus Jakarta Sans', sans-serif;
            letter-spacing: 0.15em;
            color: #64748B;
            font-weight: 700;
            margin-top: 8px;
            text-transform: uppercase;
        }
        .doc-identifier { text-align: left; }
        .badge-verified {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 9999px;
            background: #F0FDF4;
            border: 1px solid #BBF7D0;
            color: #15803D;
            font-size: 11px;
            font-weight: 800;
            margin-bottom: 8px;
        }
        .ref-number {
            font-family: 'Plus Jakarta Sans', monospace;
            font-size: 14px;
            font-weight: 800;
            color: #0F172A;
            letter-spacing: 0.05em;
        }
        .params-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin: 26px 0;
            padding: 16px;
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 18px;
        }
        .param-cell span {
            display: block;
            font-size: 10px;
            font-weight: 700;
            color: #64748B;
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        .param-cell strong {
            display: block;
            font-size: 12px;
            font-weight: 800;
            color: #0F172A;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .param-cell code {
            font-family: 'Plus Jakarta Sans', monospace;
            font-size: 11px;
            color: #008B94;
            font-weight: 800;
        }
        .line-items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
        }
        .line-items th {
            text-align: right;
            padding: 12px 16px;
            font-size: 11px;
            font-weight: 800;
            color: #475569;
            text-transform: uppercase;
            border-bottom: 2px solid #E2E8F0;
            background: #F8FAFC;
        }
        .line-items td {
            padding: 18px 16px;
            font-size: 13px;
            border-bottom: 1px solid #F1F5F9;
            vertical-align: middle;
        }
        .item-main-title {
            font-size: 14px;
            font-weight: 800;
            color: #0F172A;
        }
        .item-subtext {
            font-size: 11px;
            color: #64748B;
            margin-top: 3px;
        }
        .calculation-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #0D0E12;
            color: #FFFFFF;
            border-radius: 20px;
            padding: 22px 28px;
            margin-bottom: 26px;
            border: 1px solid #1E293B;
        }
        .calc-details p {
            font-size: 11px;
            color: #94A3B8;
            font-weight: 600;
            margin-bottom: 2px;
        }
        .calc-details h4 {
            font-size: 15px;
            font-weight: 900;
            color: #FFFFFF;
        }
        .calc-total { text-align: left; }
        .calc-total-label {
            font-size: 10px;
            color: #008B94;
            font-weight: 800;
            letter-spacing: 0.1em;
            text-transform: uppercase;
        }
        .calc-amount {
            font-family: 'Plus Jakarta Sans', monospace;
            font-size: 34px;
            font-weight: 900;
            color: #5CE1E6;
            letter-spacing: -0.02em;
            line-height: 1.1;
        }
        .footer-seal {
            border-top: 1px dashed #CBD5E1;
            padding-top: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .security-badge {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .seal-icon {
            width: 32px;
            height: 32px;
            border-radius: 10px;
            background: #F0FDF4;
            border: 1px solid #DCFCE7;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #16A34A;
        }
        .security-text h6 {
            font-size: 11px;
            font-weight: 800;
            color: #0F172A;
        }
        .security-text p {
            font-size: 10px;
            color: #64748B;
        }
        .audit-tag {
            text-align: left;
            font-family: 'Plus Jakarta Sans', monospace;
            font-size: 10px;
            color: #94A3B8;
            font-weight: 600;
        }
        @media print {
            body { background: #FFFFFF; padding: 0; }
            .invoice-sheet { border: none; box-shadow: none; max-width: 100%; }
        }
    </style>
</head>
<body>
    <div class="invoice-sheet">
        <div class="accent-bar"></div>
        <div class="sheet-content">
            <div class="header-section">
                <div>
                    <div style="font-size: 24px; font-weight: 900; color: #0F172A; letter-spacing: -0.03em;">SHIIFT X</div>
                    <div class="company-meta">SHIIFT X FINANCIAL INFRASTRUCTURE</div>
                </div>
                <div class="doc-identifier" dir="ltr">
                    <div class="badge-verified">
                        <span>${cleanStatus}</span>
                    </div>
                    <div class="ref-number">#${safeRef}</div>
                </div>
            </div>
            <div class="params-grid">
                <div class="param-cell">
                    <span>تاريخ وتوقيت القيد:</span>
                    <strong>${date}</strong>
                </div>
                <div class="param-cell">
                    <span>قناة التسوية:</span>
                    <strong>محفظة SHIIFT X</strong>
                </div>
                <div class="param-cell">
                    <span>المنصة / الناشر:</span>
                    <strong>${platform}</strong>
                </div>
                <div class="param-cell">
                    <span>معرف الوجهة (ID):</span>
                    <code>${cleanId}</code>
                </div>
            </div>
            <table class="line-items">
                <thead>
                    <tr>
                        <th>الوصف والبيان المالي</th>
                        <th style="text-align: center; width: 80px;">الكمية</th>
                        <th style="text-align: left; width: 120px;">القيمة المسجلة</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <div class="item-main-title">${platform} — ${pkg}</div>
                            <div class="item-subtext">قسيمة دفع رقمية صادرة ومعتمدة فورياً عبر نظام التسوية الرقمية</div>
                        </td>
                        <td style="text-align: center; font-weight: 800; font-family: 'Plus Jakarta Sans', monospace;">1</td>
                        <td style="text-align: left; font-family: 'Plus Jakarta Sans', monospace; font-weight: 800; font-size: 15px;">$${numAmount}</td>
                    </tr>
                </tbody>
            </table>
            <div class="calculation-card">
                <div class="calc-details">
                    <p>صافي الخصم المحتسب من رصيدك:</p>
                    <h4>إجمالي الدفع النهائي المعتمد</h4>
                </div>
                <div class="calc-total" dir="ltr">
                    <div class="calc-total-label">TOTAL SETTLED</div>
                    <div class="calc-amount">$${numAmount}</div>
                </div>
            </div>
            <div class="footer-seal">
                <div class="security-badge">
                    <div class="seal-icon">✓</div>
                    <div class="security-text">
                        <h6>معاملة مشفرة وموثقة</h6>
                        <p>وثيقة إلكترونية رسمية صادرة آلياً ومسجلة في قاعدة بيانات SHIIFT X المعتمدة.</p>
                    </div>
                </div>
                <div class="audit-tag" dir="ltr">
                    AUTHENTICATED LEDGER<br>
                    #${safeRef.replace(/[^a-zA-Z0-9]/g, '')}-SEC
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 400);
}

// ========================================================================
// شبكة الوكلاء الماليين — جلب تلقائي وإرسال طلبات الإيداع المباشرة
// ========================================================================

let loadedAgentsList = [];

// جلب قائمة الوكلاء المعتمدين النشطين تلقائياً من Supabase
async function fetchAndRenderAgents() {
    const select = document.getElementById("agent-select");
    if (!select) return;

    try {
        const { data: agents, error } = await supabase.rpc('get_active_agents_list');
        
        if (error) throw error;

        if (!agents || agents.length === 0) {
            select.innerHTML = `<option value="">لا يوجد وكلاء متاحون حالياً</option>`;
            return;
        }

        loadedAgentsList = agents;
        select.innerHTML = "";

        agents.forEach(agent => {
            const opt = document.createElement("option");
            opt.value = agent.id;
            opt.textContent = agent.name;
            select.appendChild(opt);
        });

        onAgentChanged();
    } catch (err) {
        console.error("Fetch Agents Error:", err);
        select.innerHTML = `<option value="">فشل تحميل الوكلاء</option>`;
    }
}

// تحديث بطاقة بيانات الوكيل ورابط الواتساب عند تغيير الاختيار
function onAgentChanged() {
    const select = document.getElementById("agent-select");
    if (!select || loadedAgentsList.length === 0) return;

    const selectedId = select.value;
    const agent = loadedAgentsList.find(a => a.id === selectedId) || loadedAgentsList[0];
    if (!agent) return;

    const nameEl = document.getElementById("agent-display-name");
    const phoneEl = document.getElementById("agent-display-phone");
    const waBtn = document.getElementById("agent-whatsapp-btn");

    if (nameEl) nameEl.textContent = agent.name;
    if (phoneEl) phoneEl.textContent = agent.phone || "رقم الهاتف غير مسجل";

    if (waBtn) {
        if (agent.phone) {
            let cleanPhone = agent.phone.replace(/[^0-9]/g, '');
            if (cleanPhone.startsWith('0')) {
                cleanPhone = '963' + cleanPhone.substring(1);
            }
            const clientName = document.getElementById("live-client-name")?.textContent || "عميل SHIIFT X";
            const amountVal = document.getElementById("sub-form-amount-select")?.value || "";
            
            const msg = encodeURIComponent(
                `مرحباً ${agent.name}، أود شحن رصيد في SHIIFT X.\n` +
                `• العميل: ${clientName}\n` +
                (amountVal ? `• المبلغ المطلوب: $${amountVal}\n` : '') +
                `أرجو تزويدي بتفاصيل الدفع المناسبة لتأكيد الطلب.`
            );
            waBtn.href = `https://wa.me/${cleanPhone}?text=${msg}`;
            waBtn.classList.remove('pointer-events-none', 'opacity-50');
        } else {
            waBtn.href = "#";
            waBtn.classList.add('pointer-events-none', 'opacity-50');
        }
    }
}

// دالة تحديد المبالغ السريعة
function setPresetAmount(val, btn) {
    const input = document.getElementById("sub-form-amount-select");
    if (input) input.value = val;
    document.querySelectorAll('.amount-preset-btn').forEach(b => {
        b.classList.remove('border-blue-500', 'text-blue-600', 'dark:text-blue-400');
    });
    if (btn) btn.classList.add('border-blue-500', 'text-blue-600', 'dark:text-blue-400');
    onAgentChanged();
}

// إرسال طلب الشحن وحفظه في deposit_orders بانتظار اعتماد الوكيل
async function submitAgentDepositRequest() {
    const agentSelect = document.getElementById("agent-select");
    const amountInput = document.getElementById("sub-form-amount-select");
    const receiptInput = document.getElementById("sub-form-tx-number");
    const btn = document.getElementById("sub-deposit-final-btn");

    const agentId = agentSelect ? agentSelect.value : null;
    const amount = parseFloat(amountInput ? amountInput.value : 0);
    const receiptNum = receiptInput ? receiptInput.value.trim() : "";

    if (!agentId) {
        return (typeof showCustomAlert === 'function') ? showCustomAlert("يرجى اختيار الوكيل المعتمد أولاً.") : alert("يرجى اختيار الوكيل المعتمد أولاً.");
    }
    if (isNaN(amount) || amount <= 0) {
        return (typeof showCustomAlert === 'function') ? showCustomAlert("يرجى إدخال مبلغ شحن صحيح.") : alert("يرجى إدخال مبلغ شحن صحيح.");
    }

    btn.disabled = true;
    const origHtml = btn.innerHTML;
    btn.innerHTML = `<i class="ph ph-circle-notch animate-spin text-lg"></i> <span>جاري إرسال الطلب للوكيل...</span>`;

    try {
        const { data, error } = await supabase.rpc('customer_submit_agent_deposit', {
            p_agent_id: agentId,
            p_amount: amount,
            p_receipt_num: receiptNum || "دفع نقدي كاش"
        });

        if (error) throw error;

        if (data && data.status === 'success') {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert(data.message, false);
            } else {
                alert(data.message);
            }
            if (amountInput) amountInput.value = "";
            if (receiptInput) receiptInput.value = "";
            if (typeof silentSyncData === 'function') silentSyncData();
        } else {
            alert(data?.message || "فشل إرسال الطلب.");
        }
    } catch (err) {
        console.error("Submit Request Error:", err);
        alert("خطأ: " + (err.message || err));
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
}

// تشغيل جلب الوكلاء فور تحميل المستند
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", fetchAndRenderAgents);
} else {
    fetchAndRenderAgents();
}
