import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  // GenelPara Proxy
  app.get("/api/market-data", async (req, res) => {
    try {
      const response = await axios.get("https://api.genelpara.com/json/");
      res.json(response.data);
    } catch (error) {
      console.error("GenelPara API Error:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  // Groq AI Analysis
  app.post("/api/ai/analyze", async (req, res) => {
    try {
      const { coinName, price, change } = req.body;
      
      if (!process.env.GROQ_API_KEY) {
        return res.status(400).json({ error: "Groq API Key is missing" });
      }

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "Sen profesyonel bir kripto para analistisin. Kullanıcıya kısa, öz ve Türkçe teknik analiz yorumu yapmalısın. Yatırım tavsiyesi olmadığını belirtmeyi unutma."
          },
          {
            role: "user",
            content: `${coinName} şu an ${price} dolar seviyesinde ve son 24 saatte %${change} değişim gösterdi. Bu durum hakkında kısa bir yorum yapar mısın?`
          }
        ],
        model: "llama-3.3-70b-versatile",
      });

      res.json({ analysis: completion.choices[0]?.message?.content });
    } catch (error) {
      console.error("Groq API Error:", error);
      res.status(500).json({ error: "AI analysis failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
