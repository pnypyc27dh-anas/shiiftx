const { GoogleGenAI, Type } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

// تعريف الأدوات الرسمية للبوت
const botTools = [
  {
    name: 'getProducts',
    description: 'البحث عن أسعار وباقات الألعاب والبطاقات الرقمية المتوفرة في المتجر.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        searchTerm: {
          type: Type.STRING,
          description: 'اسم اللعبة أو البطاقة مثل: ببجي, فري فاير, تلغرام, تيك توك, جواكر.',
        },
      },
    },
  },
  {
    name: 'getPaymentAgents',
    description: 'عرض قائمة الوكلاء المعتمدين وطرق الدفع المتاحة لشحن وتعبئة الرصيد.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'checkOrderStatus',
    description: 'الاستعلام عن حالة وتفاصيل طلب شحن للعميل باستخدام الرقم المرجعي للطلب.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderRef: {
          type: Type.STRING,
          description: 'رقم الطلب أو الرقم المرجعي مثل: TX-D123456.',
        },
      },
      required: ['orderRef'],
    },
  },
];

const SYSTEM_INSTRUCTION = `
أنت المساعد الذكي الرسمي لخدمة عملاء متجر SHIIFTX لبيع البطاقات الرقمية وشحن الألعاب في سوريا.
نبرتك: احترافية، ودودة، ومختصرة باللغة العربية.

تعليمات التعامل مع البيانات:
1. الاستفسار عن الأسعار: استدعِ أداة (getProducts) دائماً واعرض الباقات والأسعار الدقيقة للعميل. إذا لم تجد الباقة، أخبره أنها غير متوفرة حالياً واسأله إن كان يريد بديلاً دون تحويله للدعم.
2. طرق الإيداع: استدعِ (getPaymentAgents) لعرض المحافظ والوكلاء، وذكّره برفع رقم إشعار الحوالة في قسم "شحن الرصيد".
3. تتبع الطلبات: استدعِ (checkOrderStatus). اذكر له حالة الطلب والمبلغ فقط، ولا تذكر كود البطاقة في المحادثة مطلقاً (أخبره أن الكود محفوظ في صفحة سجل المعاملات).
4. شرط التحويل الإلزامي للدعم المباشر:
لا تضع عبارة [ESCALATE_TO_SUPPORT] إلا في الحالات التالية فقط:
- إذا اشتكى العميل من مشكلة حقيقية (مثل: كود مستعمل، كود لا يعمل، تم رفض الإيداع، أو خطأ في معرف ID).
- إذا طلب العميل صراحة التحدث مع موظف بشري.
`;

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
      return res.status(500).json({
        reply: 'بيانات الربط غير مكتملة في متغيرات البيئة.',
        escalate: true,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const ai = new GoogleGenAI({ apiKey });

    // تنفيذ استعلامات مباشرة على جداول Supabase دون الحاجة لدوال RPC
    async function executeFunction(name, args) {
      try {
        if (name === 'getProducts') {
          let query = supabase
            .from('products')
            .select('platform, package_name, price, product_type')
            .in('status', ['active', 'نشط']);

          if (args && args.searchTerm) {
            const term = args.searchTerm.trim();
            query = query.or(`platform.ilike.%${term}%,package_name.ilike.%${term}%,category.ilike.%${term}%`);
          }

          const { data, error } = await query.limit(12);
          if (error) {
            console.error('Products fetch error:', error);
            return { error: 'تعذر جلب المنتجات' };
          }
          return (data && data.length > 0) ? data : { message: 'لا توجد باقات مطابقة حالياً.' };
        }

        if (name === 'getPaymentAgents') {
          const { data, error } = await supabase
            .from('agents')
            .select('agent_name, agent_code, payment_method, wallet_address');

          if (error) {
            console.error('Agents fetch error:', error);
            return { error: 'تعذر جلب الوكلاء' };
          }
          return data || [];
        }

        if (name === 'checkOrderStatus') {
          const ref = String(args.orderRef).trim();
          const { data, error } = await supabase
            .from('transactions')
            .select('transaction_ref, transaction_type, details, amount, status, created_at')
            .eq('transaction_ref', ref)
            .limit(1);

          if (error || !data || data.length === 0) {
            return { message: 'لم يتم العثور على طلب بهذا الرقم المرجعي. تأكد من صحة الرقم.' };
          }
          return data[0];
        }

        return { error: 'أداة غير معروفة' };
      } catch (err) {
        console.error('executeFunction error:', err);
        return { error: 'فشل الاستعلام' };
      }
    }

    const { message, history = [] } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'الرسالة مطلوبة' });
    }

    const chat = ai.chats.create({
      model: 'gemini-3.8-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: botTools }],
      },
      history: history,
    });

    let response = await chat.sendMessage({ message });

    // استدعاء أدوات قاعدة البيانات والرد بنتائجها
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
    console.error('Runtime Execution Error:', error);
    return res.status(500).json({
      reply: 'أواجه صعوبة مؤقتة في معالجة طلبك، سأقوم بنقلك للدعم المباشر لمساعدتك.',
      escalate: true,
    });
  }
};
