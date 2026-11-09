// =========================================================================
// SHIIFT X - لوحة المشرف والرقابة المركزية الشاملة (Admin Central Controller)
// يدعم الوضعين: النهاري (Light Mode) والليلي (Dark Mode) بأعلى درجات التباين
// =========================================================================

// تعريف دالة الحماية المركزية في النطاق العام
window.escapeHTML = function(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

let currentAdmin = null;
let allProductsCache = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. التحقق الصارم من جلسة المشرف
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session) {
        window.location.replace('index.html');
        return;
    }

    const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (profErr || !profile || profile.role !== 'admin') {
        alert('غير مصرح لك بالوصول: هذه اللوحة مخصصة للإدارة العليا فقط.');
        window.location.replace('index.html');
        return;
    }

    currentAdmin = profile;

    // 2. تحميل مؤشرات الأداء والشارات
    await loadKPIs();

    // 3. ربط أحداث النماذج والنوافذ المنبثقة
    setupAdminEventListeners();

    // 4. تحميل التبويب المبدئي
    await loadPendingOrders();
});

// =========================================================================
// 1. نظام التنقل السلس بين التبويبات (Tabs Switching)
// =========================================================================
// دالة التبديل بين التبويبات الموحدة لجميع الأقسام
window.switchTab = function(tabName) {
    // قائمة بكافة التبويبات الرسمية في اللوحة
    const tabs = ['orders', 'deposits', 'inventory', 'products', 'affiliates', 'agents', 'api-partners', 'wallet'];

    tabs.forEach(t => {
        const sec = document.getElementById(`sec-${t}`);
        const btn = document.getElementById(`tab-${t}`);

        if (t === tabName) {
            // إظهار القسم النشط وتفعيل زره
            if (sec) sec.classList.remove('hidden');
            if (btn) {
                btn.classList.add('bg-slate-900', 'text-white', 'dark:bg-white', 'dark:text-slate-900');
                btn.classList.remove('bg-white', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-slate-300');
            }
        } else {
            // إخفاء الأقسام غير النشطة وإلغاء تفعيل أزرارها
            if (sec) sec.classList.add('hidden');
            if (btn) {
                btn.classList.remove('bg-slate-900', 'text-white', 'dark:bg-white', 'dark:text-slate-900');
                btn.classList.add('bg-white', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-slate-300');
            }
        }
    });

    // استدعاء دوال تحميل البيانات بحسب التبويب المختار
    if (tabName === 'orders' && typeof loadPendingOrders === 'function') loadPendingOrders();
    if (tabName === 'deposits' && typeof loadDepositsAuditTab === 'function') loadDepositsAuditTab();
    if (tabName === 'inventory' && typeof loadInventoryData === 'function') loadInventoryData();
    if (tabName === 'products' && typeof loadProducts === 'function') loadProducts();
    if (tabName === 'affiliates' && typeof loadAffiliatesData === 'function') loadAffiliatesData();
    if (tabName === 'agents' && typeof loadAgentsData === 'function') loadAgentsData();
    if (tabName === 'api-partners' && typeof loadApiPartnersData === 'function') loadApiPartnersData();
};

window.loadAllAdminData = async function() {
    await loadKPIs();
    await loadPendingOrders();
    if (typeof loadDepositsAuditTab === 'function') loadDepositsAuditTab();
    if (typeof loadInventoryData === 'function') loadInventoryData();
};

window.handleLogout = async function() {
    await supabase.auth.signOut();
    window.location.replace('index.html');
};

// =========================================================================
// 2. مؤشرات الأداء العامة (KPIs)
// =========================================================================
window.loadKPIs = async function() {
    try {
        const { data: kpis, error } = await supabase.rpc('admin_get_kpis');
        if (error) throw error;

        if (kpis) {
            const elToday = document.getElementById('kpi-sales-today');
            const elMonth = document.getElementById('kpi-sales-month');
            const elComm = document.getElementById('kpi-commissions');
            const elBal = document.getElementById('kpi-balances');
            const elBadgeOrders = document.getElementById('badge-orders-count');
            const elBadgeDeposits = document.getElementById('badge-deposits-count');

            if (elToday) elToday.textContent = `$${Number(kpis.sales_today || 0).toFixed(2)}`;
            if (elMonth) elMonth.textContent = `$${Number(kpis.sales_month || 0).toFixed(2)}`;
            if (elComm) elComm.textContent = `$${Number(kpis.total_commissions || 0).toFixed(2)}`;
            if (elBal) elBal.textContent = `$${Number(kpis.customer_balances || 0).toFixed(2)}`;

            if (elBadgeOrders) {
                elBadgeOrders.textContent = kpis.pending_orders;
                elBadgeOrders.classList.toggle('hidden', !kpis.pending_orders || kpis.pending_orders === 0);
            }
            if (elBadgeDeposits) {
                elBadgeDeposits.textContent = kpis.pending_deposits;
                elBadgeDeposits.classList.toggle('hidden', !kpis.pending_deposits || kpis.pending_deposits === 0);
            }
        }
    } catch (err) {
        console.warn('تنبيه: تعذر جلب المؤشرات المالية:', err.message);
    }
};

// =========================================================================
// 3. تبويب طلبات شحن الـ ID ورصيد الهاتف المعلقة (مع جلب اسم المنصة)
// =========================================================================
window.loadPendingOrders = async function() {
    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400"><i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-indigo-500"></i><p>جاري تحميل طلبات الشحن المعلقة...</p></td></tr>`;

    try {
        // 1. جلب المعاملات المعلقة للشحن المباشر
        const { data: txs, error: txErr } = await supabase
            .from('transactions')
            .select('*')
            .eq('status', 'pending')
            .eq('delivery_type', 'DIRECT_ID')
            .order('created_at', { ascending: false });

        if (txErr) throw txErr;

        const badge = document.getElementById('badge-orders-count');
        if (badge) {
            badge.textContent = txs?.length || 0;
            badge.classList.toggle('hidden', !txs || txs.length === 0);
        }

        if (!txs || txs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400">لا توجد طلبات معلقة حالياً ✓</td></tr>`;
            return;
        }

        // 2. جلب بيانات الطلبات المرتبطة
        const refs = txs.map(t => t.transaction_ref);
        const { data: orders } = await supabase.from('orders').select('*').in('transaction_ref', refs);
        const ordersMap = new Map((orders || []).map(o => [o.transaction_ref, o]));

        // 3. جلب أسماء المنصات التابعة للمنتجات لضمان دقة العرض
        const prodIds = [...new Set((orders || []).map(o => o.product_id).filter(Boolean))];
        let prodMap = new Map();
        if (prodIds.length > 0) {
            const { data: prods } = await supabase.from('products').select('id, platform').in('id', prodIds);
            prodMap = new Map((prods || []).map(p => [p.id, p.platform]));
        }

        // 4. توليد صفوف الجدول متضمنة عمود المنصة
        tbody.innerHTML = txs.map(tx => {
            const ord = ordersMap.get(tx.transaction_ref);
            const playerId = ord?.player_id || ord?.custom_inputs?.player_id || tx.details?.match(/ID:\s*([^\s,]+)/i)?.[1] || '—';
            const packageName = ord?.package_name || tx.details?.replace(/\[.*?\]/g, '').trim() || 'باقة شحن';
            
            // استخراج اسم المنصة بمرونة تامة
            const platformName = ord?.platform || (ord?.product_id ? prodMap.get(ord.product_id) : null) || (tx.details?.match(/\[(.*?)\]/)?.[1]) || 'منصة رقمية';

            return `
                <tr class="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-xs text-slate-700 dark:text-slate-300">
                    <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${tx.transaction_ref}</td>
                    <td class="py-3 px-4">
                        <span class="inline-block px-2.5 py-1 rounded-lg text-xs font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            ${platformName}
                        </span>
                    </td>
                    <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">${packageName}</td>
                    <td class="py-3 px-4 font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/30 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800/50">${playerId}</td>
                    <td class="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">$${Number(tx.amount).toFixed(2)}</td>
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <button onclick="processIDOrder('${tx.id}', 'complete')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shadow-sm transition-all cursor-pointer">
                                تم الشحن ✓
                            </button>
                            <button onclick="processIDOrder('${tx.id}', 'refund')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300 dark:border-rose-800 rounded-lg text-xs font-semibold transition-all cursor-pointer">
                                رفض وإرجاع
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-rose-500 text-xs text-center">تعذر تحميل الطلبات: ${err.message}</td></tr>`;
    }
};

window.processIDOrder = async function(txId, action) {
    let reason = '';
    if (action === 'refund') {
        reason = prompt('أدخل سبب رفض الطلب (سيظهر للعميل وسيتم إرجاع الرصيد لمحفظته):', 'معرف الحساب غير صالح');
        if (reason === null) return;
    } else {
        if (!confirm('تأكيد إتمام الشحن بنجاح لحساب اللاعب؟')) return;
    }

    try {
        const { data, error } = await supabase.rpc('admin_process_order', {
            p_tx_id: txId,
            p_action: action,
            p_reason: reason
        });

        if (error) throw error;
        if (data && data.status === 'error') {
            alert(data.message);
            return;
        }

        alert(data?.message || 'تم تحديث حالة الطلب بنجاح ✓');
        await loadPendingOrders();
        await loadKPIs();
    } catch (err) {
        alert('فشل تنفيذ العملية: ' + err.message);
    }
};

// =========================================================================
// 4. تبويب سجل الإيداعات الرقابي (بتنسيق بصري منظم ومتناسق)
// =========================================================================
window.loadDepositsAuditTab = async function() {
    const tbody = document.getElementById('deposits-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400"><i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-indigo-500"></i><p>جاري تحميل السجل الرقابي للإيداعات...</p></td></tr>`;

    try {
        const { data: records, error } = await supabase.rpc('admin_get_deposits_audit');
        if (error) throw error;

        const pendingCount = (records || []).filter(r => r.status === 'pending').length;
        const badge = document.getElementById('badge-deposits-count');
        if (badge) {
            badge.textContent = pendingCount;
            badge.classList.toggle('hidden', pendingCount === 0);
        }

        if (!records || records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-xs text-slate-400 dark:text-slate-500 font-bold">لا توجد طلبات إيداع مسجلة.</td></tr>`;
            return;
        }

        // دالة مساعدة لتنسيق التاريخ والوقت بوضوح وأناقة
        const formatDateTime = (dateStr) => {
            if (!dateStr) return '<span class="text-slate-300 dark:text-slate-600 font-mono text-center block text-sm">—</span>';
            const d = new Date(dateStr);
            const date = d.toLocaleDateString('en-GB'); // DD/MM/YYYY
            const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
            return `
                <div class="font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap leading-tight">
                    <span>${date}</span>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">${time}</span>
                </div>
            `;
        };

        tbody.innerHTML = records.map(r => {
            // شارة الحالة (محمية من الانكسار)
            let statusBadge = '';
            if (r.status === 'approved' || r.status === 'completed') {
                statusBadge = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50 whitespace-nowrap">
                        <i class="ph-bold ph-check text-xs"></i>
                        <span>معتمد</span>
                    </span>`;
            } else if (r.status === 'pending') {
                statusBadge = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50 whitespace-nowrap animate-pulse">
                        <i class="ph-bold ph-hourglass-medium text-xs"></i>
                        <span>معلق</span>
                    </span>`;
            } else {
                statusBadge = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50 whitespace-nowrap">
                        <i class="ph-bold ph-x text-xs"></i>
                        <span>مرفوض</span>
                    </span>`;
            }

            const isAgent = r.processed_by_role === 'agent';
            const roleBadge = isAgent 
                ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 shrink-0">وكيل كاش</span>'
                : '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 shrink-0">إدارة</span>';

            const methodTitle = r.payment_method === 'CASH_AGENT' ? 'دفع عبر وكيل معتمد' : (r.payment_method || 'شحن رصيد');

            return `
                <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors text-xs text-slate-700 dark:text-slate-300">
                    
                    <!-- 1. الرقم المرجعي (محمي من الانقسام لسطرين) -->
                    <td class="py-3.5 px-3 whitespace-nowrap align-middle">
                        <span class="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 px-2 py-1 rounded-md border border-slate-200/80 dark:border-slate-700/60 text-[11px] select-all tracking-wider">
                            ${r.transaction_ref}
                        </span>
                    </td>

                    <!-- 2. بيانات العميل -->
                    <td class="py-3.5 px-3 align-middle">
                        <div class="font-black text-slate-900 dark:text-white text-xs leading-snug">${r.customer_name}</div>
                        <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>${r.customer_email}</span>
                            ${r.customer_phone ? `<span>•</span><span class="font-mono text-slate-500 dark:text-slate-400 font-bold" dir="ltr">${r.customer_phone}</span>` : ''}
                        </div>
                    </td>

                    <!-- 3. المبلغ المالي -->
                    <td class="py-3.5 px-3 whitespace-nowrap align-middle">
                        <span class="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                            $${Number(r.amount).toFixed(2)}
                        </span>
                    </td>

                    <!-- 4. طريقة الدفع ورقم الإشعار -->
                    <td class="py-3.5 px-3 align-middle">
                        <div class="font-bold text-slate-800 dark:text-slate-200 text-xs">${methodTitle}</div>
                        <div class="mt-1">
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 select-all">
                                <span class="text-slate-400 font-sans">إشعار:</span>
                                <strong class="font-bold">${r.receipt_num || '—'}</strong>
                            </span>
                        </div>
                    </td>

                    <!-- 5. الحالة -->
                    <td class="py-3.5 px-3 whitespace-nowrap align-middle">
                        ${statusBadge}
                    </td>

                    <!-- 6. المعالج / الوكيل المختار -->
                    <td class="py-3.5 px-3 align-middle">
                        <div class="flex items-center gap-1.5">
                            ${roleBadge}
                            <span class="font-bold text-slate-800 dark:text-slate-200 text-xs leading-tight">${r.processed_by_name}</span>
                        </div>
                        ${r.rejection_reason ? `<div class="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-1">سبب الرفض: ${r.rejection_reason}</div>` : ''}
                    </td>

                    <!-- 7. تاريخ الطلب -->
                    <td class="py-3.5 px-3 whitespace-nowrap align-middle">
                        ${formatDateTime(r.created_at)}
                    </td>

                    <!-- 8. تاريخ التنفيذ -->
                    <td class="py-3.5 px-3 whitespace-nowrap align-middle">
                        ${formatDateTime(r.processed_at)}
                    </td>

                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-rose-500 text-xs text-center font-bold">تعذر تحميل السجل: ${err.message}</td></tr>`;
    }
};

// =========================================================================
// 5. تبويب مخزون الأكواد الرقمية (Code Inventory)
// =========================================================================
window.loadInventoryData = async function() {
    const tbody = document.getElementById('inventory-tbody');
    const select = document.getElementById('restock-product-select');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400"><i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-indigo-500"></i><p>جاري فحص مخزون الأكواد...</p></td></tr>`;

    try {
        const { data: products, error: pErr } = await supabase
            .from('products')
            .select('*')
            .eq('product_type', 'CODE')
            .order('platform');

        if (pErr) throw pErr;

        const { data: codes, error: cErr } = await supabase
            .from('code_inventory')
            .select('product_id, status');

        if (cErr) throw cErr;

        const countMap = {};
        (codes || []).forEach(c => {
            if (!countMap[c.product_id]) countMap[c.product_id] = { available: 0, sold: 0 };
            if (c.status === 'available') countMap[c.product_id].available++;
            if (c.status === 'sold') countMap[c.product_id].sold++;
        });

        if (select) {
            select.innerHTML = '<option value="" disabled selected>اختر الباقة المراد تزويدها...</option>' + 
                (products || []).map(p => {
                    const counts = countMap[p.id] || { available: 0, sold: 0 };
                    return `<option value="${p.id}" data-stock="${counts.available}">[${p.platform}] ${p.package_name} - ($${Number(p.price).toFixed(2)}) — [متوفر: ${counts.available}]</option>`;
                }).join('');
        }

        if (!products || products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400">لا توجد باقات من نوع كود رقمي مضافة في المنصة.</td></tr>`;
            return;
        }

        tbody.innerHTML = products.map(p => {
            const counts = countMap[p.id] || { available: 0, sold: 0 };
            const stockColor = counts.available > 5 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : (counts.available > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400');

            return `
                <tr class="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-xs text-slate-700 dark:text-slate-300">
                    <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${p.platform}</td>
                    <td class="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">${p.package_name}</td>
                    <td class="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">$${Number(p.price).toFixed(2)}</td>
                    <td class="py-3 px-4 font-mono font-bold ${stockColor}">${counts.available} كود</td>
                    <td class="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">${counts.sold} كود</td>
                    <td class="py-3 px-4">
                        <button onclick="quickSelectRestock('${p.id}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-800 rounded-lg text-xs font-semibold transition-all">
                            تعبئة مخزون ➕
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-rose-500 text-xs text-center">تعذر تحميل بيانات المخزون: ${err.message}</td></tr>`;
    }
};

window.quickSelectRestock = function(productId) {
    const select = document.getElementById('restock-product-select');
    if (select) {
        select.value = productId;
        updateSelectedStockBadge();
        select.scrollIntoView({ behavior: 'smooth', block: 'center' });
        select.focus();
    }
};

// 1. تحديث العداد الحي للأكواد الملصقة فورياً
window.updateCodesCountLive = function() {
    const textarea = document.getElementById('restock-codes');
    const badge = document.getElementById('codes-count-badge');
    if (!textarea || !badge) return;

    const lines = textarea.value
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length >= 3);

    badge.innerText = `${lines.length} كود`;
};

// 2. تحديث شارة المخزون الحالي للباقة المختارة
window.updateSelectedStockBadge = function() {
    const select = document.getElementById('restock-product-select');
    const badge = document.getElementById('selected-stock-badge');
    if (!select || !badge) return;

    const opt = select.selectedOptions[0];
    const available = opt ? opt.getAttribute('data-stock') : null;

    if (available !== null && available !== undefined) {
        badge.innerHTML = `<span class="text-slate-500 dark:text-slate-400">المخزون الحالي: </span><span class="font-bold text-emerald-600 dark:text-emerald-400">${available} كود</span>`;
    } else {
        badge.innerHTML = '';
    }
};

// 3. معالجة إرسال نموذج تعبئة الأكواد
window.handleRestockSubmit = async function(event) {
    if (event) event.preventDefault();

    const prodSelect = document.getElementById('restock-product-select');
    const codesInput = document.getElementById('restock-codes');
    const btnRestock = document.getElementById('btn-restock-submit');

    const prodId = prodSelect?.value;
    const codesText = codesInput?.value.trim();

    if (!prodId) {
        alert('يرجى اختيار الباقة المراد تعبئة أكوادها أولاً.');
        return;
    }
    if (!codesText) {
        alert('يرجى كتابة أو لصق الأكواد في الصندوق.');
        return;
    }

    const lines = codesText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length >= 3);
    if (lines.length === 0) {
        alert('لم يتم العثور على أكواد صالحة للإدخال.');
        return;
    }

    const origBtnHtml = btnRestock.innerHTML;
    btnRestock.disabled = true;
    btnRestock.innerHTML = `<i class="ph ph-circle-notch animate-spin text-sm"></i> <span>جاري إيداع الأكواد (${lines.length})...</span>`;

    try {
        const { data, error } = await supabase.rpc('admin_add_inventory_codes', {
            p_product_id: prodId,
            p_codes_text: codesText
        });

        if (error) throw error;
        if (data && data.status === 'error') {
            alert(data.message);
            return;
        }

        alert(data?.message || 'تمت إضافة الأكواد بنجاح ✓');
        codesInput.value = '';
        updateCodesCountLive();
        await loadInventoryData();
        await loadProducts();
    } catch (err) {
        alert('فشل إضافة الأكواد: ' + err.message);
    } finally {
        btnRestock.disabled = false;
        btnRestock.innerHTML = origBtnHtml;
    }
};

// =========================================================================
// 6. تبويب المنصات والباقات (Products Management)
// =========================================================================
window.loadProducts = async function() {
    const tbody = document.getElementById('products-tbody');
    const filter = document.getElementById('products-platform-filter');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400"><i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-indigo-500"></i><p>جاري تحميل الباقات والمنتجات...</p></td></tr>`;

    try {
        const { data: prods, error } = await supabase
            .from('products')
            .select('*')
            .order('platform');

        if (error) throw error;
        allProductsCache = prods || [];

        if (filter) {
            const platforms = [...new Set(allProductsCache.map(p => p.platform).filter(Boolean))];
            const currentFilter = filter.value;
            filter.innerHTML = '<option value="ALL">جميع المنصات</option>' + 
                platforms.map(pl => `<option value="${pl}" ${pl === currentFilter ? 'selected' : ''}>${pl}</option>`).join('');
        }

        renderFilteredProducts();

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-rose-500 text-xs text-center">تعذر تحميل المنتجات: ${err.message}</td></tr>`;
    }
};

window.filterProductsByPlatform = function() {
    renderFilteredProducts();
};

function renderFilteredProducts() {
    const tbody = document.getElementById('products-tbody');
    const filter = document.getElementById('products-platform-filter');
    if (!tbody) return;

    const selectedPl = filter?.value;
    const list = (selectedPl && selectedPl !== 'ALL') ? allProductsCache.filter(p => p.platform === selectedPl) : allProductsCache;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400">لا توجد باقات معروضة.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(p => `
        <tr class="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-xs text-slate-700 dark:text-slate-300">
            <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${p.platform}</td>
            <td class="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">${p.package_name}</td>
            <td class="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">$${Number(p.price).toFixed(2)}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${p.product_type === 'ID' ? 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800' : 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800'}">
                    ${p.product_type}
                </span>
            </td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${p.status === 'active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400'}">
                    ${p.status === 'active' ? 'نشط' : 'معطل'}
                </span>
            </td>
            <td class="py-3 px-4">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <button onclick='openEditModal(${JSON.stringify(p)})' class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-indigo-300 dark:border-slate-700 rounded-lg text-xs font-semibold transition-all">
                        تعديل
                    </button>
                    <button onclick="deleteProduct('${p.id}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300 dark:border-rose-800 rounded-lg text-xs font-semibold transition-all">
                        حذف
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.openAddModal = function() {
    const modal = document.getElementById('edit-product-modal');
    if (!modal) return;
    document.getElementById('edit-prod-id').value = '';
    document.getElementById('edit-prod-platform').value = '';
    document.getElementById('edit-prod-name').value = '';
    document.getElementById('edit-prod-price').value = '';
    document.getElementById('edit-prod-category').value = 'Games';
    document.getElementById('edit-prod-image').value = '';
    document.getElementById('edit-prod-type').value = 'CODE';
    document.getElementById('edit-prod-status').value = 'active';
    modal.classList.remove('hidden');
};

window.openEditModal = function(p) {
    const modal = document.getElementById('edit-product-modal');
    if (!modal) return;
    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('edit-prod-platform').value = p.platform;
    document.getElementById('edit-prod-name').value = p.package_name;
    document.getElementById('edit-prod-price').value = p.price;
    document.getElementById('edit-prod-category').value = p.category || 'Games';
    document.getElementById('edit-prod-image').value = p.image_url || '';
    document.getElementById('edit-prod-type').value = p.product_type || 'CODE';
    document.getElementById('edit-prod-status').value = p.status || 'active';
    modal.classList.remove('hidden');
};

window.closeProductModal = function() {
    const modal = document.getElementById('edit-product-modal');
    if (modal) modal.classList.add('hidden');
};
window.closeEditModal = window.closeProductModal;

window.deleteProduct = async function(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) return;
    try {
        const { error } = await supabase.rpc('admin_delete_product', { p_id: id });
        if (error) throw error;
        alert('تم حذف الباقة بنجاح ✓');
        await loadProducts();
    } catch (err) {
        alert('تعذر حذف الباقة: ' + err.message);
    }
};

window.handleEditProductSubmit = function(e) {
    if (e) e.preventDefault();
    document.getElementById('btn-save-edit-prod')?.click();
};

// =========================================================================
// 7. تبويب الشركاء التسويقيين (Affiliates)
// =========================================================================
window.loadAffiliatesData = async function() {
    const tbody = document.getElementById('affiliates-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400"><i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-indigo-500"></i><p>جاري تحميل الشركاء التسويقيين...</p></td></tr>`;

    try {
        const { data: coupons, error } = await supabase
            .from('coupons')
            .select('*');

        if (error) throw error;

        if (!coupons || coupons.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400">لا يوجد شركاء تسويقيين مسجلين حتى الآن.</td></tr>`;
            return;
        }

        const affIds = coupons.map(c => c.affiliate_id).filter(Boolean);
        const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, email, balance').in('id', affIds);
        const profMap = new Map((profiles || []).map(p => [p.id, p]));

        tbody.innerHTML = coupons.map(c => {
            const aff = profMap.get(c.affiliate_id);
            const name = aff ? [aff.first_name, aff.last_name].filter(Boolean).join(' ') || aff.email : 'شريك معتمد';

            return `
                <tr class="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-xs text-slate-700 dark:text-slate-300">
                    <td class="py-3 px-4">
                        <div class="font-bold text-slate-900 dark:text-white">${name}</div>
                        <div class="text-[10px] text-slate-500 dark:text-slate-400">${aff?.email || '—'}</div>
                    </td>
                    <td class="py-3 px-4 font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/50">${c.code}</td>
                    <td class="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">${c.discount_percent}%</td>
                    <td class="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">${c.affiliate_commission_percent}%</td>
                    <td class="py-3 px-4 font-mono text-center font-semibold text-slate-700 dark:text-slate-300">${c.usage_count || 0}</td>
                    <td class="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">$${Number(aff?.balance || 0).toFixed(2)}</td>
                    <td class="py-3 px-4">
                        <button onclick="deleteAffiliate('${c.affiliate_id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300 dark:border-rose-800 rounded-lg text-xs font-semibold transition-all">
                            إلغاء الشراكة
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-rose-500 text-xs text-center">تعذر تحميل الشركاء: ${err.message}</td></tr>`;
    }
};

window.openAffiliateModal = async function() {
    const modal = document.getElementById('affiliate-modal');
    const select = document.getElementById('affiliate-user-select');
    if (!modal || !select) return;

    select.innerHTML = '<option value="">جاري جلب المستخدمين...</option>';
    modal.classList.remove('hidden');

    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, role')
            .order('email');

        if (error) throw error;

        select.innerHTML = '<option value="">اختر حساب المستخدم للشراكة...</option>' + 
            users.map(u => {
                const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
                return `<option value="${u.id}">${name ? `${name} (${u.email})` : u.email}</option>`;
            }).join('');

    } catch (err) {
        select.innerHTML = `<option value="">فشل التحميل: ${err.message}</option>`;
    }
};

window.closeAffiliateModal = function() {
    const modal = document.getElementById('affiliate-modal');
    if (modal) modal.classList.add('hidden');
};

window.deleteAffiliate = async function(userId) {
    if (!confirm('هل أنت متأكد من إلغاء شراكة هذا المستخدم؟')) return;
    try {
        const { data, error } = await supabase.rpc('admin_manage_affiliate', {
            p_user_id: userId,
            p_action: 'delete'
        });
        if (error) throw error;
        if (data && data.status === 'error') {
            alert(data.message);
            return;
        }

        alert(data?.message || 'تم إلغاء الشراكة بنجاح ✓');
        await loadAffiliatesData();
    } catch (err) {
        alert('تعذر إلغاء الشراكة: ' + err.message);
    }
};

window.handleAffiliateSubmit = function(e) {
    if (e) e.preventDefault();
    document.getElementById('btn-save-affiliate')?.click();
};

// =========================================================================
// 8. تبويب الوكلاء الماليين (Agents)
// =========================================================================
window.loadAgentsTab = async function() {
    const tbody = document.getElementById('agents-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400"><i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-indigo-500"></i><p>جاري تحميل قائمة الوكلاء الماليين...</p></td></tr>`;

    try {
        const { data: agents, error } = await supabase.rpc('admin_get_all_agents');
        if (error) throw error;

        if (!agents || agents.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400">لا يوجد وكلاء ماليين مسجلين حالياً.</td></tr>`;
            return;
        }

        tbody.innerHTML = agents.map(a => {
            const rawRate = Number(a.commission_rate || 0);
            const displayRate = rawRate < 1 && rawRate > 0 ? (rawRate * 100).toFixed(0) : rawRate;

            const statusBadge = (a.status === 'active' || !a.status)
                ? '<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800 font-semibold">نشط ✓</span>'
                : '<span class="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/80 dark:text-rose-400 dark:border-rose-800 font-semibold">معطل</span>';

            return `
                <tr class="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-xs text-slate-700 dark:text-slate-300">
                    <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${a.full_name}</td>
                    <td class="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">${a.email}</td>
                    <td class="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">$${Number(a.balance || 0).toFixed(2)}</td>
                    <td class="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">${displayRate}%</td>
                    <td class="py-3 px-4">${statusBadge}</td>
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <button onclick="openAgentOpsModal('${a.agent_id}', '${a.full_name}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-indigo-300 dark:border-slate-700 rounded-lg text-xs font-semibold transition-all">
                                سجل العمليات
                            </button>
                            <button onclick="editAgentCommission('${a.agent_id}', ${displayRate})" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-800 rounded-lg text-xs font-semibold transition-all">
                                تعديل النسبة
                            </button>
                            <button onclick="removeAgent('${a.agent_id}', '${a.full_name}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300 dark:border-rose-800 rounded-lg text-xs font-semibold transition-all">
                                إلغاء الوكالة
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-rose-500 text-xs text-center">تعذر تحميل بيانات الوكلاء: ${err.message}</td></tr>`;
    }
};

window.openAgentModal = async function() {
    const modal = document.getElementById('agent-modal');
    const select = document.getElementById('agent-user-select');
    if (!modal || !select) return;

    select.innerHTML = '<option value="">جاري تحميل المستخدمين...</option>';
    modal.classList.remove('hidden');

    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, role')
            .neq('role', 'agent')
            .order('email');

        if (error) throw error;

        select.innerHTML = '<option value="">اختر الحساب لترقيته إلى وكيل...</option>' + 
            users.map(u => {
                const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
                return `<option value="${u.id}">${name ? `${name} (${u.email})` : u.email} - [${u.role}]</option>`;
            }).join('');

    } catch (err) {
        select.innerHTML = `<option value="">فشل التحميل: ${err.message}</option>`;
    }
};

window.closeAgentModal = function() {
    const modal = document.getElementById('agent-modal');
    if (modal) modal.classList.add('hidden');
};

window.editAgentCommission = async function(agentId, currentRate) {
    const newRate = prompt('أدخل نسبة العمولة الجديدة للوكيل (%):', currentRate);
    if (newRate === null) return;

    const rateNum = Number(newRate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
        alert('يرجى إدخال نسبة صحيحة بين 0 و 100');
        return;
    }

    try {
        const { data, error } = await supabase.rpc('admin_manage_agent', {
            p_user_id: agentId,
            p_action: 'update_commission',
            p_commission_rate: rateNum
        });

        if (error) throw error;
        if (data && data.status === 'error') {
            alert(data.message);
            return;
        }

        alert(data?.message || 'تم تحديث نسبة العمولة بنجاح ✓');
        await loadAgentsTab();
    } catch (err) {
        alert('تعذر تحديث النسبة: ' + err.message);
    }
};

window.removeAgent = async function(agentId, agentName) {
    const isConfirmed = confirm(`هل أنت متأكد من سحب صلاحية الوكالة المالية من (${agentName}) وإعادته إلى رتبة عميل عادي؟`);
    if (!isConfirmed) return;

    try {
        const { data, error } = await supabase.rpc('admin_manage_agent', {
            p_user_id: agentId,
            p_action: 'demote'
        });

        if (error) throw error;
        if (data && data.status === 'error') {
            alert(data.message);
            return;
        }

        alert(data?.message || 'تم إلغاء صفة الوكيل بنجاح ✓');
        await loadAgentsTab();
    } catch (err) {
        alert('فشل سحب صفة الوكيل: ' + err.message);
    }
};

window.openAgentOpsModal = async function(agentId, agentName) {
    const modal = document.getElementById('agent-ops-modal');
    const title = document.getElementById('agent-ops-modal-title');
    const list = document.getElementById('agent-modal-transactions-list');

    if (!modal || !list) return;
    if (title) title.textContent = `سجل عمليات الوكيل: ${agentName}`;
    list.innerHTML = `<div class="py-8 text-center text-xs text-slate-500 dark:text-slate-400"><i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-indigo-500"></i><p>جاري جلب سجل العمليات...</p></div>`;
    modal.classList.remove('hidden');

    try {
        const { data: txs, error } = await supabase.rpc('admin_get_agent_transactions_history', {
            p_target_agent_id: agentId
        });
        if (error) throw error;

        if (!txs || txs.length === 0) {
            list.innerHTML = '<div class="py-6 text-center text-xs text-slate-500 dark:text-slate-400">لا توجد حركات سابقة لهذا الوكيل.</div>';
            return;
        }

        list.innerHTML = txs.map(t => `
            <div class="p-3 bg-slate-50 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700/50 rounded-xl mb-2 flex justify-between items-center text-xs transition-colors">
                <div>
                    <div class="font-bold text-slate-900 dark:text-white">${t.target_user_name || 'عميل'} (${t.target_user_email || '—'})</div>
                    <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${t.notes || 'شحن رصيد'} • ${new Date(t.created_at).toLocaleString('ar-EG')}</div>
                </div>
                <div class="text-left font-mono">
                    <div class="text-sm font-bold text-emerald-600 dark:text-emerald-400">$${Number(t.amount).toFixed(2)}</div>
                    <div class="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">+${Number(t.commission_earned).toFixed(2)}$ عمولة</div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        list.innerHTML = `<p class="p-4 text-rose-500 text-xs text-center">تعذر جلب السجل: ${err.message}</p>`;
    }
};

window.closeAgentOpsModal = function() {
    const modal = document.getElementById('agent-ops-modal');
    if (modal) modal.classList.add('hidden');
};

window.handleAgentSubmit = function(e) {
    if (e) e.preventDefault();
    document.getElementById('btn-save-agent')?.click();
};

// =========================================================================
// 9. تبويب الإيداع اليدوي في المحفظة (Manual Top-up)
// =========================================================================
window.handleManualTopup = async function() {
    const emailInput = document.getElementById('topup-email');
    const amountInput = document.getElementById('topup-amount');
    const noteInput = document.getElementById('topup-note');

    const email = emailInput?.value.trim();
    const amount = Number(amountInput?.value);
    const note = noteInput?.value.trim() || 'إيداع يدوي عبر الإدارة';

    if (!email) {
        alert('يرجى إدخال البريد الإلكتروني للزبون');
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        alert('يرجى إدخال مبلغ صالح أكبر من الصفر');
        return;
    }

    if (!confirm(`تأكيد إيداع مبلغ $${amount} مباشرة في محفظة (${email})؟`)) return;

    try {
        const { data, error } = await supabase.rpc('admin_manual_topup', {
            p_email: email,
            p_amount: amount,
            p_note: note
        });

        if (error) throw error;
        if (data && data.status === 'error') {
            alert(data.message);
            return;
        }

        alert(data?.message || 'تم شحن المحفظة بنجاح ✓');
        emailInput.value = '';
        amountInput.value = '';
        noteInput.value = '';
        await loadKPIs();
    } catch (err) {
        alert('فشل الإيداع اليدوي: ' + err.message);
    }
};

// =========================================================================
// 10. ربط أحداث النماذج والنوافذ التفاعلية
// =========================================================================
function setupAdminEventListeners() {
    // 1. فلتر المنصات في تبويب المنتجات
    const filter = document.getElementById('products-platform-filter');
    if (filter) {
        filter.addEventListener('change', renderFilteredProducts);
    }

    // 2. زر حفظ / تعديل الباقة
    const btnSaveProd = document.getElementById('btn-save-edit-prod');
    if (btnSaveProd) {
        btnSaveProd.addEventListener('click', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-prod-id').value || null;
            const platform = document.getElementById('edit-prod-platform').value.trim();
            const name = document.getElementById('edit-prod-name').value.trim();
            const price = Number(document.getElementById('edit-prod-price').value);
            const category = document.getElementById('edit-prod-category').value.trim() || 'Games';
            const imageUrl = document.getElementById('edit-prod-image').value.trim() || null;
            const type = document.getElementById('edit-prod-type').value;
            const status = document.getElementById('edit-prod-status').value;

            if (!platform || !name || isNaN(price) || price <= 0) {
                alert('يرجى ملء جميع الحقول الإلزامية بالسعر المناسب');
                return;
            }

            btnSaveProd.disabled = true;
            btnSaveProd.textContent = 'جاري الحفظ...';

            try {
                const { data, error } = await supabase.rpc('admin_save_product', {
                    p_id: id,
                    p_platform: platform,
                    p_package_name: name,
                    p_price: price,
                    p_product_type: type,
                    p_category: category,
                    p_image_url: imageUrl,
                    p_status: status
                });

                if (error) throw error;
                if (data && data.status === 'error') {
                    alert(data.message);
                    return;
                }

                alert(data?.message || 'تم حفظ بيانات الباقة بنجاح ✓');
                closeProductModal();
                await loadProducts();
            } catch (err) {
                alert('فشل حفظ الباقة: ' + err.message);
            } finally {
                btnSaveProd.disabled = false;
                btnSaveProd.textContent = 'حفظ التعديلات';
            }
        });
    }

    // 3. زر حفظ شريك تسويقي
    const btnSaveAff = document.getElementById('btn-save-affiliate');
    if (btnSaveAff) {
        btnSaveAff.addEventListener('click', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('affiliate-user-select').value;
            const code = document.getElementById('affiliate-code-input').value.trim();
            const discount = Number(document.getElementById('affiliate-discount-input').value || 5);
            const comm = Number(document.getElementById('affiliate-comm-input').value || 5);

            if (!userId || !code) {
                alert('يرجى اختيار المستخدم وتحديد كود الخصم');
                return;
            }

            btnSaveAff.disabled = true;
            btnSaveAff.textContent = 'جاري الاعتماد...';

            try {
                const { data, error } = await supabase.rpc('admin_manage_affiliate', {
                    p_user_id: userId,
                    p_coupon_code: code,
                    p_discount_percent: discount,
                    p_commission_percent: comm,
                    p_action: 'save'
                });

                if (error) throw error;
                if (data && data.status === 'error') {
                    alert(data.message);
                    return;
                }

                alert(data?.message || 'تم اعتماد الشريك بنجاح ✓');
                closeAffiliateModal();
                await loadAffiliatesData();
            } catch (err) {
                alert('فشل اعتماد الشريك: ' + err.message);
            } finally {
                btnSaveAff.disabled = false;
                btnSaveAff.textContent = 'حفظ واعتماد الشريك';
            }
        });
    }

    // 4. زر حفظ واعتماد وكيل مالي جديد
    const btnSaveAgent = document.getElementById('btn-save-agent');
    if (btnSaveAgent) {
        btnSaveAgent.addEventListener('click', async (e) => {
            e.preventDefault();
            const select = document.getElementById('agent-user-select');
            const rateInput = document.getElementById('agent-commission-input');

            const userId = select?.value;
            const rate = Number(rateInput?.value);

            if (!userId) {
                alert('يرجى اختيار مستخدم من القائمة');
                return;
            }

            if (isNaN(rate) || rate <= 0) {
                alert('يجب إدخال نسبة عمولة صالحة أكبر من الصفر (مثال: 5)');
                return;
            }

            btnSaveAgent.disabled = true;
            btnSaveAgent.textContent = 'جاري الاعتماد...';

            try {
                const { data, error } = await supabase.rpc('admin_manage_agent', {
                    p_user_id: userId,
                    p_action: 'promote',
                    p_commission_rate: rate
                });

                if (error) throw error;
                if (data && data.status === 'error') {
                    alert(data.message);
                    return;
                }

                alert(data?.message || 'تم اعتماد الوكيل المالي بنجاح ✓');
                closeAgentModal();
                await loadAgentsTab();
            } catch (err) {
                alert('فشل اعتماد الوكيل: ' + err.message);
            } finally {
                btnSaveAgent.disabled = false;
                btnSaveAgent.textContent = 'اعتماد كوكيل مالي';
            }
        });
    }

    // 5. ربط أزرار الإلغاء في كافة النوافذ المنبثقة
    document.querySelectorAll('#edit-product-modal button, #affiliate-modal button, #agent-modal button, #agent-ops-modal button').forEach(btn => {
        if (btn.innerText.trim() === 'إلغاء' || btn.innerHTML.includes('ph-x')) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                closeProductModal();
                closeAffiliateModal();
                closeAgentModal();
                closeAgentOpsModal();
            });
        }
    });
}

/* ==========================================================================
   وحدة إدارة شركاء الربط الخارجي (B2B API Management Module)
   ========================================================================== */

// 1. جلب قائمة الشركاء عبر دالة RPC المحمية
async function loadApiPartnersData() {
    const tbody = document.getElementById('api-partners-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">جاري تحميل بيانات الشركاء...</td></tr>`;

    try {
        const { data, error } = await supabase.rpc('admin_get_api_partners');

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">لا يوجد شركاء ربط خارجي مسجلين حالياً.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(p => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                <td class="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                    <div>${p.partner_name}</div>
                    <div class="text-[10px] text-slate-400 font-normal">إجمالي الطلبات: ${p.total_orders || 0} | المسحوبات: $${Number(p.total_spent || 0).toFixed(2)}</div>
                </td>
                <td class="py-3 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400" dir="ltr">
                    ${p.api_key ? p.api_key.substring(0, 16) + '...' : '---'}
                </td>
                <td class="py-3 px-3">
                    <span class="font-mono font-black ${Number(p.float_balance) < 50 ? 'text-rose-500' : 'text-emerald-500'}">
                        $${Number(p.float_balance || 0).toFixed(2)}
                    </span>
                </td>
                <td class="py-3 px-3 text-center">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${p.is_active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'}">
                        <span class="w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
                        ${p.is_active ? 'نشط' : 'معطل'}
                    </span>
                </td>
<td class="py-3 px-3 text-center">
    <div class="flex items-center justify-center gap-1.5">
        <button onclick="openPartnerOrdersModal('${p.id}', '${p.partner_name}')" class="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-500 rounded-lg text-slate-600 dark:text-slate-300 transition" title="عرض سجل العمليات والأكواد">
            <i class="ph-bold ph-receipt text-sm"></i>
        </button>
        <button onclick="openTopupApiPartnerModal('${p.id}', '${p.partner_name}')" class="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-500 rounded-lg text-slate-600 dark:text-slate-300 transition" title="شحن الرصيد العائم">
            <i class="ph-bold ph-wallet text-sm"></i>
        </button>
        <button onclick="toggleApiPartnerStatus('${p.id}', ${!p.is_active})" class="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/20 hover:text-amber-500 rounded-lg text-slate-600 dark:text-slate-300 transition" title="${p.is_active ? 'تجميد الشريك' : 'تفعيل الشريك'}">
            <i class="ph-bold ph-power text-sm"></i>
        </button>
    </div>
</td>
            </tr>
        `).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-rose-500 font-bold">حدث خطأ أثناء جلب البيانات: ${err.message}</td></tr>`;
    }
}

// 2. توليد المفاتيح واعتماد شريك جديد
async function submitNewApiPartner() {
    const name = document.getElementById('api-partner-name-input').value.trim();
    const floatBal = parseFloat(document.getElementById('api-partner-float-input').value) || 0;
    const btn = document.getElementById('btn-submit-api-partner');

    if (!name) return alert('يرجى كتابة اسم المتجر أو الشريك');

    btn.disabled = true;
    btn.innerText = "جاري الاعتماد الأمني...";

    try {
        const { data, error } = await supabase.rpc('admin_create_api_partner', {
            p_partner_name: name,
            p_initial_balance: floatBal
        });

        if (error) throw error;

        document.getElementById('api-create-form').classList.add('hidden');
        document.getElementById('res-partner-key').value = data.api_key;
        document.getElementById('res-partner-secret').value = data.api_secret;
        document.getElementById('api-credentials-result').classList.remove('hidden');

    } catch (err) {
        alert('فشل اعتماد الشريك: ' + err.message);
        btn.disabled = false;
        btn.innerText = "توليد المفاتيح واعتماد الشريك";
    }
}

// 3. شحن الرصيد العائم للشريك
async function submitApiPartnerTopup() {
    const partnerId = document.getElementById('topup-api-partner-id').value;
    const amount = parseFloat(document.getElementById('api-topup-amount-input').value);
    const btn = document.getElementById('btn-submit-api-topup');

    if (!amount || amount <= 0) return alert('يرجى إدخال مبلغ صحيح');

    btn.disabled = true;
    btn.innerText = "جاري تنفيذ الإيداع...";

    try {
        const { error } = await supabase.rpc('admin_adjust_partner_float', {
            p_partner_id: partnerId,
            p_amount: amount
        });

        if (error) throw error;

        closeTopupApiPartnerModal();
        loadApiPartnersData();

    } catch (err) {
        alert('فشل شحن الرصيد: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "تأكيد الإيداع في الرصيد";
    }
}

// 4. تجميد أو تنشيط الشريك عبر RPC
async function toggleApiPartnerStatus(partnerId, newStatus) {
    if (!confirm(newStatus ? 'هل تريد إعادة تفعيل الشريك؟' : 'هل تريد تجميد الشريك ووقف عملياته مؤقتاً؟')) return;

    try {
        const { data, error } = await supabase.rpc('admin_toggle_api_partner_status', {
            p_partner_id: partnerId,
            p_is_active: newStatus
        });

        if (error) throw error;
        if (data && data.status === 'error') throw new Error(data.message);

        loadApiPartnersData();

    } catch (err) {
        alert('تعذر تغيير الحالة: ' + err.message);
    }
}

// 5. إدارة النوافذ المنبثقة
function openCreateApiPartnerModal() {
    document.getElementById('api-partner-name-input').value = '';
    document.getElementById('api-partner-float-input').value = '100.00';
    document.getElementById('api-create-form').classList.remove('hidden');
    document.getElementById('api-credentials-result').classList.add('hidden');
    document.getElementById('btn-submit-api-partner').disabled = false;
    document.getElementById('btn-submit-api-partner').innerText = "توليد المفاتيح واعتماد الشريك";
    document.getElementById('api-partner-create-modal').classList.remove('hidden');
}

function closeCreateApiPartnerModal() {
    document.getElementById('api-partner-create-modal').classList.add('hidden');
}

function openTopupApiPartnerModal(id, name) {
    document.getElementById('topup-api-partner-id').value = id;
    document.getElementById('topup-api-partner-name').innerText = `المتجر المستفيد: ${name}`;
    document.getElementById('api-topup-amount-input').value = '';
    document.getElementById('api-partner-topup-modal').classList.remove('hidden');
}

function closeTopupApiPartnerModal() {
    document.getElementById('api-partner-topup-modal').classList.add('hidden');
}

function copyApiText(elementId) {
    const input = document.getElementById(elementId);
    input.select();
    navigator.clipboard.writeText(input.value);
    alert("تم نسخ القيمة للحافظة بنجاح!");
}

// فتح نافذة سجل طلبات الشريك وجلب البيانات
async function openPartnerOrdersModal(partnerId, partnerName) {
    document.getElementById('partner-orders-modal-title').innerText = partnerName;
    const tbody = document.getElementById('partner-orders-tbody');
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">جاري تحميل سجل الطلبات...</td></tr>`;
    document.getElementById('api-partner-orders-modal').classList.remove('hidden');

    try {
        const { data, error } = await supabase.rpc('admin_get_api_partner_orders', {
            p_partner_id: partnerId
        });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">لم يقم هذا المتجر بسحب أي أكواد حتى الآن.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(o => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                <td class="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">${o.order_ref}</td>
                <td class="py-2.5 px-3 font-bold">${o.product_name}</td>
                <td class="py-2.5 px-3 font-mono text-[11px] text-amber-500 font-bold select-all" dir="ltr">${o.delivered_code}</td>
                <td class="py-2.5 px-3 font-mono font-bold text-rose-500">-$${Number(o.amount).toFixed(2)}</td>
                <td class="py-2.5 px-3 text-slate-400 text-[11px]">${new Date(o.created_at).toLocaleString('ar-EG')}</td>
            </tr>
        `).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-rose-500 font-bold">حدث خطأ أثناء تحميل السجل: ${err.message}</td></tr>`;
    }
}

function closePartnerOrdersModal() {
    document.getElementById('api-partner-orders-modal').classList.add('hidden');
}
