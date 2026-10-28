// =========================================================================
// SHIIFT X - لوحة تحكم الإدارة والمشرف (Admin Dashboard)
// تحديث شامل: تفعيل السجل الرقابي للإيداعات (Audit Trail)، المنتجات، والوكلاء
// =========================================================================

let currentAdmin = null;
let currentTab = 'kpis';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. التحقق من صلاحية المشرف
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
        alert('غير مصرح: هذه اللوحة خاصة بمشرف النظام فقط.');
        window.location.replace('index.html');
        return;
    }

    currentAdmin = profile;

    // 2. تحميل المؤشرات العامة
    await loadKPIs();

    // 3. ربط النوافذ المنبثقة وأحداث الإدخال
    setupAdminEventListeners();
});

// تبديل التبويبات في لوحة الإدارة
window.switchAdminTab = async function(tabName) {
    currentTab = tabName;

    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.classList.toggle('bg-indigo-600', btn.dataset.tab === tabName);
        btn.classList.toggle('text-white', btn.dataset.tab === tabName);
        btn.classList.toggle('text-gray-400', btn.dataset.tab !== tabName);
    });

    const sections = ['kpisSection', 'ordersSection', 'depositsSection', 'productsSection', 'agentsSection'];
    sections.forEach(secId => {
        const el = document.getElementById(secId);
        if (el) el.classList.add('hidden');
    });

    const activeSec = document.getElementById(`${tabName}Section`);
    if (activeSec) activeSec.classList.remove('hidden');

    // تحميل محتوى التبويب المختار
    if (tabName === 'kpis') await loadKPIs();
    if (tabName === 'orders') await loadOrdersTab();
    if (tabName === 'deposits') await loadDepositsAuditTab();
    if (tabName === 'products') await loadProductsTab();
    if (tabName === 'agents') await loadAgentsTab();
};

// =========================================================================
// 1. مؤشرات الأداء (KPIs)
// =========================================================================

async function loadKPIs() {
    try {
        const { data, error } = await supabase.rpc('admin_get_kpis');
        if (error) throw error;

        document.getElementById('kpiSalesToday').textContent = `$${Number(data.sales_today || 0).toFixed(2)}`;
        document.getElementById('kpiSalesMonth').textContent = `$${Number(data.sales_month || 0).toFixed(2)}`;
        document.getElementById('kpiTotalCommissions').textContent = `$${Number(data.total_commissions || 0).toFixed(2)}`;
        document.getElementById('kpiCustomerBalances').textContent = `$${Number(data.customer_balances || 0).toFixed(2)}`;
        document.getElementById('kpiPendingOrders').textContent = data.pending_orders || 0;
        document.getElementById('kpiPendingDeposits').textContent = data.pending_deposits || 0;
    } catch (err) {
        console.error('Error fetching KPIs:', err);
    }
}

// =========================================================================
// 2. السجل الرقابي الشامل لطلبات الإيداع (Audit Trail)
// =========================================================================

