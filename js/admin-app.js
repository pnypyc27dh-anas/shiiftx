// ========================================================================
// SHIIFT X — وحدة لوحة الإدارة والتحكم (Admin App Controller)
// ========================================================================

let currentAdminUser = null;
let allProductsCache = [];
let inventoryProductsCache = [];
let editingAffiliateUserId = null;

async function checkAdminAuth() {
    try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !session) {
            showAuthAlert("⚠️ يجب تسجيل الدخول بالحساب الإداري من المتجر أولاً لتفعيل العمليات.");
            return;
        }

        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('id, email, role')
            .eq('id', session.user.id)
            .single();

        if (profileErr || !profile || profile.role !== 'admin') {
            showAuthAlert(`⛔ هذا الحساب (${profile?.role || 'مستخدم عادي'}) لا يملك صلاحيات المشرف.`);
            return;
        }

        currentAdminUser = session.user;
        const alertBar = document.getElementById('auth-alert-bar');
        if (alertBar) alertBar.classList.add('hidden');
        loadAllAdminData();
    } catch (err) {
        console.error("Auth Guard Error:", err);
        showAuthAlert("حدث خطأ في الاتصال بالخادم: " + (err.message || err));
    }
}

function showAuthAlert(msg) {
    const bar = document.getElementById('auth-alert-bar');
    const txt = document.getElementById('auth-alert-text');
    if (bar && txt) {
        txt.innerText = msg;
        bar.classList.remove('hidden');
    }
}

async function loadAllAdminData() {
    try { loadKPIs(); } catch (e) {}
    try { loadPendingOrders(); } catch (e) {}
    try { loadPendingDeposits(); } catch (e) {}
    try { loadProducts(); } catch (e) {}
    try { loadInventoryData(); } catch (e) {}
}

async function loadKPIs() {
    const { data: kpis } = await supabase.rpc('admin_get_kpis');
    if (kpis) {
        document.getElementById('kpi-sales-today').innerText = "$" + Number(kpis.sales_today).toFixed(2);
        document.getElementById('kpi-sales-month').innerText = "$" + Number(kpis.sales_month).toFixed(2);
        document.getElementById('kpi-commissions').innerText = "$" + Number(kpis.total_commissions).toFixed(2);
        document.getElementById('kpi-balances').innerText = "$" + Number(kpis.customer_balances).toFixed(2);

        const ordersBadge = document.getElementById('badge-orders-count');
        if (ordersBadge) {
            ordersBadge.innerText = kpis.pending_orders;
            ordersBadge.classList.toggle('hidden', kpis.pending_orders === 0);
        }

        const depositsBadge = document.getElementById('badge-deposits-count');
        if (depositsBadge) {
            depositsBadge.innerText = kpis.pending_deposits;
            depositsBadge.classList.toggle('hidden', kpis.pending_deposits === 0);
        }
    }
}

