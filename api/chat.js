const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'إعدادات قاعدة البيانات غير مكتملة' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { action, platform, ref, query } = req.body || {};

    // 1. جلب قائمة المنصات والخدمات المتاحة
    if (action === 'get_platforms') {
      const { data, error } = await supabase
        .from('products')
        .select('platform, category')
        .in('status', ['active', 'نشط']);

      if (error) {
        console.error('Error fetching platforms:', error);
      }

      const platforms = [...new Set((data || []).map(p => p.platform).filter(Boolean))];
      return res.status(200).json({ platforms });
    }

    // 2. جلب باقات منصة أو خدمة محددة
    if (action === 'get_packages') {
      const { data, error } = await supabase
        .from('products')
        .select('package_name, price, product_type')
        .eq('platform', platform)
        .in('status', ['active', 'نشط'])
        .order('price', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ packages: data || [] });
    }

    // 3. جلب طرق الإيداع والمحافظ مع حماية ضد الجداول الفارغة أو أخطاء RLS
    if (action === 'get_agents') {
      let agentsList = [];
      try {
        const { data, error } = await supabase
          .from('agents')
          .select('*');

        if (!error && data && data.length > 0) {
          agentsList = data.map(a => ({
            payment_method: a.payment_method || a.method || a.name || 'حوالة مالية',
            agent_name: a.agent_name || a.agent || 'الحساب الرسمي',
            wallet_address: a.wallet_address || a.wallet || a.account_number || a.phone || ''
          }));
        }
      } catch (err) {
        console.warn('Fallback to local agents config');
      }

      // أرقام معتمدة تظهر تلقائياً إذا كان الجدول فارغاً أو محجوباً
      if (agentsList.length === 0) {
        agentsList = [
          { payment_method: 'سيرياتيل كاش (Syriatel Cash)', agent_name: 'الحساب المعتمد', wallet_address: '0980000000' },
          { payment_method: 'شام كاش (Sham Cash)', agent_name: 'الحساب المعتمد', wallet_address: '0980000000' },
          { payment_method: 'MTN كاش (MTN Cash)', agent_name: 'الحساب المعتمد', wallet_address: '0940000000' }
        ];
      }

      return res.status(200).json({ agents: agentsList });
    }

    // 4. تتبع طلب محدد برقم المعاملة
    if (action === 'track_order' || ref) {
      const cleanRef = String(ref || query || '').trim().toUpperCase();
      const { data } = await supabase
        .from('transactions')
        .select('transaction_ref, transaction_type, details, amount, status, created_at')
        .eq('transaction_ref', cleanRef)
        .maybeSingle();

      return res.status(200).json({ order: data || null });
    }

    // 5. فحص الإدخال اليدوي
    const text = String(query || '').trim();
    const orderMatch = text.match(/TX-[A-Za-z0-9]+/i) || text.match(/TX\d+/i);
    if (orderMatch) {
      const { data } = await supabase
        .from('transactions')
        .select('transaction_ref, transaction_type, details, amount, status, created_at')
        .eq('transaction_ref', orderMatch[0].toUpperCase())
        .maybeSingle();

      return res.status(200).json({ order: data || null, isOrderSearch: true });
    }

    return res.status(200).json({ defaultMenu: true });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'تعذر جلب البيانات' });
  }
};
