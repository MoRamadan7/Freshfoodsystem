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
            content: `Act as a professional ERP consultant and business analyst for "Fresh Food Export". Context: ${systemContext}. Respond in the same language as the user.`
          },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
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
