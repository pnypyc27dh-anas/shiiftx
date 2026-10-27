// ========================================================================
// SHIIFT X — وحدة لوحة الوكيل المالي (Agent Dashboard App)
// ========================================================================

let currentAgentUser = null;
let currentAgentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. التحقق من وجود جلسة مسجلة
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session || !session.user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentAgentUser = session.user;
    
    const emailDisplay = document.getElementById('agent-email-display');
    if (emailDisplay) {
        emailDisplay.innerText = currentAgentUser.email || 'حساب وكيل معتمد';
    }

    // 2. التحقق من رتبة المستخدم (agent أو admin)
    const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentAgentUser.id)
        .single();
    
    if (profError || !prof || (prof.role !== 'agent' && prof.role !== 'admin')) {
        alert("غير مصرح بالدخول: هذه اللوحة مخصصة للوكلاء الماليين (Agents) حصراً.");
        window.location.href = 'index.html';
        return;
    }

    currentAgentProfile = prof;

    // 3. عرض الرصيد المتاح للوكيل
    const availableFloat = parseFloat(prof.balance || 0);
    const balanceEl = document.getElementById('agent-float-balance');
    if (balanceEl) {
        balanceEl.innerText = '$' + availableFloat.toFixed(2);
    }
    
    // 4. تحميل الطلبات المعلقة وسجل العمليات معاً
    loadAgentPendingOrders();
    loadAgentTransactions();
});

