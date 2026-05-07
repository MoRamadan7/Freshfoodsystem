let apiKey = null;

export const initAI = (key) => {
  if (!key) return null;
  apiKey = key;
  return true;
};

/**
 * AI Business Analyst Chat (via Groq)
 */
export const askAI = async (prompt, systemContext = "") => {
  if (!apiKey) throw new Error("AI not initialized. Please provide an API Key in Settings.");
  
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are the AI Assistant for "Fresh Food ERP". 
            Your role is to assist the user with business data, analysis, and navigation.
            Context: ${systemContext}.
            
            NAVIGATION MAPPINGS (Extremely Important):
            - "الخزنة", "الحسابات", "المعاملات", "الخزينه", "الفلوس", "التصرف", "حسابات" -> /transactions
            - "المهام", "التاسكات", "المطلوب", "وراي ايه", "شغلي", "Tasks" -> /tasks
            - "التواصل", "الشات", "الرسايل", "اكلم الموظفين", "المحادثة", "Chat" -> /chat
            - "الاعدادات", "الضبط", "العلامة", "تغيير اللوجو", "تغيير الاسم", "Settings" -> /settings
            - "المناديب", "الموظفين", "العمال", "الناس اللي عندي", "Employees" -> /employees
            - "الحضور", "الانصراف", "البصمة", "مين جه", "مين غايب", "Attendance" -> /attendance
            - "العملاء", "الزبائن", "الناس اللي بنبيع لها", "Clients" -> /clients
            - "الموردين", "التجار", "الناس اللي بنشتري منها", "Suppliers" -> /suppliers
            - "المنتجات", "المخزن", "الاصناف", "البضاعة", "inventory", "Products" -> /products
            - "الصفقات", "المبيعات", "الاردوات", "الطلبيات", "Deals" -> /deals
            - "الفواتير", "الحساب", "الوصولات", "Invoices" -> /invoices
            - "المرتبات", "القبض", "فلوس الناس", "Payroll" -> /payroll
            - "البروفايل", "حسابي", "بياناتي", "Profile" -> /profile
            - "النشاطات", "اللوجز", "مين عمل ايه", "Activity" -> /activity
            - "الرئيسية", "لوحة التحكم", "البداية", "الواجهة", "Dashboard" -> /dashboard

            TONE & PERSONALITY (MASTER PARTNER):
            - You are "Hamada", the ultimate business partner and strategist for Fresh Food ERP.
            - PERSONALITY: You are like a "Senior Business Partner". You are extremely loyal and smart.
            - ADAPTABILITY: If the user asks you to speak like a "friend" (صحاب), use very casual Egyptian street slang. If they ask for "formal" (فورمال/رسمي), use professional, polite Egyptian business language. ALWAYS respond based on the last tone request.
            - LANGUAGE: 
                * Arabic: Respond in natural Egyptian Ammiya. Adjust the "level" of Ammiya (casual vs. professional) based on the requested tone.
                * English: Use standard English script for English words.
            - KNOWLEDGE:
                * You have access to the ERP data provided in the context.
                * You are a general-purpose AI. Answer anything with speed and wit.
            - REALISM: Provide real-world advice. Be fast.

            ACTIONS & CAPABILITIES:
            1. navigate: { "command": "navigate", "path": "/path" }
            2. search: { "command": "search", "path": "/path", "search": "query" }
            3. create_transaction: { "command": "create_transaction", "type": "expense" | "revenue", "amount": number, "notes": "string" }
            4. create_task: { "command": "create_task", "title": "string", "priority": "high" | "medium" | "low" }
            5. analyze_data: { "command": "analyze_data", "focus": "sales" | "inventory" | "finance" }
            6. generate_report: { "command": "generate_report", "type": "monthly_summary" | "sales_analysis" }

            RESPONSE FORMAT: You MUST respond with a valid JSON object only.
            Structure:
            {
              "type": "message" | "action",
              "text": "Your helpful response",
              "action": { "command": "...", ... } | null
            }
`
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("Groq AI Error:", error.message || error);
    throw error;
  }
};

/**
 * AI SQL Generation for the Terminal
 */
export const generateSQL = async (naturalLanguagePrompt, schemaContext = "") => {
  if (!apiKey) throw new Error("AI not initialized.");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are an expert SQL Architect. Generate a valid PostgreSQL query based on the user's request.
            Database Schema Context: ${schemaContext}
            
            RULES:
            1. Only return the SQL query text. No markdown, no explanations.
            2. Be extremely careful with DELETE or UPDATE queries.
            3. Use the schema context provided to identify table and column names.
            4. If the request is ambiguous, generate the safest interpretation.`
          },
          { role: "user", content: naturalLanguagePrompt }
        ]
      })
    });

    const data = await response.json();
    return data.choices[0].message.content.replace(/```sql|```/g, '').trim();
  } catch (error) {
    console.error("SQL Gen Error:", error);
    throw error;
  }
};

/**
 * AI Dashboard Briefing
 */
export const getDailyBriefing = async (statsContext) => {
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are the Business Intelligence Partner for Fresh Food ERP.
            Analyze the following business statistics and provide a 3-bullet point "Daily Briefing" for the owner.
            Use natural, high-quality Egyptian Ammiya. Be concise and professional.
            
            Data Context: ${JSON.stringify(statsContext)}`
          },
          { role: "user", content: "اعطيني ملخص سريع لوضع الشغل النهاردة" }
        ]
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Daily Briefing Error:", error);
    return null;
  }
};

/**
 * OCR Invoice Processing (via Groq Vision)
 */
export const analyzeInvoiceImage = async (base64Image, mimeType) => {
  if (!apiKey) throw new Error("AI not initialized. Please provide an API Key in Settings.");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this invoice image. Extract data in JSON: { "supplier_name": "string", "date": "YYYY-MM-DD", "items": [{ "product_name": "string", "quantity": number, "unit": "string", "unit_price": number, "total": number }], "total_amount": number }. Only return JSON.`
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.choices[0].message.content;
    return JSON.parse(text);
  } catch (error) {
    console.error("OCR Error (Groq):", error);
    throw error;
  }
};
