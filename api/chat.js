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

    // 1. جلب قائمة الألعاب والمنصات المتاحة
    if (action === 'get_platforms') {
      const { data, error } = await supabase
        .from('products')
        .select('platform')
        .in('status', ['active', 'نشط']);

      if (error) throw error;
      const uniquePlatforms = [...new Set((data || []).map(p => p.platform).filter(Boolean))];
      return res.status(200).json({ platforms: uniquePlatforms });
    }

    // 2. جلب باقات لعبة محددة
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

    // 3. جلب طرق الإيداع وأرقام المحافظ
    if (action === 'get_agents') {
      const { data, error } = await supabase
        .from('agents')
        .select('agent_name, agent_code, payment_method, wallet_address');

      if (error) throw error;
      return res.status(200).json({ agents: data || [] });
    }

    // 4. تتبع طلب محدد برقم المعاملة
    if (action === 'track_order' || ref) {
      const cleanRef = String(ref || query || '').trim().toUpperCase();
      const { data, error } = await supabase
        .from('transactions')
        .select('transaction_ref, transaction_type, details, amount, status, created_at')
        .eq('transaction_ref', cleanRef)
        .maybeSingle();

      if (error) throw error;
      return res.status(200).json({ order: data || null });
    }

    // 5. في حال كتب العميل نصاً يدوياً (محاولة تتبع أو استفسار)
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
    console.error('Bot API Error:', err);
    return res.status(500).json({ error: 'تعذر جلب البيانات' });
  }
};
