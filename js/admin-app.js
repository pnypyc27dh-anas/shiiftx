// =========================================================================
// SHIIFT X - كود لوحة المشرف والرقابة المعتمد (Admin & Audit Controller)
// =========================================================================

let currentAdmin = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. التحقق من جلسة المشرف وصلاحياته
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

    // 2. تحميل مؤشرات الأداء (KPIs) والشارات
    await loadKPIs();

    // 3. ربط أحداث الإدارة والتنقل بين التبويبات
    setupAdminEventListeners();

    // 4. تحميل التبويب الافتراضي (الطلبات والإيداعات)
    await loadDepositsAuditTab();
    await loadAgentsTab();
});

// =========================================================================
// 1. نظام التنقل بين التبويبات (Tabs Switching)
// =========================================================================
window.switchTab = function(tabName) {
    const tabs = ['orders', 'deposits', 'inventory', 'products', 'affiliates', 'agents', 'wallet'];

    tabs.forEach(t => {
        const sec = document.getElementById(`sec-${t}`);
        const tabBtn = document.getElementById(`tab-${t}`);

        if (sec) {
            if (t === tabName) {
                sec.classList.remove('hidden');
            } else {
                sec.classList.add('hidden');
            }
        }

        if (tabBtn) {
            if (t === tabName) {
                tabBtn.className = 'px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 bg-indigo-600 text-white shadow-lg shadow-indigo-600/30';
            } else {
                tabBtn.className = 'px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800/60';
            }
        }
    });

    // تحديث البيانات بحسب التبويب النشط
    if (tabName === 'deposits') loadDepositsAuditTab();
    if (tabName === 'agents') loadAgentsTab();
};

// =========================================================================
// 2. مؤشرات الأداء والشارات (KPIs & Badges)
// =========================================================================
async function loadKPIs() {
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

            if (elBadgeOrders && kpis.pending_orders > 0) {
                elBadgeOrders.textContent = kpis.pending_orders;
                elBadgeOrders.classList.remove('hidden');
            }
            if (elBadgeDeposits && kpis.pending_deposits > 0) {
                elBadgeDeposits.textContent = kpis.pending_deposits;
                elBadgeDeposits.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.warn('تنبيه: تعذر تحميل المؤشرات العامة:', err.message);
    }
}

