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
            
            NAVIGATION MAPPINGS:
            - "الخزنة", "الحسابات", "المعاملات", "الخزينه", "الفلوس" -> /transactions
            - "المهام", "التاسكات", "المطلوب", "Tasks" -> /tasks
            - "التواصل", "الشات", "الرسايل", "Chat" -> /chat
            - "الاعدادات", "الضبط", "العلامة", "Settings" -> /settings
            - "المناديب", "الموظفين", "العمال", "Employees" -> /employees
            - "الحضور", "الانصراف", "البصمة", "Attendance" -> /attendance
            - "العملاء", "الزبائن", "Clients" -> /clients
            - "الموردين", "التجار", "Suppliers" -> /suppliers
            - "المنتجات", "المخزن", "الاصناف", "Products" -> /products
            - "الصفقات", "المبيعات", "الاردوات", "Deals" -> /deals
            - "الفواتير", "الحساب", "Invoices" -> /invoices
            - "المرتبات", "القبض", "Payroll" -> /payroll
            - "البروفايل", "حسابي", "Profile" -> /profile
            - "النشاطات", "اللوجز", "Activity" -> /activity
            - "الرئيسية", "لوحة التحكم", "البداية", "Dashboard" -> /dashboard

            RESPONSE FORMAT: You MUST respond with a valid JSON object only.
            Structure:
            {
              "type": "message" | "action",
              "text": "Your helpful response",
              "action": { "command": "navigate", "path": "/target-path" } | null
            }
            
            BEHAVIOR & TONE (CRITICAL):
            1. TONE: You MUST speak in AUTHENTIC EGYPTIAN AMMIYA (عامية مصرية 100%).
            2. NO FUSHA: Never use words like "سوف", "هل", "لماذا", "قمت". Instead use "هعمل", "إيه", "ليه", "عملت".
            3. PHRASES TO USE: "عنيا يا فندم", "من عينيا الاثنين", "تمام يا بطل", "كله تمام", "تحت أمرك", "يا باشا", "يا هندسة".
            4. EXAMPLE: Instead of "تم العثور على 5 عملاء", say "لقيتلك 5 عملاء موجودين دلوقتي يا باشا".
            5. NAVIGATION: If the user says "عايز اروح الخزنة" or "ايه اخبار الفلوس", go to /transactions.
            6. DATA: Answer questions based on the provided Stats context in Egyptian Ammiya.
            7. LANGUAGE: If the prompt is in English, respond in English. If Arabic, use EGYPTIAN AMMIYA.`
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
