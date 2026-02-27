import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import SarvamAI from "sarvamai";

dotenv.config();

const app = express();
const PORT = 3001;
app.use(cors());
app.use(express.json());
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
app.get("/", (req, res) => {
  res.send("AI Tutor Backend is running 🚀");
});
app.post("/api/explain", async (req, res) => {
  try {
    const { topic } = req.body;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an AI tutor who explains topics clearly for beginners."
        },
        {
          role: "user",
          content: `Explain this topic in simple terms with examples: ${topic}`
        }
      ],
    });

    res.json({
      explanation: response.choices[0].message.content
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to explain topic" });
  }
});
app.post("/api/quiz", async (req, res) => {
  try {
    const { topic } = req.body;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a quiz generator for students."
        },
        {
          role: "user",
          content: `Create a 5-question quiz (MCQ) on this topic:\n${topic}`
        }
      ],
    });

    res.json({
      quiz: response.choices[0].message.content
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to generate quiz" });
  }
});
app.post("/api/example", async (req, res) => {
  try {
    const { topic } = req.body;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You provide clean and well-commented code examples."
        },
        {
          role: "user",
          content: `Give a simple and clear code example for: ${topic}`
        }
      ],
    });

    res.json({
      example: response.choices[0].message.content
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to generate code example" });
  }
});
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