async function loadPendingOrders() {
    const tbody = document.getElementById('orders-tbody');
    const { data: orders } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'pending')
        .eq('delivery_type', 'DIRECT_ID')
        .order('created_at', { ascending: false });

    if (!orders || orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">لا توجد أي طلبات شحن ID معلقة حالياً ✓</td></tr>`;
        return;
    }

    tbody.innerHTML = orders.map(o => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
            <td class="py-3 font-mono text-[11px] text-slate-400">${o.transaction_ref}</td>
            <td class="py-3 font-bold text-slate-800 dark:text-slate-100">${o.details}</td>
            <td class="py-3 font-mono font-black text-amber-600 dark:text-amber-400 select-all">${o.player_id || '---'}</td>
            <td class="py-3 font-mono font-bold">$${Number(o.amount).toFixed(2)}</td>
            <td class="py-3 text-center flex justify-center gap-2">
                <button onclick="handleProcessOrder('${o.id}', 'complete')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold">
                    تم الشحن ✓
                </button>
                <button onclick="handleProcessOrder('${o.id}', 'refund')" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold">
                    رفض واسترجاع ✕
                </button>
            </td>
        </tr>
    `).join('');
}

async function handleProcessOrder(id, action) {
    const msg = action === 'complete' 
        ? 'هل تم شحن هذا الحساب بالفعل داخل اللعبة وتريد تحرير عمولة الوكيل؟' 
        : 'هل أنت متأكد من رفض الطلب، إعادة المبلغ للعميل، وإلغاء العمولة المعلقة؟';
    if (!confirm(msg)) return;

    const reason = action === 'refund' ? prompt('سبب الرفض:', 'معرف الحساب غير صحيح') : '';

    const { data, error } = await supabase.rpc('admin_process_order', {
        p_tx_id: id,
        p_action: action,
        p_reason: reason || ''
    });

    if (error || (data && data.status === 'error')) {
        alert(error ? error.message : data.message);
    } else {
        alert(data.message);
        loadAllAdminData();
    }
}

async function loadPendingDeposits() {
    const tbody = document.getElementById('deposits-tbody');
    if (!tbody) return;

    const { data: deposits } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'pending')
        .in('transaction_type', ['Deposit', 'شحن رصيد'])
        .order('created_at', { ascending: false });

    if (!deposits || deposits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">لا توجد أي طلبات شحن رصيد معلقة حالياً ✓</td></tr>`;
        return;
    }

    tbody.innerHTML = deposits.map(d => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
            <td class="py-3 font-mono text-[11px] text-slate-400">${d.transaction_ref}</td>
            <td class="py-3 font-bold text-slate-800 dark:text-slate-100">${d.details}</td>
            <td class="py-3 text-center font-mono font-bold">${d.player_id || '---'}</td>
            <td class="py-3 font-mono font-black text-emerald-600 dark:text-emerald-400">+$${Number(d.amount).toFixed(2)}</td>
            <td class="py-3 text-[10px] text-slate-400">${new Date(d.created_at).toLocaleString('ar-EG')}</td>
            <td class="py-3 text-center flex justify-center gap-2">
                <button onclick="handleProcessDeposit('${d.id}', 'approve')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition">تأكيد ✓</button>
                <button onclick="handleProcessDeposit('${d.id}', 'reject')" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition">رفض ✕</button>
            </td>
        </tr>
    `).join('');
}

async function handleProcessDeposit(txId, action) {
    const confirmMsg = action === 'approve'
        ? 'هل وصلك التحويل المالي بالفعل وتريد إيداع المبلغ في محفظة العميل الآن؟'
        : 'هل أنت متأكد من رفض طلب الشحن وإلغائه؟';

    if (!confirm(confirmMsg)) return;

    const reason = action === 'reject' ? prompt('سبب الرفض (اختياري):', 'لم يتم استلام المبلغ في الحساب') : '';

    try {
        const { data, error } = await supabase.rpc('admin_process_deposit', {
            p_tx_id: txId,
            p_action: action,
            p_reason: reason || ''
        });

        if (error) throw error;
        if (data && data.status === 'success') {
            alert(data.message);
            loadAllAdminData();
        } else {
            alert("فشل الإجراء: " + (data ? data.message : "حدث خطأ غير متوقع"));
        }
    } catch (err) {
        console.error("Deposit Process Error:", err);
        alert("حدث خطأ في الاتصال: " + (err.message || err));
    }
}

// مخزون الأكواد الرقمية (code_inventory)
async function loadInventoryData() {
    const tbody = document.getElementById('inventory-tbody');
    const select = document.getElementById('restock-product-select');

    try {
        const { data: prods, error: prodErr } = await supabase
            .from('products')
            .select('*')
            .eq('product_type', 'CODE')
            .order('platform', { ascending: true });

        if (prodErr) throw prodErr;
        inventoryProductsCache = prods || [];

        if (select) {
            if (inventoryProductsCache.length === 0) {
                select.innerHTML = `<option value="" disabled selected>لا توجد منتجات رقمية (CODE)</option>`;
            } else {
                const currentVal = select.value;
                select.innerHTML = `<option value="" disabled ${!currentVal ? 'selected' : ''}>-- اختر الباقة لتزويدها بالأكواد --</option>` +
                    inventoryProductsCache.map(p => `<option value="${p.id}" ${currentVal === p.id ? 'selected' : ''}>${p.platform} - ${p.package_name} ($${Number(p.price).toFixed(2)})</option>`).join('');
            }
        }

        if (!tbody) return;

        if (inventoryProductsCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">لا توجد منتجات رقمية من نوع كود</td></tr>`;
            return;
        }

        const { data: codes, error: codesErr } = await supabase
            .from('code_inventory')
            .select('product_id, status');

        if (codesErr) console.error("Error fetching code_inventory:", codesErr);

        const allCodes = codes || [];

        tbody.innerHTML = inventoryProductsCache.map(p => {
            const prodCodes = allCodes.filter(c => c.product_id === p.id);
            const available = prodCodes.filter(c => c.status === 'available').length;
            const sold = prodCodes.filter(c => c.status && c.status !== 'available').length;

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="py-3 font-bold text-slate-800 dark:text-slate-100">${p.platform}</td>
                    <td class="py-3 font-medium text-slate-700 dark:text-slate-200">${p.package_name}</td>
                    <td class="py-3 font-mono font-bold">$${Number(p.price).toFixed(2)}</td>
                    <td class="py-3 text-center">
                        <span class="px-2.5 py-1 rounded-full text-xs font-mono font-black ${available > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-500'}">
                            ${available} متوفر
                        </span>
                    </td>
                    <td class="py-3 text-center font-mono text-slate-400">${sold}</td>
                    <td class="py-3 text-center">
                        <button onclick="quickSelectRestock('${p.id}')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition">
                            شحن أكواد +
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Inventory Load Error:", err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-rose-500">فشل تحميل المخزون: ${err.message}</td></tr>`;
    }
}

function quickSelectRestock(productId) {
    const select = document.getElementById('restock-product-select');
    if (select) {
        select.value = productId;
        updateSelectedStockBadge();
        const codesInput = document.getElementById('restock-codes');
        if (codesInput) codesInput.focus();
    }
}

function updateSelectedStockBadge() {
    const select = document.getElementById('restock-product-select');
    const badge = document.getElementById('selected-stock-badge');
    if (!select || !badge) return;
    const prod = inventoryProductsCache.find(p => p.id === select.value);
    if (prod) {
        badge.innerHTML = `<span class="text-emerald-600 font-bold">تم اختيار: ${prod.platform} — ${prod.package_name}</span>`;
    } else {
        badge.innerHTML = '';
    }
}

function updateCodesCountLive() {
    const text = document.getElementById('restock-codes').value;
    const badge = document.getElementById('codes-count-badge');
    if (!badge) return;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    badge.innerText = `${lines.length} كود`;
}

async function handleRestockSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-restock-submit');
    const prodId = document.getElementById('restock-product-select').value;
    const codesText = document.getElementById('restock-codes').value.trim();

    if (!prodId) return alert("يرجى اختيار باقة أولاً.");
    if (!codesText) return alert("يرجى إدخال كود واحد على الأقل.");

    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-sm"></i> جاري الإضافة...`;

    try {
        const { data, error } = await supabase.rpc('admin_add_inventory_codes', {
            p_product_id: prodId,
            p_codes_text: codesText
        });

        if (error) throw error;

        if (data && data.status === 'success') {
            alert(data.message || "✓ تم شحن الأكواد إلى المخزون بنجاح!");
            document.getElementById('restock-codes').value = '';
            updateCodesCountLive();
            await loadInventoryData();
        } else {
            alert("خطأ: " + (data ? data.message : "فشلت إضافة الأكواد"));
        }
    } catch (err) {
        console.error("Restock Error:", err);
        alert("حدث خطأ أثناء إضافة الأكواد: " + (err.message || err));
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="ph-bold ph-plus-circle text-sm"></i> إضافة الأكواد إلى المخزون فوراً`;
    }
}

// المنصات والباقات
async function loadProducts() {
    const tbody = document.getElementById('products-tbody');
    const filterSelect = document.getElementById('products-platform-filter');

    try {
        const { data: prods, error } = await supabase
            .from('products')
            .select('*')
            .order('platform', { ascending: true });

        if (error) throw error;
        allProductsCache = prods || [];

        if (filterSelect) {
            const currentFilter = filterSelect.value || 'ALL';
            const platforms = [...new Set(allProductsCache.map(p => p.platform).filter(Boolean))];
            filterSelect.innerHTML = `<option value="ALL">جميع المنصات</option>` +
                platforms.map(p => `<option value="${p}">${p}</option>`).join('');
            filterSelect.value = currentFilter;
        }

        renderProductsTable(allProductsCache);
    } catch (err) {
        console.error("Products load error:", err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-rose-500">فشل تحميل المنتجات: ${err.message}</td></tr>`;
    }
}

function renderProductsTable(productsList) {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;

    if (!productsList || productsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">لا توجد باقات معروضة حالياً</td></tr>`;
        return;
    }

    tbody.innerHTML = productsList.map(p => {
        const isCode = p.product_type === 'CODE';
        const isActive = p.status === 'active' || p.status === 'نشط';

        const typeBadge = isCode
            ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600">كود فوري (CODE)</span>`
            : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600">شحن ID مباشر</span>`;

        const statusBadge = isActive
            ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600">معروض ✓</span>`
            : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 text-slate-400">مخفي ✕</span>`;

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td class="py-3 font-bold text-slate-800 dark:text-slate-100">${p.platform}</td>
                <td class="py-3 font-medium text-slate-700 dark:text-slate-200">${p.package_name}</td>
                <td class="py-3 font-mono font-bold text-slate-900 dark:text-slate-100">$${Number(p.price).toFixed(2)}</td>
                <td class="py-3">${typeBadge}</td>
                <td class="py-3 text-center">${statusBadge}</td>
                <td class="py-3 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="openEditProductModal('${p.id}')" class="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition" title="تعديل الباقة">
                            <i class="ph-bold ph-pencil-simple text-sm"></i>
                        </button>
                        <button onclick="handleDeleteProduct('${p.id}', '${p.package_name}')" class="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition" title="حذف الباقة">
                            <i class="ph-bold ph-trash text-sm"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterProductsByPlatform() {
    const filterVal = document.getElementById('products-platform-filter').value;
    if (filterVal === 'ALL') {
        renderProductsTable(allProductsCache);
    } else {
        const filtered = allProductsCache.filter(p => p.platform === filterVal);
        renderProductsTable(filtered);
    }
}

function openAddModal() {
    document.getElementById('edit-prod-id').value = '';
    
    const platformInput = document.getElementById('edit-prod-platform');
    platformInput.disabled = false;
    platformInput.value = '';
    platformInput.placeholder = 'مثال: PUBG, Netflix, Steam';

    document.getElementById('edit-prod-name').value = '';
    document.getElementById('edit-prod-price').value = '';
    document.getElementById('edit-prod-type').value = 'CODE';
    document.getElementById('edit-prod-category').value = 'Games';
    document.getElementById('edit-prod-image').value = '';
    document.getElementById('edit-prod-status').value = 'active';

    const modalTitle = document.querySelector('#edit-product-modal h4 span');
    if (modalTitle) modalTitle.innerText = 'إضافة باقة جديدة ➕';
    
    const saveBtn = document.getElementById('btn-save-edit-prod');
    if (saveBtn) saveBtn.innerHTML = `<i class="ph-bold ph-plus-circle text-sm"></i> <span>إضافة الباقة للمتجر</span>`;

    document.getElementById('edit-product-modal').classList.remove('hidden');
}

function openEditProductModal(productId) {
    const prod = allProductsCache.find(p => p.id === productId);
    if (!prod) return;

    document.getElementById('edit-prod-id').value = prod.id;
    document.getElementById('edit-prod-platform').value = prod.platform || '';
    document.getElementById('edit-prod-type').value = prod.product_type || 'CODE';
    document.getElementById('edit-prod-name').value = prod.package_name || '';
    document.getElementById('edit-prod-price').value = prod.price || '';
    document.getElementById('edit-prod-category').value = prod.category || '';
    document.getElementById('edit-prod-image').value = prod.image_url || '';
    document.getElementById('edit-prod-status').value = prod.status || 'active';

    const modalTitle = document.querySelector('#edit-product-modal h4 span');
    if (modalTitle) modalTitle.innerText = 'تعديل بيانات الباقة';

    const saveBtn = document.getElementById('btn-save-edit-prod');
    if (saveBtn) saveBtn.innerHTML = `<i class="ph-bold ph-floppy-disk text-sm"></i> <span>حفظ التعديلات</span>`;

    document.getElementById('edit-product-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-product-modal').classList.add('hidden');
}

async function handleEditProductSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-edit-prod');
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full ml-1"></span> جاري الحفظ...`;

    const prodId = document.getElementById('edit-prod-id').value || null;
    const platform = document.getElementById('edit-prod-platform').value.trim();
    const pkgName = document.getElementById('edit-prod-name').value.trim();
    const price = parseFloat(document.getElementById('edit-prod-price').value);
    const pType = document.getElementById('edit-prod-type').value;
    const category = document.getElementById('edit-prod-category').value.trim();
    const img = document.getElementById('edit-prod-image').value.trim();
    const status = document.getElementById('edit-prod-status').value;

    try {
        const { data, error } = await supabase.rpc('admin_save_product', {
            p_id: prodId,
            p_platform: platform,
            p_package_name: pkgName,
            p_price: price,
            p_product_type: pType,
            p_category: category,
            p_image_url: img || null,
            p_status: status
        });

        if (error) throw error;

        if (data && data.status === 'success') {
            alert(data.message || "تم حفظ الباقة بنجاح ✓");
            closeEditModal();
            await loadProducts();
            await loadInventoryData();
        } else {
            alert("خطأ: " + (data ? data.message : "فشل حفظ الباقة"));
        }
    } catch (err) {
        alert("خطأ أثناء الحفظ: " + (err.message || err));
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="ph-bold ph-floppy-disk text-sm"></i> <span>حفظ التعديلات</span>`;
    }
}

async function handleDeleteProduct(id, name) {
    if (!confirm(`هل أنت متأكد من حذف الباقة (${name}) نهائياً من المتجر؟`)) return;

    try {
        const { data, error } = await supabase.rpc('admin_delete_product', { p_id: id });
        if (error) throw error;

        if (data && data.status === 'success') {
            alert(data.message || "تم حذف الباقة بنجاح");
            await loadProducts();
            await loadInventoryData();
        } else {
            alert("خطأ: " + (data ? data.message : "فشل الحذف"));
        }
    } catch (err) {
        alert("خطأ: " + (err.message || err));
    }
}

// الشركاء التسويقيين
function openAffiliateModal() {
    editingAffiliateUserId = null;
    populateUserDropdown('affiliate-user-select');
    document.getElementById('affiliate-user-select').disabled = false;
    document.getElementById('affiliate-code-input').value = '';
    document.getElementById('affiliate-discount-input').value = '5';
    document.getElementById('affiliate-comm-input').value = '5';
    document.getElementById('btn-save-affiliate').innerText = "حفظ واعتماد الشريك";
    document.getElementById('affiliate-modal').classList.remove('hidden');
}

function closeAffiliateModal() {
    editingAffiliateUserId = null;
    document.getElementById('affiliate-modal').classList.add('hidden');
}

async function handleAffiliateSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-affiliate');
    btn.disabled = true;
    btn.innerText = "جاري الحفظ...";

    const userId = editingAffiliateUserId || document.getElementById('affiliate-user-select').value;
    const code = document.getElementById('affiliate-code-input').value.trim().toUpperCase();
    const discount = parseFloat(document.getElementById('affiliate-discount-input').value);
    const commission = parseFloat(document.getElementById('affiliate-comm-input').value);

    try {
        const { data, error } = await supabase.rpc('admin_manage_affiliate', {
            p_user_id: userId,
            p_coupon_code: code,
            p_discount_percent: discount,
            p_commission_percent: commission,
            p_action: 'save'
        });

        if (error) throw error;

        await supabase.from('profiles').update({ role: 'marketing_partner' }).eq('id', userId).neq('role', 'admin');

        if (data && data.status === 'success') {
            alert("تم اعتماد الشريك التسويقي وتفعيل لوحة التحكم في حسابه بنجاح ✓");
            closeAffiliateModal();
            loadAffiliatesData();
        } else {
            alert("خطأ: " + (data ? data.message : "فشلت العملية"));
        }
    } catch (err) {
        alert("خطأ أثناء حفظ الشريك: " + (err.message || err));
    } finally {
        btn.disabled = false;
        btn.innerText = "حفظ واعتماد الشريك";
    }
}

async function loadAffiliatesData() {
    const tbody = document.getElementById('affiliates-tbody');
    if (!tbody) return;

    try {
        const { data: coupons, error } = await supabase
            .from('coupons')
            .select('*, profiles:affiliate_id(id, first_name, last_name, email, balance, role)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!coupons || coupons.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400">لا يوجد شركاء تسويقيين مسجلين حالياً</td></tr>`;
            return;
        }

        tbody.innerHTML = coupons.map(c => {
            const prof = c.profiles || {};
            const partnerName = getFullName(prof);
            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="py-3 font-bold text-slate-800 dark:text-slate-100">
                        <div>${partnerName}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${prof.email || '—'}</div>
                    </td>
                    <td class="py-3 font-mono font-black text-purple-600 dark:text-purple-400 select-all">${c.code}</td>
                    <td class="py-3 font-mono font-bold">${c.discount_percent}%</td>
                    <td class="py-3 font-mono font-bold text-emerald-600">${c.affiliate_commission_percent}%</td>
                    <td class="py-3 font-mono font-bold text-slate-600 dark:text-slate-300">${c.usage_count || 0}</td>
                    <td class="py-3 font-mono font-black text-emerald-600">$${Number(prof.balance || 0).toFixed(2)}</td>
                    <td class="py-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="editAffiliatePartner('${prof.id}', '${c.code}', ${c.discount_percent}, ${c.affiliate_commission_percent})" class="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition" title="تعديل الشريك والكود">
                                <i class="ph-bold ph-pencil-simple text-sm"></i>
                            </button>
                            <button onclick="deleteAffiliateCoupon('${prof.id}', '${partnerName}')" class="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition" title="إلغاء الشراكة">
                                <i class="ph-bold ph-trash text-sm"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Affiliates load error:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-rose-500">فشل تحميل الشركاء: ${err.message}</td></tr>`;
    }
}

function editAffiliatePartner(userId, code, discount, comm) {
    editingAffiliateUserId = userId;
    const select = document.getElementById('affiliate-user-select');
    select.innerHTML = `<option value="${userId}" selected>تعديل الشريك الحالي</option>`;
    select.disabled = true;

    document.getElementById('affiliate-code-input').value = code;
    document.getElementById('affiliate-discount-input').value = discount;
    document.getElementById('affiliate-comm-input').value = comm;
    document.getElementById('btn-save-affiliate').innerText = "تحديث بيانات الشريك";
    document.getElementById('affiliate-modal').classList.remove('hidden');
}

async function deleteAffiliateCoupon(userId, name) {
    if (!confirm(`هل أنت متأكد من إلغاء الشريك (${name}) وحذف الكوبون المرتبط به؟`)) return;
    try {
        const { data, error } = await supabase.rpc('admin_manage_affiliate', {
            p_user_id: userId,
            p_action: 'delete'
        });
        if (error) throw error;

        await supabase.from('profiles').update({ role: 'customer' }).eq('id', userId).neq('role', 'admin');

        alert(data.message || "تم إلغاء الشراكة بنجاح");
        loadAffiliatesData();
    } catch (err) {
        alert("خطأ: " + (err.message || err));
    }
}

// الوكلاء الماليين
async function loadAgentsData() {
    const tbody = document.getElementById('agents-tbody');
    if (!tbody) return;

    try {
        const { data: agents, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, balance, role, agent_commission_rate')
            .eq('role', 'agent')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!agents || agents.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">لا يوجد وكلاء ماليين معتمدين حالياً</td></tr>`;
            return;
        }

        tbody.innerHTML = agents.map(a => {
            const agentName = getFullName(a);
            const commPercent = (a.agent_commission_rate !== null && a.agent_commission_rate !== undefined && a.agent_commission_rate !== '')
                ? (Number(a.agent_commission_rate) * 100).toFixed(1) + '%' 
                : 'غير محدد ⚠️';

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="py-3 font-bold text-slate-800 dark:text-slate-100">${agentName}</td>
                    <td class="py-3 font-mono text-slate-500">${a.email || '—'}</td>
                    <td class="py-3 font-mono font-black text-emerald-600 dark:text-emerald-400">$${Number(a.balance || 0).toFixed(2)}</td>
                    <td class="py-3 font-mono font-bold text-purple-600 dark:text-purple-400 text-center">${commPercent}</td>
                    <td class="py-3 text-center">
                        <span class="px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-600">وكيل معتمد ✓</span>
                    </td>
                    <td class="py-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="updateAgentCommissionPrompt('${a.id}', '${agentName}', ${a.agent_commission_rate || 0})" class="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition" title="تعديل نسبة العمولة">
                                <i class="ph-bold ph-pencil-simple text-sm"></i>
                            </button>
                            <button onclick="demoteAgent('${a.id}', '${agentName !== 'بدون اسم' ? agentName : a.email}')" class="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition" title="إلغاء صفة الوكيل">
                                <i class="ph-bold ph-trash text-sm"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Agents load error:", err);
        tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-rose-500">فشل تحميل الوكلاء: ${err.message}</td></tr>`;
    }
}

async function openAgentModal() {
    await populateUserDropdown('agent-user-select');
    document.getElementById('agent-commission-input').value = '2';
    document.getElementById('agent-modal').classList.remove('hidden');
}

function closeAgentModal() {
    document.getElementById('agent-modal').classList.add('hidden');
}

async function handleAgentSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-agent');
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full ml-1"></span> جاري الاعتماد...`;

    const userId = document.getElementById('agent-user-select').value;
    const rawCommission = parseFloat(document.getElementById('agent-commission-input').value);

    if (isNaN(rawCommission) || rawCommission <= 0 || rawCommission > 100) {
        alert("يرجى إدخال نسبة عمولة صالحة كنسبة مئوية (مثال: 10 لـ 10% أو 5 لـ 5%).");
        btn.disabled = false;
        btn.innerHTML = "اعتماد كوكيل مالي";
        return;
    }

    const decimalRate = rawCommission / 100.0;

    try {
        const { data, error } = await supabase.rpc('admin_manage_agent', {
            p_user_id: userId,
            p_action: 'promote',
            p_commission_rate: decimalRate
        });

        if (error) throw error;

        if (data && data.status === 'success') {
            alert(data.message);
            closeAgentModal();
            await loadAgentsData();
        } else {
            alert("خطأ: " + (data ? data.message : "فشلت العملية"));
        }
    } catch (err) {
        console.error("Agent Submit Error:", err);
        alert("خطأ أثناء ترقية الوكيل: " + (err.message || err));
    } finally {
        btn.disabled = false;
        btn.innerHTML = "اعتماد كوكيل مالي";
    }
}

async function updateAgentCommissionPrompt(userId, agentName, currentDecimalRate) {
    const currentPercent = currentDecimalRate !== null && currentDecimalRate !== undefined
        ? (Number(currentDecimalRate) * 100).toFixed(1)
        : '0';

    const newPercentInput = prompt(`أدخل نسبة العمولة الجديدة (%) للوكيل (${agentName}):`, currentPercent);
    if (newPercentInput === null) return;

    const newPercent = parseFloat(newPercentInput);
    if (isNaN(newPercent) || newPercent <= 0 || newPercent > 100) {
        return alert("يرجى إدخال نسبة مئوية صالحة بين 0.1 و 100.");
    }

    const decimalRate = newPercent / 100.0;

    try {
        const { data, error } = await supabase.rpc('admin_manage_agent', {
            p_user_id: userId,
            p_action: 'update_commission',
            p_commission_rate: decimalRate
        });

        if (error) throw error;

        if (data && data.status === 'success') {
            alert(data.message || "✓ تم تحديث نسبة العمولة بنجاح");
            await loadAgentsData();
        } else {
            alert("خطأ: " + (data ? data.message : "فشلت العملية"));
        }
    } catch (err) {
        console.error("Update Commission Error:", err);
        alert("خطأ أثناء التحديث: " + (err.message || err));
    }
}

async function demoteAgent(userId, name) {
    if (!confirm(`هل أنت متأكد من إلغاء رتبة الوكيل للمستخدم (${name}) وإعادته لعميل عادي؟`)) return;

    try {
        const { data, error } = await supabase.rpc('admin_manage_agent', {
            p_user_id: userId,
            p_action: 'demote',
            p_commission_rate: null
        });

        if (error) throw error;

        alert(data.message);
        await loadAgentsData();
    } catch (err) {
        alert("خطأ: " + (err.message || err));
    }
}

// الإيداع اليدوي
async function handleManualTopup() {
    const emailInput = document.getElementById('topup-email');
    const amtInput = document.getElementById('topup-amount');
    const noteInput = document.getElementById('topup-note');

    const email = emailInput ? emailInput.value.trim() : '';
    const amount = parseFloat(amtInput ? amtInput.value : 0);
    const note = noteInput ? noteInput.value.trim() : '';

    if (!email || isNaN(amount) || amount <= 0) {
        return alert("يرجى إدخال بريد إلكتروني صالح ومبلغ أكبر من الصفر.");
    }

    if (!confirm(`هل أنت متأكد من شحن مبلغ $${amount.toFixed(2)} يدوياً إلى حساب (${email})؟`)) return;

    try {
        const { data, error } = await supabase.rpc('admin_manual_topup', {
            p_email: email,
            p_amount: amount,
            p_note: note || 'إيداع يدوي عبر الإدارة'
        });

        if (error) throw error;

        if (data && data.status === 'success') {
            alert(data.message || "✓ تم إيداع الرصيد بنجاح!");
            emailInput.value = '';
            amtInput.value = '';
            noteInput.value = '';
            loadAllAdminData();
        } else {
            alert("خطأ: " + (data ? data.message : "فشلت عملية الإيداع"));
        }
    } catch (err) {
        console.error("Manual Topup Error:", err);
        alert("حدث خطأ أثناء الإيداع: " + (err.message || err));
    }
}

// أدوات مساعدة عامة
async function populateUserDropdown(selectElementId) {
    const select = document.getElementById(selectElementId);
    if (!select) return;

    select.innerHTML = `<option value="">جاري جلب الحسابات...</option>`;
    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, role')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (users && users.length > 0) {
            select.innerHTML = users.map(u => `
                <option value="${u.id}">
                    ${getFullName(u)} (${u.email || u.id.slice(0, 8)}) [${u.role || 'customer'}]
                </option>
            `).join('');
        } else {
            select.innerHTML = `<option value="">لا يوجد مستخدمين مسجلين</option>`;
        }
    } catch (err) {
        console.error("Dropdown error:", err);
        select.innerHTML = `<option value="">فشل تحميل الحسابات</option>`;
    }
}

function getFullName(userObj) {
    if (!userObj) return 'بدون اسم';
    const full = [userObj.first_name, userObj.last_name].filter(Boolean).join(' ').trim();
    return full || 'بدون اسم';
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.className = "tab-btn px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 flex items-center gap-2 whitespace-nowrap";
    });

    const activeSec = document.getElementById(`sec-${tabId}`);
    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeSec) activeSec.classList.remove('hidden');
    if (activeTab) activeTab.className = "tab-btn px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center gap-2 whitespace-nowrap";
    
    if (tabId === 'orders') loadPendingOrders();
    else if (tabId === 'deposits') loadPendingDeposits();
    else if (tabId === 'inventory') loadInventoryData();
    else if (tabId === 'products') loadProducts();
    else if (tabId === 'affiliates') loadAffiliatesData();
    else if (tabId === 'agents') loadAgentsData();
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "index.html";
}

// بدء الفحص التلقائي للصلاحيات
checkAdminAuth();
