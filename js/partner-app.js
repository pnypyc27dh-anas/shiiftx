// ========================================================================
// SHIIFT X — وحدة لوحة الشريك التسويقي (Marketing Partner Dashboard)
// ========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            alert("يجب تسجيل الدخول أولاً للوصول للوحة الشريك التسويقي.");
            window.location.href = 'index.html';
            return;
        }
        
        const emailDisplay = document.getElementById('partner-email-display');
        if (emailDisplay) {
            emailDisplay.innerText = session.user.email;
        }
        await loadDashboardData();
    } catch (err) {
        console.error("Auth init error:", err);
    }
});

async function loadDashboardData() {
    const couponsContainer = document.getElementById('coupons-container');
    const commContainer = document.getElementById('commissions-container');

    try {
        const { data, error } = await supabase.rpc('get_marketing_partner_dashboard');

        if (error) {
            console.error("RPC Error:", error);
            if (couponsContainer) {
                couponsContainer.innerHTML = `<div class="p-4 text-center text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl">فشل جلب البيانات: ${error.message}</div>`;
            }
            return;
        }

        if (!data || data.status === 'error') {
            alert(data?.message || "غير مصرح بالدخول: هذه اللوحة مخصصة للشركاء التسويقيين حصراً.");
            window.location.href = 'index.html';
            return;
        }

        // عرض الرصيد الحالي
        const balanceEl = document.getElementById('partner-balance');
        if (balanceEl) {
            balanceEl.innerText = '$' + Number(data.balance || 0).toFixed(2);
        }

        // عرض الأكواد الترويجية وإجمالي الاستخدامات
        const coupons = data.coupons || [];
        let totalUses = 0;

        if (couponsContainer) {
            if (coupons.length === 0) {
                couponsContainer.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">لا توجد أكواد خصم مربوطة بحسابك حالياً.</div>`;
            } else {
                couponsContainer.innerHTML = "";
                coupons.forEach(c => {
                    const validUses = Math.max(0, Number(c.usage_count || 0));
                    totalUses += validUses;
                    const badge = c.is_active 
                        ? `<span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md text-[10px] font-bold">نشط</span>`
                        : `<span class="px-2 py-0.5 bg-rose-500/10 text-rose-500 rounded-md text-[10px] font-bold">متوقف</span>`;

                    const div = document.createElement('div');
                    div.className = "p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs";
                    div.innerHTML = `
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="font-mono font-black text-base text-purple-600 dark:text-purple-400 tracking-wider select-all">${c.code}</span>
                                ${badge}
                            </div>
                            <span class="text-[11px] text-slate-500 block">خصم العميل: <b>${c.discount_percent}%</b> | عمولتك: <b>${c.commission_percent}%</b></span>
                        </div>
                        <div class="text-left">
                            <span class="text-[10px] text-slate-400 block">مرات الاستخدام</span>
                            <span class="font-mono font-black text-sm text-slate-800 dark:text-slate-200">${validUses} مرة</span>
                        </div>
                    `;
                    couponsContainer.appendChild(div);
                });
            }
        }
        
        const totalUsesEl = document.getElementById('total-uses');
        if (totalUsesEl) totalUsesEl.innerText = totalUses;

        // عرض سجل الأرباح والعمولات مع فحص دقيق للحالة
        const commissions = data.commissions || [];
        if (commContainer) {
            if (commissions.length === 0) {
                commContainer.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">لا توجد أرباح تسويقية مسجلة حتى الآن.</div>`;
            } else {
                commContainer.innerHTML = "";
                commissions.forEach(tx => {
                    const dateStr = new Date(tx.created_at).toLocaleString('ar-EG');
                    const statusKey = (tx.status || '').toLowerCase();
                    const rawDetails = tx.details || '';
                    
                    // التحقق الذكي من الإلغاء سواء من عمود status أو من نص المعاملة مباشرة
                    const isCancelled = statusKey === 'cancelled' || 
                                        statusKey === 'rejected' || 
                                        statusKey === 'ملغي' || 
                                        statusKey === 'ملغاة' || 
                                        rawDetails.includes('ملغاة') || 
                                        rawDetails.includes('ملغي');
                    
                    const isPending = !isCancelled && (statusKey === 'pending' || statusKey === 'معلق' || rawDetails.includes('معلقة'));

                    let amountMarkup = '';
                    let statusBadge = '';

                    if (isCancelled) {
                        amountMarkup = `
                            <span class="font-bold text-slate-400 line-through block">+$${Number(tx.amount).toFixed(2)}</span>
                            <span class="text-[10px] text-rose-500 font-bold block">ملغاة</span>
                        `;
                        statusBadge = `<span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/70">ملغاة</span>`;
                    } else if (isPending) {
                        amountMarkup = `
                            <span class="font-black text-amber-600 dark:text-amber-400 block">+$${Number(tx.amount).toFixed(2)}</span>
                            <span class="text-[10px] text-slate-400 block">معلقة</span>
                        `;
                        statusBadge = `<span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/70">قيد التدقيق</span>`;
                    } else {
                        amountMarkup = `
                            <span class="font-black text-emerald-600 dark:text-emerald-400 block">+$${Number(tx.amount).toFixed(2)}</span>
                            <span class="text-[10px] text-emerald-500 font-bold block">محققة ✓</span>
                        `;
                        statusBadge = `<span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70">محققة ✓</span>`;
                    }

                    const item = document.createElement('div');
                    item.className = "p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs";
                    item.innerHTML = `
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-slate-800 dark:text-slate-200 block">${rawDetails || 'عمولة تسويقية'}</span>
                                ${statusBadge}
                            </div>
                            <span class="text-[10px] text-slate-400 block font-mono">${dateStr} • ${tx.transaction_ref || ''}</span>
                        </div>
                        <div class="text-left font-mono">
                            ${amountMarkup}
                        </div>
                    `;
                    commContainer.appendChild(item);
                });
            }
        }
    } catch (err) {
        console.error("Dashboard Render Error:", err);
        if (couponsContainer) {
            couponsContainer.innerHTML = `<div class="p-4 text-center text-xs text-rose-500">حدث خطأ أثناء عرض البيانات: ${err.message}</div>`;
        }
    }
}
