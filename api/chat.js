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

    if (!apiKey || !supabaseUrl || !supabaseKey) {
      return res.status(200).json({
        reply: 'بيانات السيرفر قيد المزامنة حالياً.',
        escalate: false,
      });
    }

    const { message, history = [] } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'الرسالة مطلوبة' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. جلب باقات المتجر
    const { data: products } = await supabase
      .from('products')
      .select('platform, package_name, price, product_type')
      .in('status', ['active', 'نشط'])
      .limit(60);

    let catalogText = 'قائمة باقات وأسعار متجر SHIIFTX المتوفرة حالياً:\n';
    if (products && products.length > 0) {
      products.forEach((p) => {
        catalogText += `- المنصة: ${p.platform} | الباقة: ${p.package_name} | السعر: $${parseFloat(p.price).toFixed(2)} | التسليم: ${p.product_type === 'CODE' ? 'كود فوري' : 'شحن بالـ ID'}\n`;
      });
    }

    // 2. جلب قنوات الإيداع
    const { data: agents } = await supabase
      .from('agents')
      .select('agent_name, agent_code, payment_method, wallet_address')
      .limit(10);

    let agentsText = '\nقائمة الوكلاء وطرق الإيداع المتاحة:\n';
    if (agents && agents.length > 0) {
      agents.forEach((a) => {
        agentsText += `- الوكيل: ${a.agent_name} | رمز الوكيل: ${a.agent_code} | طريقة الدفع: ${a.payment_method} | المحفظة: ${a.wallet_address}\n`;
      });
    }

    // 3. فحص استعلام الطلبات برقم مرجعي
    let orderText = '';
    const refMatch = message.match(/TX-[A-Za-z0-9]+/i) || message.match(/TX\d+/i);
    if (refMatch) {
      const ref = refMatch[0].trim();
      const { data: orderData } = await supabase
        .from('transactions')
        .select('transaction_ref, transaction_type, details, amount, status, created_at')
        .eq('transaction_ref', ref)
        .limit(1);

      if (orderData && orderData.length > 0) {
        const o = orderData[0];
        orderText = `\n[بيانات الطلب المستعلم عنه ${o.transaction_ref}]:\n- النوع: ${o.transaction_type}\n- التفاصيل: ${o.details}\n- المبلغ: $${o.amount}\n- الحالة: ${o.status}\n(تنبيه: لا تذكر كود البطاقة مطلقاً، وأخبره أنه محفوظ في حسابه بصفحة سجل المعاملات).\n`;
      } else {
        orderText = `\n[ملاحظة]: الطلب رقم (${ref}) غير موجود بقاعدة البيانات. اطلب من العميل التأكد من الرقم.\n`;
      }
    }

    const systemPrompt = `
أنت المساعد الذكي الرسمي لخدمة عملاء متجر SHIIFTX لشحن الألعاب والبطاقات الرقمية في سوريا.
نبرتك: احترافية، ودودة، ومختصرة باللغة العربية.

بيانات المتجر المحدثة:
${catalogText}
${agentsText}
${orderText}

قواعد الإجابة:
1. الأسعار والباقات: اعتمد حصراً على قائمة الباقات المذكورة أعلاه واعرض الأسعار بوضوح. إذا لم تكن الباقة موجودة، أخبره بلطف أنها غير متوفرة حالياً واسأله إن كان يريد بديلاً. لا تحوله للدعم لمجرد سؤاله عن باقة غير متوفرة!
2. طرق الإيداع: اشرح للعميل طرق الدفع والوكلاء، وذكّره برفع رقم إشعار الحوالة في قسم "شحن الرصيد".
3. الاستعلام عن الطلبات: إذا زودك العميل برقم الطلب، اشرح له حالته من البيانات أعلاه.
4. قاعدة التحويل للدعم البشري:
تضع العبارة التالية في نهاية ردك فقط: [ESCALATE_TO_SUPPORT]
في حالتين فقط وحصراً:
- إذا كانت رسالة العميل الحالية بالذات تشتكي من مشكلة حقيقية (مثل: كود لا يعمل، تم رفض الإيداع، خطأ في رقم ID).
- إذا طلب العميل صراحة التحدث مع موظف بشري أو الدعم.
*ملاحظة هامة جداً:* إذا طرح العميل سؤالاً عادياً (عن أسعار أو استفسار عام) حتى وإن كانت هناك مشكلة سابقة في المحادثة، أجب عن سؤاله الحالي بشكل طبيعي وتجاهل المشكلة السابقة ولا تضع [ESCALATE_TO_SUPPORT].
`;

    const ai = new GoogleGenAI({ apiKey });

    // تنظيف وترتيب سجل المحادثة بدقة لمنع أخطاء السيرفر (Alternating Validation)
    const contents = [];
    if (Array.isArray(history) && history.length > 0) {
      let lastRole = null;
      for (const h of history) {
        const text = String(h.content || h.text || '').trim();
        if (!text) continue;
        const role = h.role === 'user' ? 'user' : 'model';

        // المحادثة في Gemini يجب أن تبدأ دائماً بـ user
        if (contents.length === 0 && role !== 'user') continue;

        // منع تكرار نفس الـ role مرتين متتاليتين
        if (role === lastRole) {
          contents[contents.length - 1].parts[0].text += `\n${text}`;
        } else {
          contents.push({ role, parts: [{ text }] });
          lastRole = role;
        }
      }

      // إذا كان آخر عنصر هو user، نزيله لأننا سنضيف رسالة المستخدم الحالية كـ user
      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents.pop();
      }
    }

    // إضافة الرسالة الحالية
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const replyText = response.text || '';
    const shouldEscalate = replyText.includes('[ESCALATE_TO_SUPPORT]');
    const cleanReply = replyText.replace('[ESCALATE_TO_SUPPORT]', '').trim();

    return res.status(200).json({
      reply: cleanReply || 'أهلاً بك! كيف يمكنني مساعدتك اليوم في متجر SHIIFTX؟',
      escalate: shouldEscalate,
    });
  } catch (error) {
    console.error('API Handler Error:', error);
    return res.status(200).json({
      reply: 'أهلاً بك! يمكنك تصفح الباقات المتوفرة بالمتجر أو سؤالي عن أي لعبة تريدها.',
      escalate: false,
    });
  }
};
