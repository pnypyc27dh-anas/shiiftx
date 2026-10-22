// ========================================================================
// SHIIFT X — وحدة المعاملات المالية والفواتير (Ledger & Receipts)
// ========================================================================

// 1. قاموس إعدادات أنواع المعاملات والأيقونات والألوان
const TX_OP_CONFIG = {
    'Deposit': { label: 'إيداع رصيد', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50', icon: 'ph-bold ph-arrow-down-left' },
    'شحن رصيد': { label: 'إيداع رصيد', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50', icon: 'ph-bold ph-arrow-down-left' },
    'Purchase Digital Code': { label: 'شراء كود رقمي', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/50', icon: 'ph-bold ph-barcode' },
    'شراء كود رقمي': { label: 'شراء كود رقمي', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/50', icon: 'ph-bold ph-barcode' },
    'Direct ID Top-up': { label: 'شحن مباشر (ID)', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-900/50', icon: 'ph-bold ph-game-controller' },
    'شحن مباشر (ID)': { label: 'شحن مباشر (ID)', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-900/50', icon: 'ph-bold ph-game-controller' },
    'Refund': { label: 'استرجاع رصيد', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50', icon: 'ph-bold ph-arrow-u-up-left' },
    'استرجاع رصيد': { label: 'استرجاع رصيد', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50', icon: 'ph-bold ph-arrow-u-up-left' },
    'Agent Wallet Transfer': { label: 'تحويل وكيل صادر', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/50', icon: 'ph-bold ph-paper-plane-tilt' },
    'Agent Financial Commission': { label: 'عمولة وكيل مالي', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/50', icon: 'ph-bold ph-seal-percent' },
    'Marketing Partner Commission': { label: 'أرباح شريك تسويقي', color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-900/50', icon: 'ph-bold ph-megaphone' },
    'Commission Payout': { label: 'صرف أرباح كاش', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/50', icon: 'ph-bold ph-money' }
};

// 2. المزامنة الدورية الهادئة للرصيد، الصلاحيات، وسجل العمليات
async function silentSyncData() { 
    if (!currentUser) return;
    
    // جلب ملف المستخدم وتحديث الصلاحيات
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

    const isRefund = tx.type === 'Refund' || tx.type === 'استرجاع رصيد';
    const isDeposit = tx.type === 'Deposit' || tx.type === 'شحن رصيد';
    const isAgentTransferOut = tx.type === 'Agent Wallet Transfer';
    const isAgentCommission = tx.type === 'Agent Financial Commission';
    const isPartnerCommission = tx.type === 'Marketing Partner Commission' || tx.type === 'Affiliate Commission';
    const isCommission = isAgentCommission || isPartnerCommission;

    const isRefundedOrder = statusKey === 'refunded' || statusKey === 'مسترجع';
    const isPending = statusKey === 'pending' || statusKey === 'معلق';
    const isRejected = statusKey === 'rejected' || statusKey === 'cancelled' || statusKey === 'مرفوض' || statusKey === 'ملغي' || statusKey === 'ملغاة';
    const isCompleted = statusKey === 'completed' || statusKey === 'approved' || statusKey === 'مكتمل' || statusKey === 'مقبول';

    let rawDetails = tx.details || '';
    let cancelReason = rawTx.rejection_reason || rawTx.reason || '';
    let discountInfo = '';

    // البحث بمرونة عن سبب الرفض أو الإلغاء سواء كان بين أقواس مربعة [...] أو دائرية (...)
    if (!cancelReason) {
        const refMatch = rawDetails.match(/[\[\(](?:مسترجع|مرفوض|سبب الرفض|سبب|ملغاة|ملغي):\s*([^\]\)]+)[\]\)]/);
        if (refMatch) cancelReason = refMatch[1].trim();
    }

    const discMatch = rawDetails.match(/\(خصم كود\s*([^)]+)\)/);
    if (discMatch) discountInfo = discMatch[1].trim();

    let playerId = tx.player_id || rawTx.player_id;
    const idMatch = rawDetails.match(/ID:\s*([^\s)]+)/i);
    if (!playerId && idMatch) playerId = idMatch[1];

    // تنظيف اسم الباقة مع دعم الأقواس بنوعيها وإزالة وسوم الملاحظات ووسوم الإلغاء
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

    if (isAgentTransferOut) {
        platformName = 'نظام الوكيل المالي (Agents)';
        packageName = rawDetails || 'تحويل رصيد رقمي صادر لعميل';
    } else if (isAgentCommission) {
        platformName = 'مكافآت الوكيل المالي (Agents)';
        packageName = rawDetails || 'عمولة تحويل رصيد رقمي لعميل';
    } else if (isPartnerCommission) {
        platformName = 'برنامج الشريك التسويقي (Partner)';
        packageName = rawDetails || 'أرباح عمولة من كود الخصم التسويقي';
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
            packageName = 'شحن رصيد المحفظة';
        } else if (isDeposit) {
            platformName = 'قنوات الدفع المعتمدة';
            packageName = rawDetails || 'تمويل رصيد الحساب';
        } else if (isRefund) {
            platformName = 'محفظة SHIIFTX';
            packageName = cleanPackageName || 'استرداد نقدي لطلب ملغي';
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
    const opLabel = isRefundedOrder ? 'شحن مباشر (ID)' : opConfig.label;

    let statusPill = '';
    if (isPending) {
        statusPill = `<span class="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/70 dark:border-amber-900/50 animate-pulse">
            <i class="ph-bold ph-hourglass-medium"></i> قيد التدقيق
        </span>`;
    } else if (isRefundedOrder) {
        statusPill = `<span class="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/50">مرفوض</span>`;
    } else if (isRejected) {
        const rejectText = (statusKey === 'cancelled' || statusKey === 'ملغي' || statusKey === 'ملغاة') ? 'ملغي' : 'مرفوض';
        statusPill = `<span class="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200/70 dark:border-red-900/50">${rejectText}</span>`;
    } else {
        statusPill = `<span class="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-900/50">مكتمل</span>`;
    }

    let amountHtml = '';
    if (isDeposit || isRefund || isCommission) {
        if (isPending) {
            amountHtml = `<div class="text-left font-mono">
                <span class="text-base font-black text-amber-600 dark:text-amber-400">+$${numAmount.toFixed(2)}</span>
                <span class="block text-[9px] text-slate-400">بانتظار التأكيد</span>
            </div>`;
        } else if (isRejected) {
            const subLabel = isCommission ? 'عمولة ملغاة' : 'لم يتم الإيداع';
            amountHtml = `<div class="text-left font-mono">
                <span class="text-sm font-bold text-slate-400 line-through">+$${numAmount.toFixed(2)}</span>
                <span class="block text-[9px] text-rose-500">${subLabel}</span>
            </div>`;
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

    const txRef = tx.tx_id || rawTx.transaction_ref || '---';
    let chipsHtml = `
        <div class="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400 pt-0.5 font-sans">
            <span class="font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded select-all cursor-pointer hover:bg-slate-200" onclick="event.stopPropagation(); copyToClipboard('${txRef}')" title="انقر لنسخ المرجع">${txRef}</span>
            <span>•</span>
            <span>${tx.date.split(',')[0]}</span>
            ${playerId ? `<span>•</span> <span class="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/40" dir="ltr">${isDeposit ? 'إشعار: ' : 'ID: '}${playerId}</span>` : ''}
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

    let cancelAlertHtml = '';
    if (cancelReason || isRejected || isRefundedOrder) {
        const displayReason = cancelReason || (isCommission ? 'تم إلغاء العمولة لإلغاء الطلب الأساسي' : 'تم رفض العملية من قبل الإدارة');
        
        let noteText = '';
        if (isCommission) {
            noteText = ''; // لا يضاف نص استرجاع رصيد للمسوق لأنه لم يدفع شيئاً
        } else if (!isDeposit) {
            noteText = ' (أعيد المبلغ لمحفظتك)';
        }

        const labelText = isCommission ? 'سبب الإلغاء:' : 'سبب الرفض:';

        cancelAlertHtml = `
            <div class="mt-2 p-2 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 flex items-center gap-1.5 text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                <i class="ph-fill ph-warning-circle text-xs shrink-0"></i>
                <span>${labelText} ${displayReason}${noteText}</span>
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
    const isCredit = tx.type === 'Refund' || tx.type === 'استرجاع رصيد' || tx.type === 'Deposit' || tx.type === 'شحن رصيد' || tx.type === 'Agent Financial Commission' || tx.type === 'Marketing Partner Commission' || tx.type === 'Affiliate Commission';

    let statusLabel = 'مؤكدة ومكتملة ✓';
    let statusClass = 'text-emerald-600 dark:text-emerald-400';

    if (statusKey === 'pending' || statusKey === 'معلق') {
        statusLabel = 'قيد المراجعة والتدقيق ⏳';
        statusClass = 'text-amber-600 dark:text-amber-400 animate-pulse';
    } else if (statusKey === 'refunded' || statusKey === 'مسترجع') {
        statusLabel = 'مستردة بالكامل';
        statusClass = 'text-rose-500';
    } else if (statusKey === 'rejected' || statusKey === 'cancelled' || statusKey === 'مرفوض' || statusKey === 'ملغي' || statusKey === 'ملغاة') {
        statusLabel = (statusKey === 'cancelled' || statusKey === 'ملغي' || statusKey === 'ملغاة') ? 'ملغاة وغير معتمدة ✕' : 'مرفوضة وغير معتمدة ✕';
        statusClass = 'text-red-600';
    }

    const isCommissionTx = tx.type === 'Agent Financial Commission' || tx.type === 'Marketing Partner Commission' || tx.type === 'Affiliate Commission';
    const reasonTitle = isCommissionTx ? 'سبب الإلغاء:' : 'سبب الرفض:';

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
                <div class="flex justify-between"><span>المرجع:</span><span class="font-mono font-bold select-all">${ref}</span></div>
                <div class="flex justify-between"><span>التاريخ:</span><span>${dateStr}</span></div>
                <div class="flex justify-between"><span>الحالة:</span><span class="font-bold ${statusClass}">${statusLabel}</span></div>
                ${cancelReason ? `<div class="flex justify-between text-rose-500 font-bold border-t border-slate-200/50 dark:border-slate-700/50 pt-1.5"><span>${reasonTitle}</span><span>${cancelReason}</span></div>` : ''}
            </div>
            <div class="flex gap-2 pt-1">
                <button onclick="printOfficialInvoice('${ref}', '${platformName}', '${packageName}', '${amount.toFixed(2)}', '${dateStr}', '${playerId || ''}', '${statusLabel}')" class="btn-spring flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-blue-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer">
                    <i class="ph-bold ph-printer"></i>
                    <span>طباعة الفاتورة</span>
                </button>
                <button onclick="copyToClipboard('${ref}'); showCustomAlert('تم نسخ الرقم المرجعي!', false);" class="btn-spring px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer">
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
        list = list.filter(t => t.type === 'Deposit' || t.type === 'شحن رصيد' || t.delivery_type === 'WALLET_DEPOSIT');
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
        .watermark-bg {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-12deg);
            opacity: 0.025;
            pointer-events: none;
            width: 420px;
            height: auto;
            z-index: 1;
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
        .barcode-container { display: inline-block; margin-top: 6px; }
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
        <svg class="watermark-bg" viewBox="70 100 405 140" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#000000" d="M102.584 151.616C106.853 151.616 110.767 152.034 114.324 152.871C117.871 153.706 121.098 154.808 124.002 156.179L124.289 156.315L124.185 156.615L121.162 165.332L121.035 165.698L120.682 165.538C118.039 164.34 115.144 163.327 111.994 162.501H111.992C108.929 161.679 105.721 161.268 102.368 161.268C99.163 161.268 96.5183 161.754 94.4189 162.708C92.3171 163.663 90.7558 165.014 89.7178 166.756L89.7148 166.762C88.6751 168.434 88.1484 170.405 88.1484 172.689C88.1485 175.36 88.6793 177.557 89.7178 179.3C90.758 181.046 92.4705 182.63 94.8828 184.044C97.3071 185.465 100.597 187.005 104.761 188.661H104.762C109.309 190.402 113.145 192.298 116.265 194.352L116.856 194.73C119.772 196.644 121.995 198.937 123.511 201.611H123.51C125.204 204.471 126.039 208.046 126.039 212.315C126.039 217.201 124.91 221.385 122.635 224.849L122.633 224.852C120.359 228.236 117.1 230.841 112.874 232.676L112.875 232.677C108.718 234.513 103.809 235.425 98.1582 235.425C95.2674 235.425 92.4834 235.273 89.8066 234.97L89.8047 234.969C87.2021 234.666 84.8129 234.248 82.6377 233.716L82.626 233.713C80.4497 233.104 78.5209 232.38 76.8418 231.537L76.6465 231.44V220.93L77.1494 221.164C79.7146 222.36 82.8951 223.447 86.6953 224.425H86.6943C90.5515 225.399 94.5164 225.886 98.5898 225.886C102.374 225.886 105.528 225.362 108.064 224.327C110.602 223.292 112.482 221.823 113.731 219.931C114.984 218.033 115.616 215.801 115.616 213.22C115.616 210.626 115.086 208.465 114.047 206.721C113.01 204.981 111.194 203.358 108.562 201.866L108.553 201.861C105.99 200.293 102.379 198.642 97.7109 196.909L97.707 196.907C94.3838 195.619 91.452 194.253 88.915 192.809L88.9043 192.803C86.4318 191.278 84.3524 189.557 82.6709 187.64C80.9858 185.719 79.7044 183.529 78.8262 181.073L78.8223 181.064V181.063C78.0167 178.605 77.6182 175.774 77.6182 172.575C77.6182 168.214 78.6769 164.48 80.8115 161.392C82.9379 158.24 85.8691 155.823 89.5928 154.138L89.5947 154.137C93.3894 152.453 97.7216 151.616 102.584 151.616ZM156.342 152.748V186.94H195.144V152.748H205.566V234.292H195.144V196.591H156.342V234.292H145.918V152.748H156.342Z"/>
            <path fill="#000000" d="M389.967 151.616V161.519H350.874V190.257H387.563V200.159H350.874V235.425H338.781V151.616H389.967ZM467.7 151.616V161.519H439.615V235.425H427.521V161.519H399.308V151.616H467.7Z"/>
            <path fill="#000000" d="M234.632 132.734L234.737 132.895L270.402 187.555L270.537 187.763L270.388 187.961L234.723 235.284L234.616 235.425H212.435L212.827 234.867L246.018 187.733L212.815 133.272L212.487 132.734H234.632ZM332.739 132.734L332.41 133.272L299.206 187.733L332.398 234.867L332.79 235.425H310.609L310.502 235.284L274.837 187.961L274.688 187.763L274.823 187.555L310.489 132.895L310.593 132.734H332.739ZM225.717 104.646C229.012 104.647 231.91 105.552 234.396 107.37C237.099 109.098 238.429 111.887 238.429 115.655C238.429 119.302 237.094 122.079 234.406 123.931L234.406 123.932C231.918 125.755 229.017 126.664 225.717 126.664C222.102 126.664 219.037 125.76 216.542 123.932C214.011 122.077 212.763 119.296 212.763 115.655C212.763 111.893 214.007 109.103 216.552 107.371C219.045 105.548 222.107 104.646 225.717 104.646ZM319.508 104.646C323.118 104.646 326.181 105.548 328.673 107.371L328.907 107.537C331.294 109.279 332.462 112.011 332.462 115.655C332.462 119.296 331.214 122.077 328.683 123.932C326.189 125.76 323.123 126.664 319.508 126.664C316.208 126.664 313.307 125.755 310.819 123.932V123.931C308.13 122.079 306.796 119.301 306.796 115.655C306.796 111.888 308.126 109.098 310.828 107.37C313.314 105.552 316.213 104.647 319.508 104.646Z"/>
        </svg>
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
                    <div class="ref-number">${safeRef}</div>
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
