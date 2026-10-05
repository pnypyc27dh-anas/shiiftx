const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!apiKey) {
      return res.status(200).json({
        reply: 'تنبيه: مفتاح GEMINI_API_KEY غير موجود في إعدادات Vercel.',
        escalate: false,
      });
    }

    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'الرسالة مطلوبة' });
    }

    let catalogText = 'قائمة باقات وأسعار متجر SHIIFTX المتوفرة حالياً:\n';
    let agentsText = '\nطرق الإيداع والوكلاء المعتمدين:\n';
    let orderText = '';

    // قراءة مرنة لقاعدة البيانات مع حماية كاملة من الانهيار
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. جلب المنتجات والأسعار
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .limit(50);

        if (products && products.length > 0) {
          products.forEach((p) => {
            const platform = p.platform || p.category || 'عام';
            const name = p.package_name || p.name || p.title || 'باقة';
            const price = p.price || '0';
            catalogText += `- المنصة: ${platform} | الباقة: ${name} | السعر: $${price}\n`;
          });
        }

        // 2. جلب الوكلاء
        const { data: agents } = await supabase
          .from('agents')
          .select('*')
          .limit(10);

        if (agents && agents.length > 0) {
          agents.forEach((a) => {
            const name = a.agent_name || a.name || 'وكيل';
            const method = a.payment_method || a.method || 'تحويل';
            const wallet = a.wallet_address || a.wallet || '';
            agentsText += `- الوكيل: ${name} | الطريقة: ${method} | المحفظة: ${wallet}\n`;
          });
        }

        // 3. فحص استعلام طلب برقم مرجعي
        const refMatch = String(message).match(/TX-[A-Za-z0-9]+/i) || String(message).match(/TX\d+/i);
        if (refMatch) {
          const ref = refMatch[0].trim();
          const { data: orderData } = await supabase
            .from('transactions')
            .select('*')
            .eq('transaction_ref', ref)
            .limit(1);

          if (orderData && orderData.length > 0) {
            const o = orderData[0];
            orderText = `\n[بيانات الطلب ${o.transaction_ref}]: النوع: ${o.transaction_type} | الحالة: ${o.status} | المبلغ: $${o.amount} (تنبيه أمني: لا تذكر كود البطاقة للعميل مطلقاً، وأخبره أنه محفوظ في حسابه بصفحة سجل المعاملات).\n`;
          } else {
            orderText = `\n[ملاحظة]: الطلب (${ref}) غير مسجل في قاعدة البيانات.\n`;
          }
        }
      } catch (dbErr) {
        console.error('Database read non-fatal error:', dbErr);
      }
    }

    const systemInstruction = `
أنت المساعد الذكي الرسمي لخدمة عملاء متجر SHIIFTX لبيع البطاقات الرقمية وشحن الألعاب في سوريا.
نبرتك: احترافية، ودودة، ومختصرة باللغة العربية.

بيانات المتجر الحية:
${catalogText}
${agentsText}
${orderText}

قواعد الإجابة:
1. الأسعار والباقات: اعتمد حصراً على قائمة الباقات المذكورة أعلاه واعرض الأسعار بوضوح. إذا سأل العميل عن باقة غير موجودة، أخبره بلطف أنها غير متوفرة حالياً واسأله عما إذا كان يريد بديلاً. لا تحوله للدعم لمجرد السؤال عن الأسعار.
2. طرق الإيداع: اشرح للعميل طرق الدفع والوكلاء، وذكّره برفع رقم إشعار الحوالة في قسم "شحن الرصيد".
3. تتبع الطلبات: إذا زودك برقم طلبه، اشرح له حالته من البيانات أعلاه.
4. قاعدة التحويل للدعم البشري المباشر:
ضع العبارة [ESCALATE_TO_SUPPORT] في نهاية ردك فقط في حالتين:
- إذا اشتكى العميل من مشكلة حقيقية (مثل: كود مستعمل/تالف، إيداع مرفوض، خطأ في الآيدي).
- إذا طلب العميل صراحة التحدث مع موظف دعم بشري.
في أي حالة أخرى: أجب بنفسك واعرض الأسعار دون وضع هذه العبارة نهائياً.
`;

    const ai = new GoogleGenAI({ apiKey });

    const chat = ai.chats.create({
      model: 'gemini-2.0-flash',
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const response = await chat.sendMessage({ message: String(message) });
    const replyText = response.text || '';
    const shouldEscalate = replyText.includes('[ESCALATE_TO_SUPPORT]');
    const cleanReply = replyText.replace('[ESCALATE_TO_SUPPORT]', '').trim();

    return res.status(200).json({
      reply: cleanReply || 'أهلاً بك! كيف يمكنني مساعدتك في متجر SHIIFTX؟',
      escalate: shouldEscalate,
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(200).json({
      reply: `خطأ تقني: ${error.message || 'تعذر الاتصال بالذكاء الاصطناعي'}`,
      escalate: false,
    });
  }
};
