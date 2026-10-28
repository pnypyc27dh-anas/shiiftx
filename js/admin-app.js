// =========================================================================
// SHIIFT X - لوحة المشرف والرقابة المركزية الشاملة (Admin Central Controller)
// يدعم الوضعين: النهاري (Light Mode) والليلي (Dark Mode) بأعلى درجات التباين
// =========================================================================

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
window.switchTab = function(tabName) {
    const tabs = ['orders', 'deposits', 'inventory', 'products', 'affiliates', 'agents', 'wallet'];

    tabs.forEach(t => {
        const sec = document.getElementById(`sec-${t}`); const tabBtn = document.getElementById(`tab-${t}`);

        if (sec) {
            sec.classList.toggle('hidden', t !== tabName);
        }

        if (tabBtn) {
            if (t === tabName) {
                tabBtn.className = 'px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 bg-indigo-600 text-white shadow-lg shadow-indigo-600/30';
            } else {
                tabBtn.className = 'px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60';
            }
        }
    });

    // تحميل بيانات التبويب المستدعى لحظياً
    switch (tabName) {
        case 'orders': loadPendingOrders(); break;
        case 'deposits': loadDepositsAuditTab(); break;
        case 'inventory': loadInventoryData(); break;
        case 'products': loadProducts(); break;
        case 'affiliates': loadAffiliatesData(); break;
        case 'agents': loadAgentsTab(); break;
    }
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

            if (elToday) elToday.textContent = `$${Number(kpis.sales_today \vert{}\vert{} 0).toFixed(2)}`; if (elMonth) elMonth.textContent = `$${Number(kpis.sales_month || 0).toFixed(2)}`;
            if (elComm) elComm.textContent = `$${Number(kpis.total_commissions \vert{}\vert{} 0).toFixed(2)}`; if (elBal) elBal.textContent = `$${Number(kpis.customer_balances || 0).toFixed(2)}`;

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
// 3. تبويب طلبات شحن الـ ID المعلقة (Direct ID Orders)
// =========================================================================
window.loadPendingOrders = async function() {
    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-slate-500 dark:text-slate-400"><i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-indigo-500"></i><p>جاري تحميل طلبات الـ ID المعلقة...</p></td></tr>`;

    try {
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
            tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-slate-500">لا توجد طلبات ID معلقة حالياً ✓</td></tr>`;
            return;
        }

        const refs = txs.map(t => t.transaction_ref);
        const { data: orders } = await supabase.from('orders').select('*').in('transaction_ref', refs);
        const ordersMap = new Map((orders || []).map(o => [o.transaction_ref, o]));

        tbody.innerHTML = txs.map(tx => {
            const ord = ordersMap.get(tx.transaction_ref);
            const playerId = ord?.player_id || ord?.custom_inputs?.player_id || tx.details?.match(/ID:\s*([^\s,]+)/i)?.[1] || '—';
            const packageName = ord?.package_name || tx.details?.replace(/\[.*?\]/g, '').trim() || 'باقة ألعاب';

            return `
                <tr class="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-xs text-slate-700 dark:text-slate-300">
                    <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${tx.transaction_ref}</td>
                    <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">${packageName}</td>
                    <td class="py-3 px-4 font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/30 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800/50">${playerId}</td> <td class="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">$${Number(tx.amount).toFixed(2)}</td>
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <button onclick="processIDOrder('${tx.id}', 'complete')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shadow-sm transition-all">
                                تم الشحن ✓
                            </button>
                            <button onclick="processIDOrder('${tx.id}', 'refund')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300 dark:border-rose-800 rounded-lg text-xs font-semibold transition-all">
                                رفض وإرجاع
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-rose-500 text-xs text-center">تعذر تحميل الطلبات: ${err.message}</td></tr>`;
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
// 4. تبويب سجل الإيداعات الرقابي (Deposits Audit)
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
            tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-xs text-slate-500">لا توجد طلبات إيداع مسجلة.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => {
            let statusBadge = '';
            if (r.status === 'approved' || r.status === 'completed') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800 font-semibold">معتمد ✓</span>';
            } else if (r.status === 'pending') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/80 dark:text-amber-400 dark:border-amber-800 font-semibold animate-pulse">معلق</span>';
            } else {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/80 dark:text-rose-400 dark:border-rose-800 font-semibold">مرفوض</span>';
            }

            const roleBadge = r.processed_by_role === 'agent' 
                ? '<span class="px-1.5 py-0.5 rounded text-[9px] bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 mr-1 font-semibold">وكيل كاش</span>'
                : (r.processed_by_role === 'admin' ? '<span class="px-1.5 py-0.5 rounded text-[9px] bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800 mr-1 font-semibold">إدارة</span>' : '');

            return `
                <tr class="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-xs text-slate-700 dark:text-slate-300">
                    <td class="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">${r.transaction_ref}</td>
                    <td class="py-3 px-4">
                        <div class="font-bold text-slate-900 dark:text-white">${r.customer_name}</div>
                        <div class="text-[10px] text-slate-500 dark:text-slate-400">${r.customer_email} • ${r.customer_phone}</div> </td> <td class="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">$${Number(r.amount).toFixed(2)}</td>
                    <td class="py-3 px-4">
                        <div class="font-semibold text-slate-800 dark:text-slate-200">${r.payment_method}</div>
                        <div class="text-[10px] font-mono text-slate-500 dark:text-slate-400">إشعار: ${r.receipt_num || '—'}</div>
                    </td>
                    <td class="py-3 px-4">${statusBadge}</td>
                    <td class="py-3 px-4">
                        <div class="flex items-center">
                            ${roleBadge}
                            <span class="font-semibold text-slate-800 dark:text-slate-200">${r.processed_by_name || '—'}</span>
                        </div>
                        ${r.rejection_reason ? `<div class="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 font-medium">سبب الرفض: ${r.rejection_reason}</div>` : ''}
                    </td>
                    <td class="py-3 px-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">${new Date(r.created_at).toLocaleString('ar-EG')}</td>
                    <td class="py-3 px-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">${r.processed_at ? new Date(r.processed_at).toLocaleString('ar-EG') : '—'}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-rose-500 text-xs text-center">تعذر تحميل السجل: ${err.message}</td></tr>`;
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

        if (select) {
            select.innerHTML = '<option value="">اختر الباقة الرقمية لإيداع الأكواد...</option>' + 
                products.map(p => `<option value="${p.id}">[${p.platform}] ${p.package_name} -$${p.price}</option>`).join('');
        }

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

        if (!products || products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-500">لا توجد باقات من نوع كود رقمي مضافة في المنصة.</td></tr>`;
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
                    <td class="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">${p.package_name}</td> <td class="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">$${Number(p.price).toFixed(2)}</td>
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
        select.scrollIntoView({ behavior: 'smooth', block: 'center' });
        select.focus();
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
            filter.innerHTML = '<option value="">جميع المنصات</option>' + 
                platforms.map(pl => `<option value="${pl}" ${pl === currentFilter ? 'selected' : ''}>${pl}</option>`).join('');
        }

        renderFilteredProducts();

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-rose-500 text-xs text-center">تعذر تحميل المنتجات: ${err.message}</td></tr>`;
    }
};

function renderFilteredProducts() {
    const tbody = document.getElementById('products-tbody');
    const filter = document.getElementById('products-platform-filter');
    if (!tbody) return;

    const selectedPl = filter?.value;
    const list = selectedPl ? allProductsCache.filter(p => p.platform === selectedPl) : allProductsCache;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-500">لا توجد باقات معروضة.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(p => `
        <tr class="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-xs text-slate-700 dark:text-slate-300">
            <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${p.platform}</td>
            <td class="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">${p.package_name}</td>
            <td class="py-3 px-