// معالجة التحويل الفوري المباشر (التحويل اليدوي)
async function handleAgentTransfer(e) {
    e.preventDefault();
    const email = document.getElementById('target-email').value.trim();
    const amount = parseFloat(document.getElementById('transfer-amount').value);
    const btn = document.getElementById('submit-btn');

    if (!email || isNaN(amount) || amount <= 0) return showToast("يرجى إدخال بيانات صحيحة.");

    btn.disabled = true;
    btn.innerText = "جاري التنفيذ...";

    try {
        const agentName = [currentAgentProfile?.first_name, currentAgentProfile?.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() || currentAgentProfile?.full_name || currentAgentUser?.email || 'الوكيل المالي';

        const depositNote = `تحويل نقدي مباشر من الوكيل (${agentName})`;

        const { data, error } = await supabase.rpc('agent_process_deposit', {
            p_target_user_email: email,
            p_amount: amount,
            p_notes: depositNote
        });

        if (error) throw error;

        if (data && data.status === 'success') {
            showToast(data.message, false);
            document.getElementById('target-email').value = '';
            document.getElementById('transfer-amount').value = '';
            
            const { data: prof } = await supabase.from('profiles').select('balance').eq('id', currentAgentUser.id).single();
            if (prof) {
                if (currentAgentProfile) currentAgentProfile.balance = prof.balance;
                document.getElementById('agent-float-balance').innerText = '$' + Number(prof.balance).toFixed(2);
            }
            loadAgentTransactions();
        } else {
            showToast(data?.message || "فشلت عملية التحويل.");
        }
    } catch (err) {
        console.error("Agent Transfer Error:", err);
        showToast("خطأ: " + (err.message || err));
    } finally {
        btn.disabled = false;
        btn.innerText = "تنفيذ التحويل الفوري للعميل";
    }
}

// ========================================================================
// 1. قسم معالجة طلبات الإيداع الواردة والمعلقة
// ========================================================================

async function loadAgentPendingOrders() {
    const container = document.getElementById('agent-pending-orders-container');
    if (!container) return;

    try {
        const { data: orders, error } = await supabase.rpc('get_agent_pending_deposit_orders');

        if (error) {
            console.error("Fetch Orders RPC Error:", error);
            container.innerHTML = `<div class="p-4 text-center text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl">فشل تحميل الطلبات: ${error.message}</div>`;
            return;
        }

        if (!orders || orders.length === 0) {
            container.innerHTML = `
                <div class="py-6 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1">
                    <i class="ph ph-tray text-2xl opacity-40"></i>
                    <p class="font-bold">لا توجد طلبات إيداع معلقة حالياً</p>
                </div>`;
            return;
        }

        container.innerHTML = "";
        orders.forEach(order => {
            const dateStr = new Date(order.created_at).toLocaleString('en-US', { hour12: false });
            const item = document.createElement('div');
            item.className = "p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-3";
            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-black text-slate-900 dark:text-slate-100 text-sm block">${order.customer_name}</span>
                            <span class="text-[10px] font-mono text-slate-400 select-all">#${order.transaction_ref}</span>
                        </div>
                        <span class="text-xs font-mono text-slate-500 dark:text-slate-400 block mt-0.5">${order.customer_email}</span>
                        <span class="text-[10px] text-slate-400 block mt-0.5">${dateStr}</span>
                    </div>
                    <div class="text-left font-mono">
                        <span class="text-base font-black text-emerald-600 dark:text-emerald-400 block">+$${Number(order.amount).toFixed(2)}</span>
                        <span class="text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 px-2 py-0.5 rounded-md font-bold">معلق</span>
                    </div>
                </div>

                <div class="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs flex justify-between items-center">
                    <span class="text-slate-500">بيان الدفع / رقم الإشعار:</span>
                    <span class="font-mono font-bold text-slate-800 dark:text-slate-200 select-all">${order.receipt_num}</span>
                </div>

                <div class="grid grid-cols-2 gap-2 pt-1">
                    <button onclick="approveDepositOrder('${order.order_id}', this)" class="btn-spring py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
                        <i class="ph-bold ph-check"></i>
                        <span>اعتماد وشحن فوري</span>
                    </button>
                    <button onclick="rejectDepositOrder('${order.order_id}', this)" class="btn-spring py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                        <i class="ph-bold ph-x"></i>
                        <span>رفض الطلب</span>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (err) {
        console.error("Load Orders Error:", err);
        container.innerHTML = `<div class="p-4 text-center text-xs text-rose-500">حدث خطأ أثناء تحميل الطلبات.</div>`;
    }
}

async function approveDepositOrder(orderId, btn) {
    if (!confirm("هل تأكدت من استلام المبلغ وترغب في إتمام الشحن للعميل واحتساب عمولتك الآن؟")) return;

    btn.disabled = true;
    const oldText = btn.innerHTML;
    btn.innerHTML = `<i class="ph ph-circle-notch animate-spin"></i> جاري الشحن...`;

    try {
        const { data, error } = await supabase.rpc('agent_approve_deposit_order', {
            p_order_id: orderId
        });

        if (error) throw error;

        if (data && data.status === 'success') {
            showToast(data.message, false);
            
            const { data: prof } = await supabase.from('profiles').select('balance').eq('id', currentAgentUser.id).single();
            if (prof && currentAgentProfile) {
                currentAgentProfile.balance = prof.balance;
                document.getElementById('agent-float-balance').innerText = '$' + Number(prof.balance).toFixed(2);
            }
            
            loadAgentPendingOrders();
            loadAgentTransactions();
        } else {
            showToast(data?.message || "فشل اعتماد الطلب.");
            btn.disabled = false;
            btn.innerHTML = oldText;
        }
    } catch (err) {
        console.error("Approve Deposit Order Error:", err);
        showToast("خطأ: " + (err.message || err));
        btn.disabled = false;
        btn.innerHTML = oldText;
    }
}

async function rejectDepositOrder(orderId, btn) {
    const reason = prompt("يرجى كتابة سبب الرفض:", "لم يتم استلام المبلغ أو رقم الإشعار غير مطابق");
    if (!reason) return;

    btn.disabled = true;

    try {
        const { data, error } = await supabase.rpc('agent_reject_deposit_order', {
            p_order_id: orderId,
            p_reason: reason
        });

        if (error) throw error;

        if (data && data.status === 'success') {
            showToast(data.message, false);
            loadAgentPendingOrders();
            loadAgentTransactions();
        } else {
            showToast(data?.message || "فشل رفض الطلب.");
            btn.disabled = false;
        }
    } catch (err) {
        console.error("Reject Deposit Order Error:", err);
        showToast("خطأ: " + (err.message || err));
        btn.disabled = false;
    }
}

// ========================================================================
// 2. سجل تحويلات الوكيل الشامل (مكتملة ومرفوضة)
// ========================================================================

async function loadAgentTransactions() {
    const container = document.getElementById('agent-tx-container');
    if (!container) return;
    
    try {
        const { data: txs, error } = await supabase.rpc('get_agent_transactions');

        if (error) {
            console.error("RPC Error:", error);
            container.innerHTML = `<div class="p-4 text-center text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl">فشل جلب السجل: ${error.message}</div>`;
            return;
        }

        if (!txs || txs.length === 0) {
            container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">لا توجد تحويلات مسجلة حتى الآن.</div>`;
            return;
        }

        container.innerHTML = "";
        txs.forEach(tx => {
            const customerName = tx.target_name || 'عميل مسجل';
            const customerEmail = tx.target_email || '—';
            const dateStr = new Date(tx.created_at).toLocaleString('en-US', { hour12: false });
            const isRejected = (tx.status === 'rejected');
            
            const item = document.createElement('div');
            item.className = "p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs";
            
            let statusMarkup = '';
            if (isRejected) {
                statusMarkup = `
                    <div class="text-left font-mono">
                        <span class="text-xs font-bold text-slate-400 line-through block">$${Number(tx.amount).toFixed(2)}</span>
                        <span class="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">مرفوض: ${tx.notes || 'ملغي'}</span>
                    </div>
                `;
            } else {
                statusMarkup = `
                    <div class="text-left font-mono">
                        <span class="font-black text-amber-600 dark:text-amber-400 block">-$${Number(tx.amount).toFixed(2)}</span>
                        <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">+ عمولة $${Number(tx.commission_earned || 0).toFixed(2)}</span>
                    </div>
                `;
            }

            item.innerHTML = `
                <div class="space-y-0.5">
                    <span class="font-bold text-slate-800 dark:text-slate-100 block">${customerName}</span>
                    <span class="text-[11px] text-slate-500 dark:text-slate-400 font-mono block">${customerEmail}</span>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono block">${dateStr}</span>
                </div>
                ${statusMarkup}
            `;
            container.appendChild(item);
        });
    } catch (err) {
        console.error("Agent Tx Load Error:", err);
        container.innerHTML = `<div class="p-4 text-center text-xs text-rose-500">حدث خطأ أثناء تحميل السجل.</div>`;
    }
}

function showToast(msg, isError = true) {
    const toast = document.getElementById('custom-toast');
    if (!toast) return;
    toast.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold transition-all ${isError ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'}`;
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
}
