import express from "express";
import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import db from "./src/db.js";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Twitter Client (OAuth 1.0a User Context)
const getTwitterClient = () => {
  if (!process.env.TWITTER_CONSUMER_KEY || !process.env.TWITTER_CONSUMER_SECRET || !process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_TOKEN_SECRET) {
    throw new Error("Twitter credentials not configured in environment variables.");
  }
  return new TwitterApi({
    appKey: process.env.TWITTER_CONSUMER_KEY,
    appSecret: process.env.TWITTER_CONSUMER_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  });
};

// Helper to get Gemini Client
const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

// Middleware to check if keys are configured
const requireKeys = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    getTwitterClient();
    next();
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

// 1. Get Current User (Single User Mode)
app.get("/api/me", async (req, res) => {
  try {
    const client = getTwitterClient();
    let user = { id: "1", username: "twitter_user", name: "Twitter User" };
    
    try {
      const { data } = await client.v2.me();
      user = data;
    } catch (e: any) {
      if (e.code === 402 || e.status === 402 || (e.message && e.message.includes('402'))) {
        console.warn("402 Payment Required on /2/users/me. Using fallback user.");
      } else {
        throw e;
      }
    }
    
    // Ensure user exists in DB
    const stmt = db.prepare(`
      INSERT INTO users (id, twitter_id, username, name)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        twitter_id=excluded.twitter_id,
        username=excluded.username,
        name=excluded.name
    `);
    stmt.run(user.id, user.username, user.name);

    const dbUser = db.prepare("SELECT * FROM users WHERE id = 1").get();
    res.json(dbUser);
  } catch (error: any) {
    res.status(401).json({ error: "Failed to authenticate with Twitter. Check your API keys." });
  }
});

// 2. Analyze Brand
app.post("/api/analyze", requireKeys, async (req, res) => {
  try {
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: "Description is required for analysis on the Free tier." });
    }

    // Use Gemini to analyze
    const ai = getGeminiClient();
    const prompt = `
      Analyze the following description or sample tweets from a user to determine their brand, tone, and target audience.
      Return a JSON object with the following structure:
      {
        "tone": "Description of the tone (e.g., professional, humorous, educational)",
        "brand": "Summary of their personal or company brand",
        "audience": "Description of their likely target audience",
        "topics": ["topic1", "topic2"]
      }
      
      Input:
      ${description}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const analysis = response.text;
    
    // Save analysis
    db.prepare("UPDATE users SET brand_analysis = ? WHERE id = 1").run(analysis);
    
    res.json(JSON.parse(analysis || "{}"));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Generate Post Suggestions
app.post("/api/suggest", requireKeys, async (req, res) => {
  try {
    const user = db.prepare("SELECT brand_analysis FROM users WHERE id = 1").get() as any;
    
    if (!user || !user.brand_analysis) {
      return res.status(400).json({ error: "Please analyze brand first" });
    }

    const prompt = `
      Based on the following brand analysis, generate 3 strategic tweet suggestions and 3 engagement tweet suggestions.
      Return a JSON object with the following structure:
      {
        "strategic": ["tweet 1", "tweet 2", "tweet 3"],
        "engagement": ["tweet 1", "tweet 2", "tweet 3"]
      }

      Brand Analysis:
      ${user.brand_analysis}
    `;

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Schedule Post
app.post("/api/posts", requireKeys, (req, res) => {
  const { content, scheduled_for } = req.body;
  
  if (!content || !scheduled_for) {
    return res.status(400).json({ error: "Missing content or scheduled_for" });
  }

  const result = db.prepare("INSERT INTO posts (user_id, content, scheduled_for, status) VALUES (1, ?, ?, 'scheduled')")
    .run(content, scheduled_for);
    
  res.json({ id: result.lastInsertRowid, content, scheduled_for, status: 'scheduled' });
});

// 4.1 Instant Post
app.post("/api/posts/instant", requireKeys, async (req, res) => {
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: "Missing content" });
  }

  try {
    const client = getTwitterClient();
    await client.v2.tweet(content);
    
    // Also save to DB as published
    const now = new Date().toISOString();
    db.prepare("INSERT INTO posts (user_id, content, scheduled_for, status) VALUES (1, ?, ?, 'published')")
      .run(content, now);
      
    res.json({ success: true });
  } catch (error: any) {
    console.error("Instant tweet failed", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Get Scheduled Posts
app.get("/api/posts", requireKeys, (req, res) => {
  const posts = db.prepare("SELECT * FROM posts WHERE user_id = 1 ORDER BY scheduled_for DESC").all();
  res.json(posts);
});

// 6. Delete Post
app.delete("/api/posts/:id", requireKeys, (req, res) => {
  db.prepare("DELETE FROM posts WHERE id = ? AND user_id = 1").run(req.params.id);
  res.json({ success: true });
});

// --- Background Worker for Publishing ---
setInterval(async () => {
  try {
    const now = new Date().toISOString();
    const postsToPublish = db.prepare("SELECT * FROM posts WHERE status = 'scheduled' AND scheduled_for <= ?").all(now) as any[];

    if (postsToPublish.length > 0) {
      const client = getTwitterClient();
      
      for (const post of postsToPublish) {
        try {
          await client.v2.tweet(post.content);
          db.prepare("UPDATE posts SET status = 'published' WHERE id = ?").run(post.id);
          console.log(`Published post ${post.id}`);
        } catch (err) {
          console.error(`Failed to publish post ${post.id}`, err);
          db.prepare("UPDATE posts SET status = 'failed' WHERE id = ?").run(post.id);
        }
      }
    }
  } catch (err) {
    // Silently fail if keys aren't set yet
  }
}, 60000); // Check every minute

// --- Vite Integration ---
async function startServer() {
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
