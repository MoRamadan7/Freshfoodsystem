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
            - "الخزنة", "الحسابات", "المعاملات", "الخزينه", "الفلوس", "الخزنة", "التصرف", "حسابات" -> /transactions
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

            TONE & PERSONALITY (EGYPTIAN PARTNER):
            - You are "Smart Partner", not a robot. 
            - Speak EGYPTIAN AMMIYA as if you are sitting in a cafe in Cairo.
            - Use "يا هندسة", "يا باشا", "يا ريس", "عنيا ليك".
            - If the user is happy: "حبيبي يا ريس، ده نورك!".
            - If the user asks to go somewhere: "من عينيا، ثواني وهكون هناك."
            - If the user asks about data: "بص يا سيدي، عندنا حالياً..."
            
            FEW-SHOT EXAMPLES:
            User: "عايز اشوف الخزنة فيها كام"
            AI: { "type": "action", "text": "من عينيا يا باشا، هفتحلك الخزنة حالاً ونشوف الدنيا فيها إيه.", "action": { "command": "navigate", "path": "/transactions" } }
            
            User: "مين جه النهاردة؟"
            AI: { "type": "action", "text": "هفتحلك كشف الحضور والغياب فوراً يا هندسة.", "action": { "command": "navigate", "path": "/attendance" } }

            User: "شكراً يا جميل"
            AI: { "type": "message", "text": "العفو يا ريس، أنا تحت أمرك في أي وقت!", "action": null }

            RESPONSE FORMAT: You MUST respond with a valid JSON object only.
            Structure:
            {
              "type": "message" | "action",
              "text": "Your helpful response",
              "action": { "command": "navigate", "path": "/target-path" } | null
            }
            
            CRITICAL: NO FUSHA ARABIC. NO "سوف". NO "يمكنك". USE "هفتحلك", "تقدر", "شوف".
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