// =========================================================================
// 3. سجل التدقيق الرقابي للإيداعات (Deposits Audit Tab)
// =========================================================================
window.loadDepositsAuditTab = async function() {
    const tbody = document.getElementById('deposits-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="py-8 text-center text-xs text-slate-400">
                <i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-indigo-500"></i>
                <p>جاري تحميل السجل الرقابي للإيداعات...</p>
            </td>
        </tr>
    `;

    try {
        const { data: records, error } = await supabase.rpc('admin_get_deposits_audit');
        if (error) throw error;

        // تحديث شارة الإيداعات المعلقة
        const pendingCount = (records || []).filter(r => r.status === 'pending').length;
        const badge = document.getElementById('badge-deposits-count');
        if (badge) {
            badge.textContent = pendingCount;
            badge.classList.toggle('hidden', pendingCount === 0);
        }

        if (!records || records.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="py-8 text-center text-xs text-slate-500">
                        لا توجد طلبات إيداع مسجلة في النظام حتى الآن.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = records.map(r => {
            let statusBadge = '';
            if (r.status === 'approved' || r.status === 'completed') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-semibold">معتمد ✓</span>';
            } else if (r.status === 'pending') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-amber-950/80 text-amber-400 border border-amber-800 font-semibold animate-pulse">معلق</span>';
            } else {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-rose-950/80 text-rose-400 border border-rose-800 font-semibold">مرفوض</span>';
            }

            const processorRoleBadge = r.processed_by_role === 'agent' 
                ? '<span class="px-1.5 py-0.5 rounded text-[9px] bg-blue-950 text-blue-400 border border-blue-800 mr-1">وكيل كاش</span>'
                : (r.processed_by_role === 'admin' ? '<span class="px-1.5 py-0.5 rounded text-[9px] bg-purple-950 text-purple-400 border border-purple-800 mr-1">إدارة</span>' : '');

            return `
                <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors text-xs text-slate-300">
                    <td class="py-3 px-4 font-mono font-bold text-white">${r.transaction_ref}</td>
                    <td class="py-3 px-4">
                        <div class="font-bold text-white">${r.customer_name}</div>
                        <div class="text-[10px] text-slate-400">${r.customer_email} • ${r.customer_phone}</div>
                    </td>
                    <td class="py-3 px-4 font-mono font-bold text-emerald-400">$${Number(r.amount).toFixed(2)}</td>
                    <td class="py-3 px-4">
                        <div>${r.payment_method}</div>
                        <div class="text-[10px] font-mono text-slate-400">رقم الإشعار: ${r.receipt_num || '—'}</div>
                    </td>
                    <td class="py-3 px-4">${statusBadge}</td>
                    <td class="py-3 px-4">
                        <div class="flex items-center">
                            ${processorRoleBadge}
                            <span class="font-semibold text-slate-200">${r.processed_by_name || '—'}</span>
                        </div>
                        ${r.rejection_reason ? `<div class="text-[10px] text-rose-400 mt-0.5">سبب الرفض: ${r.rejection_reason}</div>` : ''}
                    </td>
                    <td class="py-3 px-4 font-mono text-[10px] text-slate-400">
                        ${new Date(r.created_at).toLocaleString('ar-EG')}
                    </td>
                    <td class="py-3 px-4 font-mono text-[10px] text-slate-400">
                        ${r.processed_at ? new Date(r.processed_at).toLocaleString('ar-EG') : '—'}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('فشل تحميل سجل التدقيق للإيداعات:', err);
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-rose-400 text-xs text-center">تعذر تحميل السجل الرقابي: ${err.message}</td></tr>`;
    }
};

// =========================================================================
// 4. إدارة الوكلاء الماليين (Agents Management Tab)
// =========================================================================
window.loadAgentsTab = async function() {
    const tbody = document.getElementById('agents-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="py-8 text-center text-xs text-slate-400">
                <i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-indigo-500"></i>
                <p>جاري تحميل قائمة الوكلاء الماليين...</p>
            </td>
        </tr>
    `;

    try {
        const { data: agents, error } = await supabase.rpc('admin_get_all_agents');
        if (error) throw error;

        if (!agents || agents.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-8 text-center text-xs text-slate-500">
                        لا يوجد وكلاء ماليين مسجلين في المنصة حالياً.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = agents.map(a => `
            <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors text-xs text-slate-300">
                <td class="py-3 px-4">
                    <div class="font-bold text-white">${a.full_name}</div>
                    <div class="text-[10px] text-slate-400">${a.email}</div>
                </td>
                <td class="py-3 px-4 font-mono font-bold text-emerald-400 text-sm">$${Number(a.balance).toFixed(2)}</td>
                <td class="py-3 px-4 font-mono font-bold text-indigo-400">${Number(a.commission_rate)}%</td>
                <td class="py-3 px-4 font-mono font-bold text-slate-200">$${Number(a.total_transferred).toFixed(2)}</td>
                <td class="py-3 px-4 font-mono font-bold text-emerald-400">$${Number(a.total_commissions).toFixed(2)}</td>
                <td class="py-3 px-4 font-mono text-center">${a.transfers_count}</td>
                <td class="py-3 px-4">
                    <div class="flex items-center gap-1.5">
                        <button onclick="openAgentOpsModal('${a.agent_id}', '${a.full_name}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg text-xs font-semibold">
                            سجل العمليات
                        </button>
                        <button onclick="editAgentCommission('${a.agent_id}', ${a.commission_rate})" class="px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 rounded-lg text-xs">
                            تعديل النسبة
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error('فشل تحميل قائمة الوكلاء:', err);
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-rose-400 text-xs text-center">تعذر تحميل بيانات الوكلاء: ${err.message}</td></tr>`;
    }
};

