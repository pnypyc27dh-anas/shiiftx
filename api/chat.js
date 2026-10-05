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
      console.error('Missing Environment Variables');
      return res.status(200).json({
        reply: 'بيانات الربط مع السيرفر قيد التحديث حالياً.',
        escalate: true,
      });
    }

    const { message, history = [] } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'الرسالة مطلوبة' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. جلب باقات المتجر المتاحة مباشرة
    const { data: products } = await supabase
      .from('products')
      .select('platform, package_name, price, product_type')
      .in('status', ['active', 'نشط'])
      .limit(60);

    let catalogText = 'قائمة باقات وأسعار متجر SHIIFTX المتوفرة حالياً:\n';
    if (products && products.length > 0) {
      products.forEach((p) => {
        catalogText += `- المنصة: ${p.platform} | الباقة: ${p.package_name} | السعر: $${parseFloat(p.price).toFixed(2)} | طريقة التسليم: ${p.product_type === 'CODE' ? 'كود رقمي فوري' : 'شحن مباشر بالـ ID'}\n`;
      });
    } else {
      catalogText += 'لا توجد منتجات مسجلة حالياً في قاعدة البيانات.\n';
    }

    // 2. جلب قائمة الوكلاء المعتمدين للإيداع
    const { data: agents } = await supabase
      .from('agents')
      .select('agent_name, agent_code, payment_method, wallet_address')
      .limit(10);

    let agentsText = '\nقائمة الوكلاء المعتمدين وطرق الإيداع وشحن الرصيد:\n';
    if (agents && agents.length > 0) {
      agents.forEach((a) => {
        agentsText += `- الوكيل: ${a.agent_name} | رمز الوكيل: ${a.agent_code} | طريقة الدفع: ${a.payment_method} | رقم المحفظة: ${a.wallet_address}\n`;
      });
    }

    // 3. فحص إذا كان العميل يستعلم عن طلب برقم مرجعي
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
        orderText = `\n[بيانات الطلب المستعلم عنه ${o.transaction_ref}]:\n- النوع: ${o.transaction_type}\n- التفاصيل: ${o.details}\n- المبلغ: $${o.amount}\n- الحالة: ${o.status}\n- تاريخ الإنشاء: ${o.created_at}\n(تنبيه أمني: لا تذكر كود البطاقة للعميل في الدردشة مطلقاً، وأخبره أنه محفوظ ومتاح في صفحة "سجل المعاملات").\n`;
      } else {
        orderText = `\n[ملاحظة استعلام الطلب]: العميل استعلم عن الطلب برقم (${ref})، ولم يتم العثور عليه في قاعدة البيانات. اطلب منه التأكد من صحة الرقم المرجعي.\n`;
      }
    }

    // 4. تعليمات النظام الشاملة لنموذج الذكاء الاصطناعي
    const systemPrompt = `
أنت المساعد الذكي الرسمي لخدمة عملاء متجر SHIIFTX (المحفظة الرقمية ومتجر الاشتراكات وشحن الألعاب في سوريا).
نبرتك: احترافية، ودودة، ومختصرة باللغة العربية الفصحى.

بيانات المتجر الحية من قاعدة البيانات:
${catalogText}
${agentsText}
${orderText}

قواعد الإجابة:
1. الأسعار والباقات: اعتمد حصراً على قائمة الباقات المذكورة أعلاه. إذا سأل العميل عن لعبة موجودة (مثل ببجي، فري فاير، إلخ)، اذكر له الباقات وأسعارها بدقة. إذا سأل عن لعبة أو باقة غير متوفرة، أخبره بلطف أنها غير متوفرة حالياً واقترح عليه ما هو متوفر. لا تحوله للدعم لمجرد سؤاله عن باقة غير متوفرة!
2. شحن الرصيد والإيداع: اشرح للعميل المحافظ المتاحة والوكلاء المعتمدين، ووضّح له خطوات التحويل ورفع رقم إشعار الحوالة في قسم "شحن الرصيد".
3. الاستعلام عن الطلبات: إذا زودك العميل برقم الطلب، استخدم بيانات الطلب المذكورة أعلاه وأخبره بحالته. إذا لم يزودك برقم الطلب، اطلب منه تزويدك به (مثال: TX-D123456).
4. التحويل الإلزامي للدعم البشري المباشر:
أضف العبارة التالية في نهاية ردك فقط وحصراً: [ESCALATE_TO_SUPPORT]
في الحالات التالية فقط:
- إذا اشتكى العميل من مشكلة حقيقية تتطلب تدخلاً بشرياً (مثل: كود مستعمل، كود تالف لا يعمل، إيداع تم رفضه، أو شحن لمعرف خاطئ).
- إذا طلب العميل صراحة التحدث مع إنسان أو موظف دعم بشري.
في أي حالة أخرى (استفسار عن أسعار، باقات، طرق دفع، أسئلة عامة): أجب بنفسك ولا تضع [ESCALATE_TO_SUPPORT] أبداً.
`;

    const ai = new GoogleGenAI({ apiKey });

    // بناء سياق المحادثة مع السجل السابق
    const contents = [];
    if (Array.isArray(history) && history.length > 0) {
      history.slice(-6).forEach((h) => {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(h.text || h.content || '') }],
        });
      });
    }
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
      reply: 'أهلاً بك في خدمة عملاء SHIIFTX! إذا كان استفسارك يتعلق بمشكلة في طلبك أو إيداعك، يمكنك التواصل فوراً مع الدعم المباشر عبر واتساب.',
      escalate: true,
    });
  }
};
