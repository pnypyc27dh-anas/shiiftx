// ========================================================================
// SHIIFT X — وحدة المساعد الذكي وخدمة العملاء (Chat Assistant)
// ========================================================================

// 1. فتح وإغلاق نافذة المحادثة
function toggleChat() {
    const modal = document.getElementById('chat-modal');
    if (!modal) return;
    const isOpen = modal.style.display === 'flex';
    modal.style.display = isOpen ? 'none' : 'flex';
    
    if (!isOpen) {
        const messagesArea = document.getElementById('chat-messages');
        if (messagesArea && messagesArea.children.length <= 1) {
            renderMainMenu();
        }
    }
}

// 2. الاستماع لزر Enter في حقل الإدخال
function handleKeyPress(e) {
    if (e.key === 'Enter') sendManualInput();
}

// 3. عرض القائمة التفاعلية الرئيسية للبوت
function renderMainMenu() {
    const messagesArea = document.getElementById('chat-messages');
    if (!messagesArea) return;

    const div = document.createElement('div');
    div.className = 'chat-bubble-msg msg-bot';
    div.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center gap-2 pb-1.5 border-b border-slate-200 dark:border-slate-700/60">
                <span class="w-2 h-2 rounded-full bg-blue-600 dark:bg-amber-400 animate-pulse"></span>
                <p class="font-bold text-xs text-slate-800 dark:text-slate-100">مرحباً بك في مركز خدمة SHIIFTX</p>
            </div>
            <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">حدد الخدمة المطلوبة للحصول على بياناتها وتفاصيلها بشكل فوري:</p>
            <div class="grid grid-cols-1 gap-2 pt-1">
                <button onclick="botFetchPlatforms()" class="w-full text-right bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center justify-between group shadow-sm">
                    <span class="flex items-center gap-2.5">
                        <span class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-amber-500/10 text-blue-600 dark:text-amber-400 flex items-center justify-center text-sm border border-blue-100 dark:border-amber-500/20">
                            <i class="ph-fill ph-squares-four"></i>
                        </span>
                        <span>البطاقات، الاشتراكات وشحن الألعاب</span>
                    </span>
                    <i class="ph ph-caret-left text-slate-400 group-hover:text-blue-600 dark:group-hover:text-amber-400 transition"></i>
                </button>

                <button onclick="botFetchAgents()" class="w-full text-right bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center justify-between group shadow-sm">
                    <span class="flex items-center gap-2.5">
                        <span class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm border border-emerald-100 dark:border-emerald-500/20">
                            <i class="ph-fill ph-wallet"></i>
                        </span>
                        <span>طرق الإيداع وعناوين المحافظ المعتمدة</span>
                    </span>
                    <i class="ph ph-caret-left text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition"></i>
                </button>

                <button onclick="botPromptTracking()" class="w-full text-right bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center justify-between group shadow-sm">
                    <span class="flex items-center gap-2.5">
                        <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-blue-500/10 text-indigo-600 dark:text-blue-400 flex items-center justify-center text-sm border border-indigo-100 dark:border-blue-500/20">
                            <i class="ph-fill ph-receipt"></i>
                        </span>
                        <span>تتبع حالة طلبك بالرقم المرجعي</span>
                    </span>
                    <i class="ph ph-caret-left text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-blue-400 transition"></i>
                </button>

                <button onclick="botDirectSupport()" class="w-full text-right bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center justify-between group shadow-sm">
                    <span class="flex items-center gap-2.5">
                        <span class="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm border border-purple-100 dark:border-purple-500/20">
                            <i class="ph-fill ph-headset"></i>
                        </span>
                        <span>التحدث مع الدعم الفني المباشر</span>
                    </span>
                    <i class="ph ph-caret-left text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition"></i>
                </button>
            </div>
        </div>
    `;
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// 4. استعراض المنصات المتاحة
async function botFetchPlatforms() {
    appendUserAction("استعراض الخدمات والاشتراكات");
    const loading = appendLoading();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_platforms' })
        });
        const data = await res.json();
        loading.remove();

        const messagesArea = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'chat-bubble-msg msg-bot';

        if (data.platforms && data.platforms.length > 0) {
            let btns = data.platforms.map(p => `
                <button onclick="botFetchPackages('${p}')" class="bg-slate-100 hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:hover:bg-amber-400 dark:hover:text-slate-900 text-slate-700 dark:text-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold transition border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                    <i class="ph-bold ph-caret-left text-[10px] opacity-60"></i>
                    <span>${p}</span>
                </button>
            `).join('');

            div.innerHTML = `
                <div class="space-y-2.5">
                    <p class="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <i class="ph-fill ph-tag text-blue-600 dark:text-amber-400"></i>
                        <span>اختر المنصة أو نوع الخدمة لعرض الباقات:</span>
                    </p>
                    <div class="flex flex-wrap gap-1.5 pt-1 mb-2">${btns}</div>
                    <button onclick="renderMainMenu()" class="text-[11px] text-blue-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 pt-1">
                        <i class="ph ph-arrow-u-up-right"></i>
                        <span>العودة للقائمة الرئيسية</span>
                    </button>
                </div>
            `;
        } else {
            div.innerHTML = `
                <p class="text-xs text-slate-600 dark:text-slate-300">لا توجد خدمات مضافة حالياً في المتجر.</p>
                <button onclick="renderMainMenu()" class="text-[11px] text-blue-600 dark:text-amber-400 font-bold hover:underline pt-2 block">← العودة للقائمة</button>
            `;
        }
        messagesArea.appendChild(div);
        messagesArea.scrollTop = messagesArea.scrollHeight;
    } catch (e) {
        loading.remove();
    }
}

// 5. استعراض الباقات التابعة لمنصة
async function botFetchPackages(platform) {
    appendUserAction(`${platform}`);
    const loading = appendLoading();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_packages', platform: platform })
        });
        const data = await res.json();
        loading.remove();

        const messagesArea = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'chat-bubble-msg msg-bot';

        if (data.packages && data.packages.length > 0) {
            let items = data.packages.map(p => `
                <div class="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 text-xs transition">
                    <div class="pr-1">
                        <span class="font-bold text-slate-800 dark:text-slate-100 block">${p.package_name}</span>
                        <span class="inline-flex items-center gap-1 text-[10px] font-medium mt-0.5 ${p.product_type === 'CODE' ? 'text-emerald-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}">
                            <i class="${p.product_type === 'CODE' ? 'ph-bold ph-key' : 'ph-bold ph-identification-card'} text-[10px]"></i>
                            ${p.product_type === 'CODE' ? 'كود رقمي فوري' : 'شحن معرف ID مباشر'}
                        </span>
                    </div>
                    <span class="font-black text-blue-600 dark:text-amber-400 text-sm font-mono bg-blue-50 dark:bg-amber-400/10 px-2 py-1 rounded-lg border border-blue-100 dark:border-amber-400/20">$${parseFloat(p.price).toFixed(2)}</span>
                </div>
            `).join('');

            div.innerHTML = `
                <div class="space-y-2.5">
                    <div class="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-700/60">
                        <span class="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <i class="ph-fill ph-check-circle text-blue-600 dark:text-amber-400"></i>
                            <span>باقات وأسعار (${platform}):</span>
                        </span>
                        <span class="text-[10px] text-slate-500 dark:text-slate-400">${data.packages.length} باقة</span>
                    </div>
                    <div class="space-y-1.5 max-h-56 overflow-y-auto pr-1 select-text">${items}</div>
                    <div class="flex items-center gap-3 pt-2 text-[11px] border-t border-slate-200 dark:border-slate-700/50">
                        <button onclick="botFetchPlatforms()" class="text-blue-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1">
                            <i class="ph ph-caret-right"></i>
                            <span>خدمة أخرى</span>
                        </button>
                        <span class="text-slate-300 dark:text-slate-600">|</span>
                        <button onclick="renderMainMenu()" class="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition">
                            القائمة الرئيسية
                        </button>
                    </div>
                </div>
            `;
        } else {
            div.innerHTML = `
                <p class="text-xs text-slate-600 dark:text-slate-300">لا توجد باقات متوفرة حالياً لهذه المنصة.</p>
                <button onclick="botFetchPlatforms()" class="text-[11px] text-blue-600 dark:text-amber-400 font-bold hover:underline pt-1 block">← اختيار منصة أخرى</button>
            `;
        }
        messagesArea.appendChild(div);
        messagesArea.scrollTop = messagesArea.scrollHeight;
    } catch (e) {
        loading.remove();
    }
}

// 6. استعراض طرق الإيداع والمحافظ المعتمدة
async function botFetchAgents() {
    appendUserAction("طرق الإيداع والمحافظ");
    const loading = appendLoading();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_agents' })
        });
        const data = await res.json();
        loading.remove();

        const messagesArea = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'chat-bubble-msg msg-bot';

        if (data.agents && data.agents.length > 0) {
            let agentCards = data.agents.map(a => `
                <div class="p-2.5 bg-slate-50 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 transition">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <i class="ph-fill ph-wallet text-emerald-600 dark:text-emerald-400 text-sm"></i>
                            <span>${a.payment_method}</span>
                        </span>
                        <span class="text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">${a.agent_name}</span>
                    </div>
                    <div class="flex items-center justify-between bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800/80" dir="ltr">
                        <code class="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 select-all tracking-wider">${a.wallet_address}</code>
                        <button onclick="copyToClipboard('${a.wallet_address}')" class="text-[10px] bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1">
                            <i class="ph-bold ph-copy"></i>
                            <span>نسخ</span>
                        </button>
                    </div>
                </div>
            `).join('');

            div.innerHTML = `
                <div class="space-y-2.5">
                    <p class="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5 pb-1 border-b border-slate-200 dark:border-slate-700/60">
                        <i class="ph-fill ph-shield-check text-emerald-600 dark:text-emerald-400"></i>
                        <span>المحافظ المعتمدة لشحن الرصيد:</span>
                    </p>
                    <div class="space-y-2 mb-2 max-h-56 overflow-y-auto pr-1">${agentCards}</div>
                    <div class="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed flex items-start gap-1.5">
                        <i class="ph-fill ph-info text-sm flex-shrink-0 mt-0.5"></i>
                        <span>بعد التحويل، توجه لقسم <b>شحن الرصيد</b> وأدخل رقم إشعار الحوالة لتأكيد شحن محفظتك.</span>
                    </div>
                    <button onclick="renderMainMenu()" class="text-[11px] text-blue-600 dark:text-amber-400 font-bold hover:underline pt-1 flex items-center gap-1">
                        <i class="ph ph-arrow-u-up-right"></i>
                        <span>العودة للقائمة الرئيسية</span>
                    </button>
                </div>
            `;
        } else {
            div.innerHTML = `<p class="text-xs text-slate-600 dark:text-slate-300">بيانات المحافظ قيد التحديث.</p>`;
        }
        messagesArea.appendChild(div);
        messagesArea.scrollTop = messagesArea.scrollHeight;
    } catch (e) {
        loading.remove();
    }
}

// 7. توجيه العميل لكتابة رقم الطلب للتتبع
function botPromptTracking() {
    appendUserAction("تتبع حالة طلب");
    const messagesArea = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-bubble-msg msg-bot';
    div.innerHTML = `
        <div class="space-y-2">
            <p class="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <i class="ph-fill ph-magnifying-glass text-blue-600 dark:text-blue-400"></i>
                <span>أدخل الرقم المرجعي للطلب أدناه:</span>
            </p>
            <p class="text-[11px] text-slate-600 dark:text-slate-300">اكتب رمز العملية (مثال: <code class="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600 dark:text-amber-400 font-mono">TX-123456</code>) في خانة المراسلة ثم اضغط إرسال.</p>
        </div>
    `;
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    const input = document.getElementById('chat-input');
    if (input) {
        input.placeholder = "اكتب رقم المعاملة TX-... واضغط إرسال";
        input.focus();
    }
}

// 8. زر التحويل للدعم البشري المباشر
function botDirectSupport() {
    appendUserAction("التحدث مع الدعم المباشر");
    const messagesArea = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-bubble-msg msg-bot';
    div.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-slate-700/60">
                <i class="ph-fill ph-headset text-purple-600 dark:text-purple-400 text-sm"></i>
                <p class="text-xs font-bold text-slate-800 dark:text-slate-100">فريق خدمة العملاء متواجد لمساعدتك:</p>
            </div>
            <p class="text-[11px] text-slate-600 dark:text-slate-300">للاستفسارات الخاصة أو معالجة الحالات الفردية، يسعدنا تواصلك المباشر:</p>
            <div class="flex gap-2">
                <a href="https://wa.me/${OFFICIAL_WHATSAPP_NUMBER}" target="_blank" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-center py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md">
                    <i class="ph-fill ph-whatsapp-logo text-base"></i>
                    <span>محادثة واتساب فورية</span>
                </a>
                <button onclick="if(typeof openSupportModal==='function') openSupportModal();" class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition">
                    قنوات أخرى
                </button>
            </div>
            <button onclick="renderMainMenu()" class="text-[11px] text-blue-600 dark:text-amber-400 font-bold hover:underline block pt-1">
                ← العودة للقائمة الرئيسية
            </button>
        </div>
    `;
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// 9. معالجة الإدخال اليدوي والبحث بالرقم المرجعي
async function sendManualInput() {
    const input = document.getElementById('chat-input');
    const val = input.value.trim();
    if (!val) return;

    appendUserAction(val);
    input.value = '';
    input.placeholder = "اكتب رقم الطلب أو استفسارك...";

    const loading = appendLoading();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: val })
        });
        const data = await res.json();
        loading.remove();

        const messagesArea = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'chat-bubble-msg msg-bot';

        if (data.order) {
            const o = data.order;
            const statusText = o.status === 'completed' ? '<span class="text-emerald-400">مكتمل بنجاح ✓</span>' :
                               o.status === 'pending' ? '<span class="text-amber-400">قيد المعالجة ⏳</span>' :
                               o.status === 'rejected' ? '<span class="text-rose-400">مرفوض ✕</span>' : o.status;

            div.innerHTML = `
                <div class="space-y-2 text-xs">
                    <div class="flex justify-between items-center pb-1.5 border-b border-slate-700/60 font-bold text-slate-100">
                        <span> تفاصيل الطلب:</span>
                        <span class="font-mono text-amber-400">${o.transaction_ref}</span>
                    </div>
                    <div class="space-y-1 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        <p><span class="text-slate-400">الخدمة:</span> <b class="text-slate-100">${o.details || o.transaction_type}</b></p>
                        <p><span class="text-slate-400">المبلغ:</span> <b class="text-slate-100">$${o.amount}</b></p>
                        <p><span class="text-slate-400">الحالة:</span> <b>${statusText}</b></p>
                    </div>
                    <p class="text-[10px] text-slate-400">🔒 الأكواد الرقمية محفوظة دائماً في صفحة سجل المعاملات بحسابك.</p>
                    <button onclick="renderMainMenu()" class="text-[11px] text-amber-400 font-bold hover:underline pt-1 block">
                        ← العودة للقائمة الرئيسية
                    </button>
                </div>
            `;
        } else if (data.isOrderSearch) {
            div.innerHTML = `
                <div class="space-y-2">
                    <p class="text-xs text-rose-400 font-bold">لم يتم العثور على طلب بهذا الرقم المرجعي. يرجى مراجعة صفحة المعاملات.</p>
                    <button onclick="renderMainMenu()" class="text-[11px] text-amber-400 font-bold hover:underline block">العودة للقائمة</button>
                </div>
            `;
        } else {
            renderMainMenu();
            return;
        }
        messagesArea.appendChild(div);
        messagesArea.scrollTop = messagesArea.scrollHeight;
    } catch (e) {
        loading.remove();
    }
}

// 10. أدوات إظهار الرسائل والمؤشرات البصرية
function appendUserAction(text) {
    const messagesArea = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-bubble-msg msg-user';
    div.innerText = text;
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function appendLoading() {
    const messagesArea = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-bubble-msg msg-bot';
    div.innerHTML = `<i class="ph ph-dots-three animate-pulse text-lg text-amber-400"></i> <span class="text-xs text-slate-400 mr-1.5">جاري التحميل...</span>`;
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    return div;
}