async function loadDepositsAuditTab() {
    const tableBody = document.getElementById('depositsTableBody') || document.getElementById('depositsAuditTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-500">جاري تحميل السجل الرقابي للإيداعات...</td></tr>`;

    try {
        const { data: records, error } = await supabase.rpc('admin_get_deposits_audit');
        if (error) throw error;

        if (!records || records.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-500">لا توجد عمليات إيداع مسجلة.</td></tr>`;
            return;
        }

        tableBody.innerHTML = records.map(r => {
            const statusBadge = 
                r.status === 'approved' ? '<span class="px-2 py-0.5 rounded text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">مقبول ومكتمل</span>' :
                r.status === 'rejected' ? '<span class="px-2 py-0.5 rounded text-xs bg-rose-950 text-rose-400 border border-rose-800 font-semibold">مرفوض</span>' :
                '<span class="px-2 py-0.5 rounded text-xs bg-amber-950 text-amber-400 border border-amber-800 font-semibold animate-pulse">قيد الانتظار</span>';

            const auditInfo = r.processed_by_name !== '—' ? `
                <div class="text-indigo-300 font-medium">${r.processed_by_name}</div>
                <div class="text-[10px] text-gray-400">الصفة: ${r.processed_by_role === 'agent' ? 'وكيل مالي' : 'مشرف نظام'}</div>
                <div class="text-[10px] text-gray-500 font-mono">${new Date(r.processed_at).toLocaleString('ar-EG')}</div>
            ` : '<span class="text-amber-500/80 text-xs">بانتظار المعالجة</span>';

            return `
                <tr class="border-b border-gray-800 hover:bg-gray-800/30 text-sm">
                    <td class="p-3 font-mono text-xs text-yellow-400">${r.transaction_ref}</td>
                    <td class="p-3">
                        <div class="font-medium text-white">${r.customer_name}</div>
                        <div class="text-xs text-gray-400">${r.customer_email}</div>
                    </td>
                    <td class="p-3 font-bold text-emerald-400 font-mono">$${Number(r.amount).toFixed(2)}</td>
                    <td class="p-3 text-xs text-gray-300">
                        <div>${r.payment_method}</div>
                        <div class="font-mono text-gray-500 text-[11px]">${r.receipt_num || '—'}</div>
                    </td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3 text-xs">${auditInfo}</td>
                    <td class="p-3 text-xs text-gray-400 max-w-xs truncate">${r.rejection_reason || '—'}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error loading audit log:', err);
        tableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-rose-400">حدث خطأ: ${err.message}</td></tr>`;
    }
}

// =========================================================================
// 3. إدارة طلبات الشحن المباشر (Direct Orders)
// =========================================================================

async function loadOrdersTab() {
    const tableBody = document.getElementById('ordersTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">جاري تحميل الطلبات...</td></tr>`;

    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                order_ref,
                transaction_ref,
                package_name,
                platform,
                product_type,
                player_id,
                price,
                status,
                created_at,
                profiles:user_id (email, first_name, last_name)
            `)
            .eq('product_type', 'ID')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!orders || orders.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">لا توجد طلبات شحن معرفات حالياً.</td></tr>`;
            return;
        }

        tableBody.innerHTML = orders.map(o => {
            const cust = [o.profiles?.first_name, o.profiles?.last_name].filter(Boolean).join(' ') || o.profiles?.email || 'عميل';
            return `
                <tr class="border-b border-gray-800 hover:bg-gray-800/30 text-sm">
                    <td class="p-3 font-mono text-xs text-indigo-400">${o.order_ref}</td>
                    <td class="p-3">
                        <div class="text-white font-medium">${cust}</div>
                        <div class="text-xs text-gray-400">${o.platform} - ${o.package_name}</div>
                    </td>
                    <td class="p-3 font-mono text-amber-400 font-bold select-all">${o.player_id || '—'}</td>
                    <td class="p-3 font-bold text-emerald-400 font-mono">$${Number(o.price).toFixed(2)}</td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded text-xs ${
                            o.status === 'completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            o.status === 'cancelled' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                            'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                        }">
                            ${o.status === 'completed' ? 'تم الشحن' : o.status === 'cancelled' ? 'ملغي ومسترد' : 'معلق'}
                        </span>
                    </td>
                    <td class="p-3">
                        ${o.status === 'pending' ? `
                            <div class="flex gap-1.5">
                                <button onclick="processDirectOrder('${o.transaction_ref}', 'complete')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold">تأكيد</button>
                                <button onclick="processDirectOrder('${o.transaction_ref}', 'refund')" class="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded text-xs">إرجاع</button>
                            </div>
                        ` : '<span class="text-gray-500 text-xs">مكتمل</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-rose-400">خطأ: ${err.message}</td></tr>`;
    }
}

// معالجة طلب شحن ID (تأكيد أو رفض مع إرجاع الرصيد)
window.processDirectOrder = async function(txRef, action) {
    let reason = '';
    if (action === 'refund') {
        reason = prompt('أدخل سبب الرفض وإرجاع الرصيد للعميل (مثال: معرف اللاعب غير صحيح):');
        if (reason === null) return;
    } else {
        if (!confirm('تأكيد إتمام الشحن في اللعبة وتحرير عمولة الشريك إن وجدت؟')) return;
    }

    try {
        const { data: tx } = await supabase.from('transactions').select('id').eq('transaction_ref', txRef).single();
        if (!tx) throw new Error('تعذر العثور على المعاملة المقابلة.');

        const { data, error } = await supabase.rpc('admin_process_order', {
            p_tx_id: tx.id,
            p_action: action,
            p_reason: reason
        });

        if (error) throw error;
        alert(data.message);
        await loadOrdersTab();
    } catch (err) {
        alert('حدث خطأ: ' + err.message);
    }
};

// =========================================================================
// 4. إدارة الوكلاء والشركاء
// =========================================================================

async function loadAgentsTab() {
    const tableBody = document.getElementById('agentsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-500">جاري تحميل قائمة الوكلاء...</td></tr>`;

    try {
        const { data: agents, error } = await supabase.rpc('admin_get_all_agents');
        if (error) throw error;

        if (!agents || agents.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-500">لا يوجد وكلاء مسجلون حالياً.</td></tr>`;
            return;
        }

        tableBody.innerHTML = agents.map(a => `
            <tr class="border-b border-gray-800 hover:bg-gray-800/30 text-sm">
                <td class="p-3 text-white font-medium">${a.full_name}<br><span class="text-xs text-gray-400">${a.email}</span></td>
                <td class="p-3 font-bold text-emerald-400 font-mono">$${Number(a.balance).toFixed(2)}</td>
                <td class="p-3 font-mono text-indigo-400">${a.commission_rate}%</td>
                <td class="p-3 font-mono text-gray-300">$${Number(a.total_transferred).toFixed(2)}</td>
                <td class="p-3 font-mono text-amber-400">+$${Number(a.total_commissions).toFixed(2)}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded text-xs bg-emerald-950 text-emerald-400 border border-emerald-800">${a.status}</span></td>
                <td class="p-3">
                    <button onclick="payoutAgentCash('${a.email}')" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold">تسليم أرباح</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-rose-400">خطأ: ${err.message}</td></tr>`;
    }
}

// تسليم أرباح كاش للوكيل
window.payoutAgentCash = async function(agentEmail) {
    const amountStr = prompt(`المبلغ المراد تسليمه كاش للوكيل (${agentEmail}):`);
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0) {
        alert('يرجى إدخال مبلغ صحيح.');
        return;
    }

    try {
        const { data, error } = await supabase.rpc('payout_agent_cash', {
            p_agent_email: agentEmail,
            p_payout_amount: amount,
            p_note: 'تسليم أرباح كاش يداً بيد'
        });

        if (error) throw error;
        alert(data.message);
        await loadAgentsTab();
    } catch (err) {
        alert('تعذر صرف الأرباح: ' + err.message);
    }
};

function setupAdminEventListeners() {
    // يمكن ربط نماذج إضافة المنتجات أو تعديل النسب هنا
}
