require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3001;
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
if (!SARVAM_API_KEY) {
  console.error(
    "error: SARVAM_API_KEY is missing in environment variables."
  );
  process.exit(1);
}
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.status(200).json({
    status: "active",
    message: "AI Tutor Server is running",
    timestamp: new Date().toISOString(),
  });
});
app.post("/api/explain", async (req, res) => {
  const { topic } = req.body;

  if (!topic || typeof topic !== "string" || topic.trim() === "") {
    return res.status(400).json({ error: "Topic must be a non-empty string" });
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `Explain: ${topic}` }],
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${SARVAM_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply = response.data.choices[0]?.message?.content;
    if (!reply) throw new Error("Empty AI response");

    res.json({ reply });
  } catch (error) {
    console.error("❌ OpenAI API Error (/explain):", error.message);
    res.status(500).json({ error: "Failed to fetch explanation" });
  }
});
app.post("/api/ai-query", async (req, res) => {
  try {
    const { message } = req.body;

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return res
        .status(400)
        .json({ error: "Message must be a non-empty string" });
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI tutor. Provide clear, concise explanations.",
          },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const reply = response.data.choices[0]?.message?.content;
    if (!reply) throw new Error("Invalid response structure from AI");

    res.json({
      reply,
      tokensUsed: response.data.usage?.total_tokens,
    });
  } catch (error) {
    console.error("API Processing Error (/ai-query):", {
      message: error.message,
      code: error.code,
      responseData: error.response?.data,
      stack: error.stack,
    });

    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({
      error: "Failed to process your request",
      details: statusCode === 500 ? undefined : error.response?.data,
    });
  }
});
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});
app.use((err, req, res, next) => {
  console.error("🔥 Unhandled Server Error:", err);
  res.status(500).json({ error: "Internal server error" });
});
app.listen(PORT, () => {
  console.log(`✅server running on http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔐 API Key: ${GEMINI_API_KEY ? "Loaded" : "Missing"}`);
});
