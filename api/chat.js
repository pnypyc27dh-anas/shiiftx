const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'الرسالة مطلوبة' });
    }

    const cleanMsg = message.trim().toLowerCase();
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    const supabase = (supabaseUrl && supabaseKey) 
      ? createClient(supabaseUrl, supabaseKey) 
      : null;

    // =========================================================================
    // المرحلة 1: بوابة التحويل للدعم البشري (فحص المشاكل المعقدة فقط)
    // =========================================================================
    const ESCALATION_TRIGGERS = [
      'كود مستعمل', 'كود غير صالح', 'كود لا يعمل', 'الكود خربان', 'الكود ما اشتغل', 
      'ما اشتغل الكود', 'كود خاطئ', 'رفض الايداع', 'رفض الإيداع', 'ما وصل الرصيد', 
      'تأخر الرصيد', 'ما نزل الرصيد', 'غلطت بالاي دي', 'ايدي غلط', 'آيدي خطأ', 
      'بدي موظف', 'بدي انسان', 'تحدث مع موظف', 'تحدث مع انسان', 'خدمة العملاء البشرية', 
      'الدعم البشري', 'اريد التواصل مع شخص'
    ];

    const hasProblem = ESCALATION_TRIGGERS.some(trigger => cleanMsg.includes(trigger));
    if (hasProblem) {
      return res.status(200).json({
        reply: 'نعتذر منك عن هذه المشكلة! هذه الحالة تتطلب مراجعة فورية من المشرف المباشر لحلها والتحقق من العملية.',
        escalate: true
      });
    }

    // =========================================================================
    // المرحلة 2: محرك تتبع الطلبات الحتمي (Direct Order Tracking)
    // =========================================================================
    const refMatch = message.match(/TX-[A-Za-z0-9]+/i) || message.match(/TX\d+/i);
    const isOrderQuery = refMatch || cleanMsg.includes('طلبي') || cleanMsg.includes('تتبع');

    if (isOrderQuery && supabase) {
      if (refMatch) {
        const ref = refMatch[0].toUpperCase();
        const { data: order } = await supabase
          .from('transactions')
          .select('transaction_ref, transaction_type, details, amount, status, created_at')
          .eq('transaction_ref', ref)
          .maybeSingle();

        if (order) {
          const statusText = order.status === 'completed' ? 'مكتمل بنجاح ✅' :
                             order.status === 'pending' ? 'قيد المعالجة ⏳' :
                             order.status === 'rejected' ? 'مرفوض ❌' : order.status;

          return res.status(200).json({
            reply: `📦 **تفاصيل الطلب (${order.transaction_ref}):**\n\n` +
                   `• **الخدمة:** ${order.details || order.transaction_type}\n` +
                   `• **المبلغ:** $${order.amount}\n` +
                   `• **الحالة:** ${statusText}\n\n` +
                   `🔒 *ملاحظة أمنية:* الأكواد الرقمية للطلبات المكتملة محفوظة دائماً في حسابك ضمن صفحة "سجل المعاملات".`,
            escalate: false
          });
        } else {
          return res.status(200).json({
            reply: `لم يتم العثور على طلب مسجل بالرقم (${ref}). يرجى التأكد من كتابة الرقم المرجعي كما هو ظاهر في سجل المعاملات.`,
            escalate: false
          });
        }
      } else {
        return res.status(200).json({
          reply: 'لتتبع طلبك فوراً، يرجى تزويدي بالرقم المرجعي للطلب (مثال: TX-123456).',
          escalate: false
        });
      }
    }

    // =========================================================================
    // المرحلة 3: محرك طرق الدفع والإيداع الحتمي (Direct Payment Info)
    // =========================================================================
    const isPaymentQuery = ['ايداع', 'إيداع', 'شحن رصيد', 'طرق الدفع', 'محفظة', 'محافظ', 'سيرياتيل', 'شام كاش', 'mtn', 'وكيل', 'الوكلاء']
      .some(word => cleanMsg.includes(word));

    if (isPaymentQuery && supabase) {
      const { data: agents } = await supabase
        .from('agents')
        .select('agent_name, payment_method, wallet_address')
        .limit(6);

      if (agents && agents.length > 0) {
        let text = '💳 **طرق الإيداع وشحن الرصيد المتاحة حالياً:**\n\n';
        agents.forEach(a => {
          text += `• **${a.payment_method}** (${a.agent_name}):\n  الرقم / المحفظة: \`${a.wallet_address}\`\n\n`;
        });
        text += '📌 بعد إتمام التحويل، يرجى التوجه لقسم **شحن الرصيد** ورفع رقم إشعار الحوالة لتأكيد شحن حسابك تلقائياً.';
        return res.status(200).json({ reply: text, escalate: false });
      }
    }

    // =========================================================================
    // المرحلة 4: محرك استعلام الباقات والأسعار الحتمي (Direct Catalog Matcher)
    // =========================================================================
    const GAME_KEYWORDS = [
      'ببجي', 'pubg', 'فري فاير', 'free fire', 'جواكر', 'jawaker', 'تيك توك', 'tiktok',
      'لودو', 'ludo', 'تلغرام', 'telegram', 'شاهد', 'shahid', 'انغامي', 'anghami',
      'بيكو', 'bigo', 'غوغل', 'google', 'بلايستيشن', 'playstation', 'روبلوكس', 'roblox',
      'سعر', 'اسعار', 'أسعار', 'باقات', 'شحن'
    ];

    const matchedKeyword = GAME_KEYWORDS.find(k => cleanMsg.includes(k));

    if (matchedKeyword && supabase) {
      let query = supabase
        .from('products')
        .select('platform, package_name, price, product_type')
        .in('status', ['active', 'نشط']);

      // استخراج الكلمة الدالة للبحث في المنتجات (استبعاد كلمات عامة مثل سعر وباقات)
      const specificTerm = !['سعر', 'اسعار', 'أسعار', 'باقات', 'شحن'].includes(matchedKeyword)
        ? matchedKeyword
        : null;

      if (specificTerm) {
        query = query.or(`platform.ilike.%${specificTerm}%,package_name.ilike.%${specificTerm}%`);
      }

      const { data: products } = await query.limit(10);

      if (products && products.length > 0) {
        let replyText = `🎮 **قائمة الأسعار المتوفرة:**\n\n`;
        products.forEach(p => {
          const typeStr = p.product_type === 'CODE' ? 'كود رقمي فوري' : 'شحن ID مباشر';
          replyText += `• **${p.platform}** - ${p.package_name}: **$${p.price}** (${typeStr})\n`;
        });
        replyText += `\nيمكنك إتمام الطلب مباشرة من خلال واجهة المتجر.`;
        return res.status(200).json({ reply: replyText, escalate: false });
      }
    }

    // =========================================================================
    // المرحلة 5: الذكاء الاصطناعي للأسئلة الشرحية والعامة فقط (Gemini 3.8 Flash)
    // =========================================================================
    if (geminiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const systemInstruction = `
أنت المساعد الرسمي لمتجر SHIIFTX الرقمي (شحن ألعاب وبطاقات في سوريا).
مهمتك: الإجابة على استفسارات العملاء الشرحية والعامة فقط بلباقة واختصار (مثل: كيف أشحن حساب غوغل أمريكي، ما الفرق بين الشحن بالآيدي والأكواد، سياسات الموقع).
نبرتك: ودودة واحترافية. لا تذكر أي أسعار أو أرقام محافظ من عندك؛ بل وجه العميل لتصفح المتجر أو التوجه لقسم شحن الرصيد.
`;

      let aiResponse = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const chat = ai.chats.create({
            model: 'gemini-3.8-flash',
            config: { systemInstruction }
          });
          aiResponse = await chat.sendMessage({ message: cleanMsg });
          if (aiResponse && aiResponse.text) break;
        } catch (err) {
          if (attempt === 0) await new Promise(r => setTimeout(r, 1200));
        }
      }

      if (aiResponse && aiResponse.text) {
        return res.status(200).json({
          reply: aiResponse.text.trim(),
          escalate: false
        });
      }
    }

    // رسالة افتراضية سريعة إذا تعذر تصنيف السؤال
    return res.status(200).json({
      reply: 'أهلاً بك في متجر SHIIFTX! يمكنك الاستفسار عن أسعار باقات الألعاب، أو تتبع طلبك عبر إرسال رقمه المرجعي (TX-..)، أو طلب طرق شحن الرصيد.',
      escalate: false
    });

  } catch (error) {
    console.error('Smart Router Critical Error:', error);
    return res.status(200).json({
      reply: 'أهلاً بك! يمكنك الاستفسار عن باقات الألعاب أو شحن الرصيد، أو كتابة تفاصيل مشكلتك ليتم تحويلك للدعم الفني.',
      escalate: false
    });
  }
};
