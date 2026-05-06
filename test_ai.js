import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyBlCIq9crY-HKse5HhBxin4PWmkpARlH0M";
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    // There is no direct listModels in the JS SDK that is easy to call without extra auth sometimes,
    // but we can try to hit the API or just try the most common models.
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const result = await model.generateContent("Hi");
        console.log(`Model ${m} works!`);
        return m;
      } catch (e) {
        console.log(`Model ${m} failed: ${e.message}`);
      }
    }
  } catch (err) {
    console.error("General error:", err);
  }
}

listModels();
