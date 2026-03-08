import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const parseCointelegraphRss = (xml: string) => {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  return items.slice(0, 20).map((item, index) => {
    const getTag = (tag: string) => {
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`, "i");
      const match = item.match(regex);
      return match?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "";
    };

    const summary = getTag("description").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]+)"/i);
    const mediaMatch = item.match(/<media:content[^>]*url="([^"]+)"/i);

    return {
      id: `ct-${index}`,
      title: getTag("title"),
      summary,
      source: "Cointelegraph",
      date: new Date(getTag("pubDate") || Date.now()).toLocaleString("tr-TR"),
      url: getTag("link"),
      imageUrl: enclosureMatch?.[1] || mediaMatch?.[1] || "https://cointelegraph.com/favicon.ico",
    };
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

      const groq = new Groq({
        apiKey: process.env.GROQ_API_KEY,
      });

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "Sen kıdemli bir piyasa analistisin. Cevabını Türkçe, 3 kısa madde halinde ver: trend, risk ve yakın izlenecek seviye. Net ve sade yaz. Her analiz sonunda 'Yatırım tavsiyesi değildir.' cümlesini ekle."
          },
          {
            role: "user",
            content: `${coinName} şu an ${price} dolar seviyesinde ve son 24 saatte %${change} değişim gösterdi. Kısa bir teknik görünüm özeti hazırla.`
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

  // Cointelegraph News Proxy (RSS)
  app.get("/api/news", async (_req, res) => {
    try {
      const response = await axios.get("https://cointelegraph.com/rss", {
        timeout: 10000,
        responseType: "text",
      });

      const items = parseCointelegraphRss(response.data);
      res.json({ items });
    } catch (error) {
      console.error("Cointelegraph RSS Error:", error);
      res.status(500).json({ error: "Failed to fetch Cointelegraph news", items: [] });
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
