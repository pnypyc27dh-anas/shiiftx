// =========================================================================
// SHIIFT X - كود لوحة الوكيل المالي المعتمد (مطابق 100% لمعرفات الواجهة)
// =========================================================================

let currentAgent = null;

// دالة إظهار التنبيهات باستخدام custom-toast
function showToast(message, isError = false) {
    const toast = document.getElementById('custom-toast');
    if (!toast) {
        alert(message);
        return;
    }
    toast.textContent = message;
    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-2 rounded-xl text-xs font-semibold shadow-xl transition-all duration-300 ${
        isError ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
    }`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. فحص جلسة تسجيل الدخول
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session) {
        window.location.replace('index.html');
        return;
    }

    // 2. التحقق من صلاحية الوكيل
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

    // 3. عرض بيانات الوكيل ورصيده بالمعرفات الحقيقية
    renderAgentHeader(profile);

    // 4. ربط زر الشحن الفوري للعميل
    setupDirectTransfer();

    // 5. تحميل الطلبات المعلقة وسجل العمليات
    await loadPendingDeposits();
    await loadAgentHistory();
});

// عرض معلومات الوكيل ورصيد السيولة
function renderAgentHeader(agent) {
    const emailEl = document.getElementById('agent-email-display');
    const balanceEl = document.getElementById('agent-float-balance');

    if (emailEl) {
        const displayName = [agent.first_name, agent.last_name].filter(Boolean).join(' ');
        emailEl.textContent = displayName ? `${displayName} (${agent.email})` : agent.email;
    }

    if (balanceEl) {
        balanceEl.textContent = `$${Number(agent.balance || 0).toFixed(2)}`;
    }
}

// ربط زر الشحن المباشر للعميل
function setupDirectTransfer() {
    const submitBtn = document.getElementById('submit-btn');
    const emailInput = document.getElementById('target-email');
    const amountInput = document.getElementById('transfer-amount');

    if (!submitBtn || !emailInput || !amountInput) return;

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const amount = Number(amountInput.value);

        if (!email) {
            showToast('يرجى كتابة البريد الإلكتروني للعميل', true);
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            showToast('يرجى تحديد مبلغ صالح للشحن', true);
            return;
        }

        if (Number(currentAgent.balance || 0) < amount) {
            showToast('رصيدك المتاح (Float Balance) لا يكفي لتنفيذ هذه العملية', true);
            return;
        }

        if (!confirm(`هل أنت متأكد من تحويل مبلغ $${amount} إلى العميل (${email}) وخصمه من رصيدك؟`)) {
            return;
        }

        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'جاري تنفيذ التحويل...';

        try {
            const { data, error } = await supabase.rpc('agent_process_deposit', {
                p_target_user_email: email,
                p_amount: amount,
                p_notes: 'شحن مباشر من سيولة الوكيل'
            });

            if (error) throw error;

            if (data.status === 'success') {
                showToast(data.message || 'تم شحن المحفظة للعميل بنجاح ✓');
                emailInput.value = '';
                amountInput.value = '';

                // تحديث رصيد الوكيل في الواجهة
                const { data: updatedProfile } = await supabase
                    .from('profiles')
                    .select('balance')
                    .eq('id', currentAgent.id)
                    .single();

                if (updatedProfile) {
                    currentAgent.balance = updatedProfile.balance;
                    renderAgentHeader(currentAgent);
                }

                // تحديث السجل فوراً
                await loadAgentHistory();
            } else {
                showToast(data.message || 'تعذر إتمام العملية', true);
            }
        } catch (err) {
            showToast('حدث خطأ: ' + err.message, true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
}

// جلب وعرض طلبات الإيداع المعلقة
async function loadPendingDeposits() {
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

// اعتماد طلب الإيداع
window.approveDepositOrder = async function(orderId) {
    if (!confirm('تأكيد استلام الحوالة وشحن الرصيد لحساب العميل الآن؟')) return;

    try {
        const { data, error } = await supabase.rpc('agent_process_customer_deposit', {
            p_order_id: orderId,
            p_action: 'approve'
        });

        if (error) throw error;
        if (data.status === 'success') {
            showToast(data.message);
            await loadPendingDeposits();
            await loadAgentHistory();
        } else {
            showToast(data.message || 'حدث خطأ', true);
        }
    } catch (err) {
        showToast('تعذر التنفيذ: ' + err.message, true);
    }
};

// رفض طلب الإيداع
window.rejectDepositOrder = async function(orderId) {
    const reason = prompt('أدخل سبب الرفض (يظهر للعميل وفي سجل الرقابة):');
    if (reason === null) return;

    try {
        const { data, error } = await supabase.rpc('agent_process_customer_deposit', {
            p_order_id: orderId,
            p_action: 'reject',
            p_reason: reason
        });

        if (error) throw error;
        if (data.status === 'success') {
            showToast(data.message);
            await loadPendingDeposits();
            await loadAgentHistory();
        } else {
            showToast(data.message || 'حدث خطأ', true);
        }
    } catch (err) {
        showToast('تعذر الرفض: ' + err.message, true);
    }
};

// تحميل وعرض سجل العمليات
async function loadAgentHistory() {
    const container = document.getElementById('agent-tx-container');
    if (!container) return;

    try {
        const { data: txs, error } = await supabase.rpc('get_agent_transactions');
        if (error) throw error;

        if (!txs || txs.length === 0) {
            container.innerHTML = `
                <div class="py-6 text-center text-xs text-slate-500">
                    لا توجد عمليات سابقة في السجل حتى الآن.
                </div>
            `;
            return;
        }

        container.innerHTML = txs.map(t => {
            const isCompleted = t.status === 'completed' || t.status === 'approved';
            const statusBadge = isCompleted 
                ? '<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-semibold">ناجحة</span>'
                : '<span class="px-2 py-0.5 rounded text-[10px] bg-rose-950/80 text-rose-400 border border-rose-800 font-semibold">مرفوضة</span>';

            return `
                <div class="p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl mb-2 flex justify-between items-center gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-bold text-white">${t.target_name || 'عميل'}</span>
                            ${statusBadge}
                        </div>
                        <div class="text-[11px] text-slate-400 mt-1">
                            <span>${t.target_email || '—'}</span>
                            ${t.notes ? `<span class="mr-2 text-slate-300">• ${t.notes}</span>` : ''}
                        </div>
                        <div class="text-[10px] text-slate-500 mt-0.5 font-mono">
                            ${new Date(t.created_at).toLocaleString('ar-EG')}
                        </div>
                    </div>
                    <div class="text-left font-mono">
                        <div class="text-base font-bold text-emerald-400">$${Number(t.amount).toFixed(2)}</div>
                        ${Number(t.commission_earned) > 0 ? `<div class="text-[11px] text-indigo-400">+${Number(t.commission_earned).toFixed(2)}$ عمولة</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading history:', err);
        container.innerHTML = `<p class="text-rose-400 text-xs p-3">تعذر تحميل السجل: ${err.message}</p>`;
    }
}
