const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // 1. إعداد ترويسات CORS للسماح بالاتصال من المتصفح
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
        reply: 'مفتاح GEMINI_API_KEY غير موجود في إعدادات البيئة (Vercel).',
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

    // 2. قراءة بيانات المتجر من Supabase مع حماية تامة
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // جلب المنتجات والأسعار (استبعاد أي بيانات حساسة)
        const { data: products } = await supabase
          .from('products')
          .select('platform, package_name, price, product_type')
          .in('status', ['active', 'نشط'])
          .limit(50);

        if (products && products.length > 0) {
          products.forEach((p) => {
            catalogText += `- المنصة: ${p.platform} | الباقة: ${p.package_name} | السعر: $${p.price} | طريقة التسليم: ${p.product_type === 'CODE' ? 'كود رقمي' : 'شحن ID'}\n`;
          });
        }

        // جلب قنوات الإيداع والوكلاء
        const { data: agents } = await supabase
          .from('agents')
          .select('agent_name, agent_code, payment_method, wallet_address')
          .limit(10);

        if (agents && agents.length > 0) {
          agents.forEach((a) => {
            agentsText += `- الوكيل: ${a.agent_name} | الرمز: ${a.agent_code} | طريقة الدفع: ${a.payment_method} | رقم المحفظة: ${a.wallet_address}\n`;
          });
        }

        // فحص الاستعلام عن الطلبات برقم مرجعي (مع حجب الأكواد الرقمية)
        const refMatch = String(message).match(/TX-[A-Za-z0-9]+/i) || String(message).match(/TX\d+/i);
        if (refMatch) {
          const ref = refMatch[0].trim();
          const { data: orderData } = await supabase
            .from('transactions')
            .select('transaction_ref, transaction_type, details, amount, status, created_at')
            .eq('transaction_ref', ref)
            .limit(1);

          if (orderData && orderData.length > 0) {
            const o = orderData[0];
            orderText = `\n[بيانات الطلب ${o.transaction_ref}]: النوع: ${o.transaction_type} | الحالة: ${o.status} | المبلغ: $${o.amount} (تنبيه أمني: لا تذكر كود البطاقة للعميل في الدردشة مطلقاً، وأخبره أنه محفوظ في حسابه بصفحة سجل المعاملات).\n`;
          } else {
            orderText = `\n[ملاحظة استعلام]: الطلب (${ref}) غير مسجل في قاعدة البيانات.\n`;
          }
        }
      } catch (dbErr) {
        console.error('Database fetch error (non-fatal):', dbErr);
      }
    }

    // 3. توجيهات النظام للبوت
    const systemInstruction = `
أنت المساعد الذكي الرسمي لخدمة عملاء متجر SHIIFTX لبيع البطاقات الرقمية وشحن الألعاب في سوريا.
نبرتك: احترافية، ودودة، ومختصرة باللغة العربية الفصحى.

بيانات المتجر الحية:
${catalogText}
${agentsText}
${orderText}

قواعد الإجابة:
1. الأسعار والباقات: اعتمد حصراً على قائمة الباقات المذكورة أعلاه واعرض الأسعار بوضوح. إذا سأل العميل عن باقة غير موجودة، أخبره بلطف أنها غير متوفرة حالياً واسأله عما إذا كان يريد بديلاً. لا تحوله للدعم لمجرد السؤال عن الأسعار.
2. طرق الإيداع: اشرح للعميل طرق الدفع والوكلاء، وذكّره برفع رقم إشعار الحوالة في قسم "شحن الرصيد".
3. تتبع الطلبات: إذا زودك برقم طلبه، اشرح له حالته من البيانات المذكورة أعلاه.
4. قاعدة التحويل للدعم البشري المباشر:
ضع العبارة [ESCALATE_TO_SUPPORT] في نهاية ردك فقط في حالتين:
- إذا اشتكى العميل من مشكلة حقيقية (مثل: كود مستعمل/تالف، إيداع مرفوض، خطأ في رقم الـ ID).
- إذا طلب العميل صراحة التحدث مع موظف دعم بشري.
في أي حالة أخرى: أجب بنفسك واعرض الأسعار دون وضع هذه العبارة نهائياً.
`;

    const ai = new GoogleGenAI({ apiKey });

    // 4. استدعاء النموذج مع إعادة المحاولة التلقائية 3 مرات لتجاوز ضغط السيرفرات (503)
    let response = null;
    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const chat = ai.chats.create({
          model: 'gemini-3.8-flash',
          config: {
            systemInstruction: systemInstruction,
          },
        });

        response = await chat.sendMessage({ message: String(message) });
        if (response && response.text) break;
      } catch (err) {
        lastError = err;
        const isUnavailable = err.message && (
          err.message.includes('503') || 
          err.message.includes('high demand') || 
          err.message.includes('UNAVAILABLE')
        );

        if (isUnavailable && attempt < maxRetries) {
          // الانتظار ثانية ونصف قبل إعادة المحاولة تلقائياً
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        throw err;
      }
    }

    const replyText = (response && response.text) ? response.text : '';
    const shouldEscalate = replyText.includes('[ESCALATE_TO_SUPPORT]');
    const cleanReply = replyText.replace('[ESCALATE_TO_SUPPORT]', '').trim();

    return res.status(200).json({
      reply: cleanReply || 'أهلاً بك! كيف يمكنني مساعدتك في متجر SHIIFTX؟',
      escalate: shouldEscalate,
    });
  } catch (error) {
    console.error('Chat API Handler Error:', error);

    // إذا كان السيرفر مضغوطاً بعد 3 محاولات، يتم الرد بلباقة دون إظهار نصوص الأخطاء التقنية للعميل
    const isOverload = error.message && (error.message.includes('503') || error.message.includes('high demand'));
    const fallbackMessage = isOverload
      ? 'نظام الرد الآلي يشهد إقبالاً كبيراً في هذه اللحظة. يرجى إعادة إرسال سؤالك بعد لحظات أو التواصل مباشرة مع فريق الدعم.'
      : 'أهلاً بك! يمكنك تصفح المنتجات في المتجر أو التواصل مع الدعم الفني لمساعدتك فوراً.';

    return res.status(200).json({
      reply: fallbackMessage,
      escalate: false,
    });
  }
};