// =========================================================================
// 5. نوافذ التحكم المنبثقة للوكلاء (Modals & Operations)
// =========================================================================

// نافذة تعيين وكيل جديد
window.openAgentModal = async function() {
    const modal = document.getElementById('agent-modal');
    const select = document.getElementById('agent-user-select');
    if (!modal || !select) return;

    select.innerHTML = '<option value="">جاري تحميل قائمة المستخدمين...</option>';
    modal.classList.remove('hidden');

    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, role')
            .neq('role', 'agent')
            .order('email');

        if (error) throw error;

        select.innerHTML = '<option value="">اختر الحساب لترقيته إلى وكيل معتمد...</option>' + 
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

// تعديل نسبة عمولة الوكيل مباشرة
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
        alert('تم تحديث نسبة العمولة للوكيل بنجاح ✓');
        await loadAgentsTab();
    } catch (err) {
        alert('تعذر تحديث النسبة: ' + err.message);
    }
};

// نافذة استعراض سجل حركات وكيل محدد
window.openAgentOpsModal = async function(agentId, agentName) {
    const modal = document.getElementById('agent-ops-modal');
    const title = document.getElementById('agent-ops-modal-title');
    const list = document.getElementById('agent-modal-transactions-list');

    if (!modal || !list) return;

    if (title) title.textContent = `سجل عمليات الوكيل: ${agentName}`;
    list.innerHTML = `
        <div class="py-8 text-center text-xs text-slate-400">
            <i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-indigo-500"></i>
            <p>جاري جلب عمليات الوكيل من السجل المالي...</p>
        </div>
    `;
    modal.classList.remove('hidden');

    try {
        const { data: txs, error } = await supabase.rpc('admin_get_agent_transactions_history', {
            p_target_agent_id: agentId
        });

        if (error) throw error;

        if (!txs || txs.length === 0) {
            list.innerHTML = '<div class="py-6 text-center text-xs text-slate-500">لا توجد حركات مسجلة لهذا الوكيل حتى الآن.</div>';
            return;
        }

        list.innerHTML = txs.map(t => `
            <div class="p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl mb-2 flex justify-between items-center text-xs">
                <div>
                    <div class="font-bold text-white">${t.target_user_name || 'عميل'} (${t.target_user_email || '—'})</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">${t.notes || 'تحويل رصيد'} • ${new Date(t.created_at).toLocaleString('ar-EG')}</div>
                </div>
                <div class="text-left font-mono">
                    <div class="text-sm font-bold text-emerald-400">$${Number(t.amount).toFixed(2)}</div>
                    <div class="text-[10px] text-indigo-400">+${Number(t.commission_earned).toFixed(2)}$ عمولة</div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        list.innerHTML = `<p class="p-4 text-rose-400 text-xs text-center">تعذر جلب السجل: ${err.message}</p>`;
    }
};

window.closeAgentOpsModal = function() {
    const modal = document.getElementById('agent-ops-modal');
    if (modal) modal.classList.add('hidden');
};

// =========================================================================
// 6. ربط مستمعات الأحداث (Event Listeners)
// =========================================================================
function setupAdminEventListeners() {
    // ربط زر حفظ الوكيل الجديد
    const btnSaveAgent = document.getElementById('btn-save-agent');
    if (btnSaveAgent) {
        btnSaveAgent.addEventListener('click', async (e) => {
            e.preventDefault();
            const select = document.getElementById('agent-user-select');
            const rateInput = document.getElementById('agent-commission-input');

            const userId = select?.value;
            const rate = Number(rateInput?.value || 0);

            if (!userId) {
                alert('يرجى اختيار مستخدم من القائمة');
                return;
            }

            btnSaveAgent.disabled = true;
            btnSaveAgent.textContent = 'جاري الاعتماد...';

            try {
                const { data, error } = await supabase.rpc('admin_manage_agent', {
                    p_user_id: userId,
                    p_action: 'make_agent',
                    p_commission_rate: rate
                });

                if (error) throw error;
                alert('تم اعتماد الوكيل المالي بنجاح ✓');
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
}
