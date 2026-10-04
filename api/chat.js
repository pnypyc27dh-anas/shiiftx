const { GoogleGenAI, Type } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

// تهيئة Supabase و Gemini باستخدام متغيرات البيئة
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// تعريف الأدوات الرسمية للبوت (Function Calling)
const botTools = [
  {
    name: 'getProducts',
    description: 'البحث عن أسعار الباقات والمنتجات والألعاب المتوفرة في المتجر.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        searchTerm: {
          type: Type.STRING,
          description: 'اسم اللعبة أو المنصة أو البطاقة (مثل: ببجي, فري فاير, جواكر, تيك توك).',
        },
      },
    },
  },
  {
    name: 'checkOrderStatus',
    description: 'الاستعلام عن تفاصيل وحالة طلب شحن أو بطاقة رقمية للعميل برقم الطلب.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderRef: {
          type: Type.STRING,
          description: 'رقم الطلب أو الرقم المرجعي للطلب المقدم من العميل.',
        },
      },
      required: ['orderRef'],
    },
  },
  {
    name: 'getPaymentAgents',
    description: 'عرض قائمة الوكلاء المعتمدين وطرق الدفع وعناوين المحافظ المتاحة لشحن الرصيد.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'checkDepositStatus',
    description: 'فحص حالة طلب إيداع رصيد باستخدام الرقم المرجعي أو رقم إشعار الحوالة.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        depositRef: {
          type: Type.STRING,
          description: 'الرقم المرجعي لعملية الإيداع أو رقم إشعار الحوالة.',
        },
      },
      required: ['depositRef'],
    },
  },
];

// تنفيذ استعلامات دوال الـ RPC الآمنة داخل Supabase
async function executeFunction(name, args) {
  try {
    if (name === 'getProducts') {
      const { data, error } = await supabase.rpc('bot_get_products', { search_term: args.searchTerm || null });
      return error ? { error: error.message } : data;
    }
    if (name === 'checkOrderStatus') {
      const { data, error } = await supabase.rpc('bot_check_order_status', { order_query: args.orderRef });
      return error ? { error: error.message } : (data && data.length > 0 ? data[0] : { message: 'الطلب غير موجود، تأكد من صحة الرقم المرجعي.' });
    }
    if (name === 'getPaymentAgents') {
      const { data, error } = await supabase.rpc('bot_get_payment_agents');
      return error ? { error: error.message } : data;
    }
    if (name === 'checkDepositStatus') {
      const { data, error } = await supabase.rpc('bot_check_deposit_status', { deposit_query: args.depositRef });
      return error ? { error: error.message } : (data && data.length > 0 ? data[0] : { message: 'طلب الإيداع غير موجود، تأكد من رقم الحوالة.' });
    }
    return { error: 'Unknown tool call' };
  } catch (err) {
    return { error: 'Internal database query failure' };
  }
}

// تعليمات النظام وسياسة التحويل التلقائي
const SYSTEM_INSTRUCTION = `
أنت المساعد الذكي الرسمي لخدمة عملاء متجر SHIIFTX لبيع البطاقات الرقمية وشحن الألعاب.
نبرتك: احترافية، ودودة، ومباشرة.

قواعد العمل:
1. الأسعار والباقات: لا تخترع أسعاراً من عندك؛ استدعِ أداة (getProducts) دائماً لمعرفة الأسعار الفعلية.
2. فحص الطلبات: عندما يطلب العميل تتبع طلبه، اطلب منه تزويدك برقم الطلب واستدعِ أداة (checkOrderStatus).
3. أمان الأكواد: لا تذكر كود البطاقة للعميل في الدردشة تحت أي ظرف. وضّح له أن الكود موجود ومحفوظ في حسابه ضمن صفحة "سجل المعاملات".
4. الإيداع وشحن الرصيد: استدعِ (getPaymentAgents) لعرض المحافظ المتاحة، ووضّح له ضرورة رفع إشعار التحويل بعد إتمام الحوالة.
5. التحويل الإلزامي للدعم المباشر:
إذا ذكر العميل مشكلة خارج صلاحياتك (مثل: كود لا يعمل، كود مستعمل، رصيد لم يصل بعد الإيداع، طلب استرجاع أموال، أو خطأ في معرف ID)، اعتذر له بلباقة واختم ردك حصراً بعبارة: [ESCALATE_TO_SUPPORT].
`;

module.exports = async function handler(req, res) {
  // تفعيل الترويسات لتفادي مشاكل الطلبات
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
    const { message, history = [] } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'الرسالة مطلوبة' });
    }

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: botTools }],
      },
      history: history,
    });

    let response = await chat.sendMessage({ message });

    // معالجة استدعاء الأدوات تلقائياً في حال طلب النموذج بيانات
    while (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      const functionResult = await executeFunction(call.name, call.args);

      response = await chat.sendMessage([
        {
          functionResponse: {
            name: call.name,
            response: { result: functionResult },
          },
        },
      ]);
    }

    const replyText = response.text || '';
    const shouldEscalate = replyText.includes('[ESCALATE_TO_SUPPORT]');
    const cleanReply = replyText.replace('[ESCALATE_TO_SUPPORT]', '').trim();

    return res.status(200).json({
      reply: cleanReply,
      escalate: shouldEscalate,
    });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      reply: 'أواجه صعوبة مؤقتة في معالجة طلبك، سأقوم بتحويلك لمركز الدعم المباشر لمساعدتك.',
      escalate: true,
    });
  }
};
