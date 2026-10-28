// =========================================================================
// SHIIFT X - لوحة تحكم الوكيل المالي المعتمد (Agent Dashboard)
// تحديث شامل: دعم فحص السيولة، شحن العملاء، واعتماد طلبات الإيداع المباشرة
// =========================================================================

let currentAgent = null;
let currentTab = 'pending-deposits';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. التحقق من جلسة تسجيل الدخول
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    
    if (sessionErr || !session) {
        window.location.replace('index.html');
        return;
    }

    // 2. التحقق من صلاحية الوكيل أو المشرف
    const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (profErr || !profile || !['agent', 'admin'].includes(profile.role)) {
        alert('غير مصرح لك بالوصول: هذه اللوحة مخصصة للوكلاء الماليين فقط.');
        window.location.replace('index.html');
        return;
    }

    currentAgent = profile;

    // 3. عرض بيانات الوكيل في شريط الواجهة
    renderAgentHeader(profile);

    // 4. تحميل طلبات الإيداع المعلقة تلقائياً
    await loadPendingDeposits();

    // 5. ربط أحداث النماذج والأزرار
    setupEventListeners();
});

// عرض معلومات الوكيل والسيولة
function renderAgentHeader(agent) {
    const nameEl = document.getElementById('agentName');
    const balanceEl = document.getElementById('agentBalance');
    const rateEl = document.getElementById('agentCommissionRate');

    if (nameEl) {
        nameEl.textContent = [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email;
    }
    if (balanceEl) {
        balanceEl.textContent = `$${Number(agent.balance || 0).toFixed(2)}`;
    }
    if (rateEl) {
        const rate = Number(agent.agent_commission_rate || 0);
        rateEl.textContent = rate >= 1 ? `${rate}%` : `${(rate * 100).toFixed(0)}%`;
    }
}

// إعداد مستمعات الأحداث (Tabs & Forms)
function setupEventListeners() {
    // نموذج الشحن المباشر للعميل من سيولة الوكيل
    const directTopupForm = document.getElementById('agentDirectTopupForm');
    if (directTopupForm) {
        directTopupForm.addEventListener('submit', handleDirectTopup);
    }
}

// تبديل التبويبات في اللوحة
window.switchAgentTab = async function(tabName) {
    currentTab = tabName;
    
    document.querySelectorAll('.agent-tab-btn').forEach(btn => {
        btn.classList.toggle('active-tab', btn.dataset.tab === tabName);
    });

    const pendingSection = document.getElementById('pendingDepositsSection');
    const directSection = document.getElementById('directTopupSection');
    const historySection = document.getElementById('agentHistorySection');

    if (pendingSection) pendingSection.classList.toggle('hidden', tabName !== 'pending-deposits');
    if (directSection) directSection.classList.toggle('hidden', tabName !== 'direct-topup');
    if (historySection) historySection.classList.toggle('hidden', tabName !== 'history');

    if (tabName === 'pending-deposits') {
        await loadPendingDeposits();
    } else if (tabName === 'history') {
        await loadAgentHistory();
    }
};

// =========================================================================
// 1. إدارة طلبات الإيداع المعلقة (جديد)
// =========================================================================
async function loadPendingDeposits() {
    // تم التعديل إلى المعرف الحقيقي الدقيق الموجود في صفحتك
    const container = document.getElementById('agent-pending-orders-container');
    if (!container) return;

    container.innerHTML = `
        <div class="py-6 text-center text-xs text-slate-400">
            <i class="ph ph-spinner animate-spin text-lg mb-1 inline-block text-amber-500"></i>
            <p>جاري تحميل الطلبات المعلقة...</p>
        </div>
    `;

    try {
        const { data: orders, error } = await supabase.rpc('agent_get_all_pending_deposits');

        if (error) throw error;

        if (!orders || orders.length === 0) {
            container.innerHTML = `
                <div class="py-6 text-center text-xs text-slate-500">
                    لا توجد طلبات إيداع بانتظار التأكيد حالياً ✓
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl mb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-white text-sm">${order.customer_name}</span>
                        <span class="text-[11px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800 font-mono">${order.transaction_ref}</span>
                    </div>
                    <div class="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>الوسيلة: <b class="text-slate-200">${order.payment_method}</b></span>
                        <span>رقم الإشعار: <b class="font-mono text-emerald-400">${order.transfer_receipt_num}</b></span>
                        <span>الهاتف: <b class="font-mono text-slate-300">${order.customer_phone}</b></span>
                        <span>الوقت: ${new Date(order.created_at).toLocaleTimeString('ar-EG')}</span>
                    </div>
                </div>
                <div class="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <span class="text-base font-bold text-emerald-400 font-mono">$${Number(order.amount).toFixed(2)}</span>
                    <div class="flex gap-1.5">
                        <button onclick="approveDepositOrder('${order.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold">
                            قبول وشحن
                        </button>
                        <button onclick="rejectDepositOrder('${order.id}')" class="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded text-xs">
                            رفض
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Error fetching pending deposits:', err);
        container.innerHTML = `<p class="text-rose-400 text-xs p-3">تعذر تحميل الطلبات: ${err.message}</p>`;
    }
}

// اعتماد شحن الرصيد للعميل
window.approveDepositOrder = async function(orderId) {
    if (!confirm('هل تأكدت من استلام الحوالة وترغب في شحن الرصيد لحساب العميل الآن؟')) return;

    try {
        const { data, error } = await supabase.rpc('agent_process_customer_deposit', {
            p_order_id: orderId,
            p_action: 'approve'
        });

        if (error) throw error;
        if (data.status === 'success') {
            alert(data.message);
            await loadPendingDeposits();
        } else {
            alert(data.message || 'حدث خطأ أثناء معالجة الطلب.');
        }
    } catch (err) {
        alert('تعذر تنفيذ العملية: ' + err.message);
    }
};

// رفض الطلب مع توثيق السبب
window.rejectDepositOrder = async function(orderId) {
    const reason = prompt('يرجى ذكر سبب الرفض (يظهر للعميل وفي السجل الرقابي للمشرف):');
    if (reason === null) return;

    try {
        const { data, error } = await supabase.rpc('agent_process_customer_deposit', {
            p_order_id: orderId,
            p_action: 'reject',
            p_reason: reason
        });

        if (error) throw error;
        if (data.status === 'success') {
            alert(data.message);
            await loadPendingDeposits();
        } else {
            alert(data.message || 'حدث خطأ أثناء رفض الطلب.');
        }
    } catch (err) {
        alert('تعذر رفض الطلب: ' + err.message);
    }
};

// =========================================================================
// 2. الشحن المباشر من سيولة الوكيل (كاش يدوي)
// =========================================================================

async function handleDirectTopup(e) {
    e.preventDefault();
    const emailInput = document.getElementById('targetUserEmail');
    const amountInput = document.getElementById('topupAmount');
    const notesInput = document.getElementById('topupNotes');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    const email = emailInput.value.trim();
    const amount = Number(amountInput.value);
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!email || amount <= 0) {
        alert('يرجى إدخال بريد إلكتروني صالح ومبلغ أكبر من الصفر.');
        return;
    }

    if (!confirm(`تأكيد تحويل $${amount} إلى العميل (${email}) وخصمها من سيولتك؟`)) return;

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> جاري التحويل...';

        const { data, error } = await supabase.rpc('agent_process_deposit', {
            p_target_user_email: email,
            p_amount: amount,
            p_notes: notes || 'شحن سيولة كاش مباشر عبر الوكيل'
        });

        if (error) throw error;

        if (data.status === 'success') {
            alert(`${data.message}\nالعمولة المكتسبة: $${data.commission}`);
            e.target.reset();
            // تحديث رصيد الوكيل المعروض
            const { data: updatedProfile } = await supabase.from('profiles').select('balance').eq('id', currentAgent.id).single();
            if (updatedProfile) {
                currentAgent.balance = updatedProfile.balance;
                renderAgentHeader(currentAgent);
            }
        } else {
            alert(data.message || 'فشلت العملية.');
        }
    } catch (err) {
        alert('خطأ أثناء التحويل: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'تنفيذ الشحن الفوري';
    }
}

// =========================================================================
// 3. سجل حركات الوكيل
// =========================================================================

async function loadAgentHistory() {
    const tableBody = document.getElementById('agentHistoryTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">جاري تحميل السجل...</td></tr>`;

    try {
        const { data: txs, error } = await supabase.rpc('get_agent_transactions');
        if (error) throw error;

        if (!txs || txs.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">لا توجد عمليات سابقة.</td></tr>`;
            return;
        }

        tableBody.innerHTML = txs.map(t => `
            <tr class="border-b border-gray-800 hover:bg-gray-800/30 text-sm">
                <td class="p-3 text-white font-medium">${t.target_name}<br><span class="text-xs text-gray-400">${t.target_email}</span></td>
                <td class="p-3 font-bold text-emerald-400 font-mono">$${Number(t.amount).toFixed(2)}</td>
                <td class="p-3 text-indigo-400 font-mono">+$${Number(t.commission_earned || 0).toFixed(2)}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-xs ${t.status === 'completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}">
                        ${t.status === 'completed' ? 'ناجحة' : 'مرفوضة'}
                    </span>
                </td>
                <td class="p-3 text-xs text-gray-400">${t.notes || '—'}</td>
                <td class="p-3 text-xs text-gray-500">${new Date(t.created_at).toLocaleString('ar-EG')}</td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-rose-400">حدث خطأ: ${err.message}</td></tr>`;
    }
}
