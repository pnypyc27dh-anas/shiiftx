// ========================================================================
// SHIIFT X — وحدة لوحة الوكيل المالي (Agent Dashboard App)
// ========================================================================

let currentAgentUser = null;

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

    // 3. عرض الرصيد المتاح للوكيل (Float)
    const availableFloat = parseFloat(prof.balance || 0);
    const balanceEl = document.getElementById('agent-float-balance');
    if (balanceEl) {
        balanceEl.innerText = '$' + availableFloat.toFixed(2);
    }
    
    loadAgentTransactions();
});

// معالجة التحويل الفوري لمحفظة العميل
async function handleAgentTransfer(e) {
    e.preventDefault();
    const email = document.getElementById('target-email').value.trim();
    const amount = parseFloat(document.getElementById('transfer-amount').value);
    const btn = document.getElementById('submit-btn');

    if (!email || isNaN(amount) || amount <= 0) return showToast("يرجى إدخال بيانات صحيحة.");

    btn.disabled = true;
    btn.innerText = "جاري التنفيذ...";

    try {
        // استخراج اسم الوكيل المعتمد (الاسم الأول والأخير)
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
                currentAgentProfile.balance = prof.balance;
                document.getElementById('agent-float-balance').innerText = '$' + Number(prof.balance).toFixed(2);
            }
            loadAgentTransactions();
        } else {
            showToast(data?.message || "فشلت عملية التحويل.");
        }
    } catch (err) {
        showToast("خطأ: " + (err.message || err));
    } finally {
        btn.disabled = false;
        btn.innerText = "تنفيذ التحويل الفوري للعميل";
    }
}

// جلب سجل تحويلات وعمولات الوكيل وعرض الاسم والبريد بطلب واحد فوري
async function loadAgentTransactions() {
    const container = document.getElementById('agent-tx-container');
    
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
            
            const item = document.createElement('div');
            item.className = "p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs";
            item.innerHTML = `
                <div class="space-y-0.5">
                    <span class="font-bold text-slate-800 dark:text-slate-100 block">${customerName}</span>
                    <span class="text-[11px] text-slate-500 dark:text-slate-400 font-mono block">${customerEmail}</span>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono block">${dateStr}</span>
                </div>
                <div class="text-left font-mono">
                    <span class="font-black text-amber-600 dark:text-amber-400 block">-$${Number(tx.amount).toFixed(2)}</span>
                    <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">+ عمولة $${Number(tx.commission_earned || 0).toFixed(2)}</span>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (err) {
        console.error("Agent Tx Load Error:", err);
        container.innerHTML = `<div class="p-4 text-center text-xs text-rose-500">حدث خطأ أثناء تحميل السجل.</div>`;
    }
}

// عرض رسائل التنبيه العائمة
function showToast(msg, isError = true) {
    const toast = document.getElementById('custom-toast');
    if (!toast) return;
    toast.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold transition-all ${isError ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'}`;
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
}
