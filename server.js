import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || "https://nixoyntozysvmdcxwrnt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const result = {};
  for (const piece of header.split(";")) {
    const part = piece.trim();
    const index = part.indexOf("=");
    if (index > 0) result[decodeURIComponent(part.slice(0, index))] = decodeURIComponent(part.slice(index + 1));
  }
  return result;
}

function cookie(name, value, maxAge) {
  return name + "=" + encodeURIComponent(value) + "; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=" + maxAge;
}

function setSessionCookies(res, session) {
  res.setHeader("Set-Cookie", [
    cookie("sb-access-token", session.access_token, Number(session.expires_in) || 3600),
    cookie("sb-refresh-token", session.refresh_token, 60 * 60 * 24 * 30),
  ]);
}

function clearSessionCookies(res) {
  res.setHeader("Set-Cookie", [
    cookie("sb-access-token", "", 0),
    cookie("sb-refresh-token", "", 0),
  ]);
}

async function authPost(pathname, body) {
  return axios.post(SUPABASE_URL + "/auth/v1/" + pathname, body, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    timeout: 10000,
    validateStatus: () => true,
  });
}

async function verifyAccessToken(accessToken) {
  if (!accessToken) return null;
  const response = await axios.get(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + accessToken },
    timeout: 10000,
    validateStatus: () => true,
  });
  return response.status === 200 && response.data?.id ? response.data : null;
}

async function currentUser(req, res) {
  const cookies = parseCookies(req);
  let accessToken = cookies["sb-access-token"];
  let user = await verifyAccessToken(accessToken);
  if (!user && cookies["sb-refresh-token"]) {
    const refreshed = await authPost("token?grant_type=refresh_token", { refresh_token: cookies["sb-refresh-token"] });
    if (refreshed.status >= 200 && refreshed.status < 300 && refreshed.data?.access_token) {
      setSessionCookies(res, refreshed.data);
      accessToken = refreshed.data.access_token;
      user = await verifyAccessToken(accessToken);
    }
  }
  return user ? { user, accessToken } : null;
}

async function authenticate(req, res, next) {
  try {
    const auth = await currentUser(req, res);
    if (!auth) return res.status(401).json({ message: "Authentication required" });
    req.user = auth.user;
    req.accessToken = auth.accessToken;
    next();
  } catch (error) {
    console.error("AUTH ERROR:", error.message);
    return res.status(401).json({ message: "Authentication failed" });
  }
}

async function protectPage(req, res, next) {
  try {
    const auth = await currentUser(req, res);
    if (!auth) return res.redirect("/index.html");
    req.user = auth.user;
    req.accessToken = auth.accessToken;
    next();
  } catch (error) {
    console.error("PAGE AUTH ERROR:", error.message);
    return res.redirect("/index.html");
  }
}

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/chat.html", protectPage, (req, res) => {
  res.sendFile(path.join(__dirname, "chat.html"));
});

app.get("/api/session", authenticate, (req, res) => {
  res.json({ user: {
    id: req.user.id,
    email: req.user.email || null,
    username: req.user.user_metadata?.username || null,
    avatarUrl: req.user.user_metadata?.avatar_url || null,
  }});
});

app.post("/api/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!username || !email || !password) return res.status(400).json({ message: "Username, email and password are required" });
    const response = await authPost("signup", { email, password, data: { username } });
    if (response.status < 200 || response.status >= 300) {
      return res.status(response.status || 400).json({ message: response.data?.msg || response.data?.error_description || response.data?.message || "Registration failed" });
    }
    if (response.data?.access_token && response.data?.refresh_token) setSessionCookies(res, response.data);
    return res.status(201).json({
      message: response.data?.access_token ? "Registered and signed in successfully" : "Registered successfully. Check your email to confirm your account.",
      user: response.data?.user || null,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error.message);
    return res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    const response = await authPost("token?grant_type=password", { email, password });
    if (response.status < 200 || response.status >= 300 || !response.data?.access_token) {
      return res.status(response.status || 401).json({ message: response.data?.msg || response.data?.error_description || response.data?.message || "Invalid email or password" });
    }
    setSessionCookies(res, response.data);
    return res.json({ user: response.data.user || null });
  } catch (error) {
    console.error("LOGIN ERROR:", error.message);
    return res.status(500).json({ message: "Login failed" });
  }
});

app.post("/api/logout", async (req, res) => {
  try {
    const accessToken = parseCookies(req)["sb-access-token"];
    if (accessToken) await axios.post(SUPABASE_URL + "/auth/v1/logout", null, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + accessToken }, timeout: 10000, validateStatus: () => true });
  } catch (error) {
    console.warn("LOGOUT WARNING:", error.message);
  }
  clearSessionCookies(res);
  res.json({ success: true });
});

app.use((req, res, next) => {
  const blocked = new Set(["/server.js", "/package.json", "/package-lock.json", "/.env", "/.env.example"]);
  if (blocked.has(req.path.toLowerCase())) return res.status(404).end();
  next();
});

app.use(express.static(__dirname, { index: false }));

// =====================================================
// SUPABASE - LEARNING TWIN PERSISTENCE
// =====================================================
// =====================================================
// SUPABASE - LEARNING TWIN PERSISTENCE
// =====================================================

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  "https://nixoyntozysvmdcxwrnt.supabase.co";

function getSupabaseSecretKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

async function getStoredLearningTwin(username) {
  const secretKey = getSupabaseSecretKey();

  if (!secretKey) {
    console.warn(
      "SUPABASE_SECRET_KEY is missing. Using browser Learning Twin only."
    );
    return {};
  }

  try {
    const response = await axios.get(
      SUPABASE_URL + "/rest/v1/learning_twins",
      {
        params: {
          username: "eq." + username,
          select: "profile",
          limit: 1,
        },
        headers: {
          apikey: secretKey,
        },
        timeout: 10000,
      }
    );

    return response.data?.[0]?.profile || {};
  } catch (error) {
    console.error(
      "SUPABASE LEARNING TWIN READ ERROR:",
      error.response?.data || error.message
    );
    return {};
  }
}

async function saveLearningTwin(username, profile) {
  const secretKey = getSupabaseSecretKey();

  if (!secretKey) {
    return false;
  }

  try {
    await axios.post(
      SUPABASE_URL + "/rest/v1/learning_twins",
      {
        username,
        profile,
        updated_at: new Date().toISOString(),
      },
      {
        params: {
          on_conflict: "username",
        },
        headers: {
          apikey: secretKey,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        timeout: 10000,
      }
    );

    return true;
  } catch (error) {
    console.error(
      "SUPABASE LEARNING TWIN WRITE ERROR:",
      error.response?.data || error.message
    );
    return false;
  }
}

function updateStoredTwin(profile, analysis) {
  const twin =
    profile && typeof profile === "object"
      ? { ...profile }
      : {};

  const topic = analysis.topic || "General";

  twin.topics =
    twin.topics && typeof twin.topics === "object"
      ? { ...twin.topics }
      : {};

  twin.history =
    Array.isArray(twin.history)
      ? [...twin.history]
      : [];

  twin.topics[topic] = {
    mastery_score: analysis.mastery_score ?? 0,
    understanding: analysis.understanding || "partial",
    strengths: Array.isArray(analysis.strengths)
      ? analysis.strengths
      : [],
    misconceptions: Array.isArray(analysis.misconceptions)
      ? analysis.misconceptions
      : [],
    missing_points: Array.isArray(analysis.missing_points)
      ? analysis.missing_points
      : [],
    confidence: analysis.confidence || "medium",
    concept_tags: Array.isArray(analysis.concept_tags)
      ? analysis.concept_tags
      : [],
    updated_at: new Date().toISOString(),
  };

  twin.history.push({
    topic,
    mastery_score: analysis.mastery_score ?? 0,
    misconceptions: Array.isArray(analysis.misconceptions)
      ? analysis.misconceptions
      : [],
    missing_points: Array.isArray(analysis.missing_points)
      ? analysis.missing_points
      : [],
    timestamp: new Date().toISOString(),
  });

  if (twin.history.length > 50) {
    twin.history = twin.history.slice(-50);
  }

  twin.updated_at = new Date().toISOString();

  return twin;
}

// =====================================================
// FILE UPLOAD
// =====================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// =====================================================
// REGISTER
// =====================================================

app.post(
  "/api/register",
  upload.single("profilePic"),
  async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          message: "Username and password are required",
        });
      }

      if (users[username]) {
        return res.status(400).json({
          message: "User already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(
        password,
        10
      );

      users[username] = {
        password: hashedPassword,
        profilePic: req.file
          ? req.file.filename
          : null,
      };

      return res.json({
        message: "Registered successfully",
      });

    } catch (error) {
      console.error(
        "REGISTER ERROR:",
        error
      );

      return res.status(500).json({
        message: "Registration failed",
      });
    }
  }
);

// =====================================================
// LOGIN
// =====================================================

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = users[username];

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const valid = await bcrypt.compare(
      password,
      user.password
    );

    if (!valid) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { username },
      JWT_SECRET,
      {
        expiresIn: "2h",
      }
    );

    return res.json({
      token,
      profilePic: user.profilePic,
    });

  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    return res.status(500).json({
      message: "Login failed",
    });
  }
});

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

function authenticate(req, res, next) {

  const header =
    req.headers.authorization;

  if (
    !header ||
    !header.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      message: "No token",
    });
  }

  const token =
    header.split(" ")[1];

  try {

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    req.user =
      decoded.username;

    next();

  } catch (error) {

    return res.status(403).json({
      message: "Invalid token",
    });
  }
}

// =====================================================
// PROFILE
// =====================================================

app.get(
  "/api/profile",
  authenticate,
  (req, res) => {

    const user =
      users[req.user];

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      username: req.user,
      profilePic:
        user.profilePic,
    });
  }
);

// =====================================================
// SARVAM AI
// =====================================================

async function getSarvamReply(message) {

  const apiKey =
    process.env.SARVAM_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SARVAM_API_KEY is missing from Render environment variables"
    );
  }

  if (
    !message ||
    typeof message !== "string" ||
    message.trim() === ""
  ) {
    throw new Error(
      "Message must be a non-empty string"
    );
  }

  console.log(
    "Sending request to Sarvam..."
  );

  const response =
    await axios.post(

      "https://api.sarvam.ai/v1/chat/completions",

      {
        model: "sarvam-105b",

        messages: [

          {
            role: "system",
            content:
              "You are Swayam, the AI tutor of the Swayam AI application. Your name is Swayam. Never call yourself Swemo. Give clear, accurate and useful answers. You can communicate in English and Indian languages.",
          },

          {
            role: "user",
            content:
              message.trim(),
          },

        ],

        temperature: 0.5,

        max_tokens: 10000,

        reasoning_effort: null,

        stream: false,
      },

      {
        headers: {

          "api-subscription-key":
            apiKey,

          "Content-Type":
            "application/json",
        },

        timeout: 30000,
      }
    );

  console.log(
    "Sarvam status:",
    response.status
  );

  const reply =
    response.data
      ?.choices?.[0]
      ?.message?.content;

  if (!reply) {

    console.error(
      "Unexpected Sarvam response:",
      JSON.stringify(
        response.data,
        null,
        2
      )
    );

    throw new Error(
      "Sarvam returned an empty response"
    );
  }

  return reply;
}

// =====================================================
// AI REQUEST HANDLER
// =====================================================

async function handleAIRequest(
  req,
  res
) {

  const message =
    req.body?.topic ??
    req.body?.message;

  console.log(
    "AI REQUEST:",
    message
  );

  if (
    !message ||
    typeof message !== "string" ||
    message.trim() === ""
  ) {

    return res.status(400).json({
      reply:
        "Please enter a message.",

      error:
        "Message must be a non-empty string",
    });
  }

  try {

    const reply =
      await getSarvamReply(
        message
      );

    console.log(
      "AI RESPONSE SUCCESS"
    );

    return res.json({
      reply: reply,
    });

  } catch (error) {

    console.error(
      "================================"
    );

    console.error(
      "SARVAM AI ERROR"
    );

    console.error(
      "Status:",
      error.response?.status
    );

    console.error(
      "Message:",
      error.message
    );

    console.error(
      "Sarvam error response:",
      JSON.stringify(
        error.response?.data,
        null,
        2
      )
    );

    console.error(
      "================================"
    );

    const status =
      error.response?.status || 500;

    return res.status(status).json({

      reply:
        "AI server error",

      error:
        error.response?.data
          ?.error?.message ||
        error.message ||
        "Failed to get AI response",
    });
  }
}

// =====================================================
// AI ROUTES
// =====================================================

// Public endpoint
app.post(
  "/api/explain",
  handleAIRequest
);

// Protected endpoint
app.post(
  "/api/explain-secure",
  authenticate,
  handleAIRequest
);

// Alternative protected endpoint
app.post(
  "/api/ai-query",
  authenticate,
  handleAIRequest
);

// =====================================================
// CODING AGENT
// =====================================================

async function getCodingReply(message) {
  const apiKey = process.env.SARVAM_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SARVAM_API_KEY is missing from Render environment variables"
    );
  }

  if (!message || typeof message !== "string" || message.trim() === "") {
    throw new Error("Message must be a non-empty string");
  }

  const response = await axios.post(
    "https://api.sarvam.ai/v1/chat/completions",
    {
      model: "sarvam-105b",
      messages: [
        {
          role: "system",
          content:
            "You are Swayam Coding Agent, a professional programming assistant. Generate correct, runnable code when asked. Debug code carefully, identify the exact bug, explain why it happens, and provide the corrected code. Preserve the user's intended behavior. When useful, provide step-by-step explanations, edge cases, complexity analysis, and testing examples. Support C, C++, Java, Python, JavaScript, TypeScript, HTML, CSS, SQL, React, Node.js and other common programming languages. Put code inside fenced Markdown code blocks with the correct language tag. Do not invent errors that are not present in the supplied code. If the user has not provided enough information to fix a bug, clearly state what is missing and ask for the relevant code/error message.",
        },
        {
          role: "user",
          content: message.trim(),
        },
      ],
      temperature: 0.2,
      max_tokens: 10000,
      reasoning_effort: null,
      stream: false,
    },
    {
      headers: {
        "api-subscription-key": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const reply =
    response.data?.choices?.[0]?.message?.content;

  if (!reply) {
    console.error(
      "Unexpected coding-agent response:",
      JSON.stringify(response.data, null, 2)
    );
    throw new Error("Coding agent returned an empty response");
  }

  return reply;
}

app.post(
  "/api/coding",
  authenticate,
  async (req, res) => {
    const message =
      req.body?.message ??
      req.body?.topic;

    if (
      !message ||
      typeof message !== "string" ||
      message.trim() === ""
    ) {
      return res.status(400).json({
        reply: "Please enter a coding question or code.",
        error: "Message must be a non-empty string",
      });
    }

    try {
      console.log("CODING AGENT REQUEST:", message);

      const reply = await getCodingReply(message);

      console.log("CODING AGENT RESPONSE SUCCESS");

      return res.json({ reply });
    } catch (error) {
      console.error("================================");
      console.error("CODING AGENT ERROR");
      console.error("Status:", error.response?.status);
      console.error("Message:", error.message);
      console.error(
        "Sarvam error response:",
        JSON.stringify(error.response?.data, null, 2)
      );
      console.error("================================");

      return res.status(error.response?.status || 500).json({
        reply: "Coding agent error. Please try again.",
        error:
          error.response?.data?.error?.message ||
          error.message ||
          "Failed to get coding response",
      });
    }
  }
);
// =====================================================
// SWAYAM MIRROR - LEARNING ANALYSIS AGENT
// =====================================================

function parseMirrorJson(text) {
  const fence = String.fromCharCode(96).repeat(3);

  const cleaned = String(text || "")
    .replaceAll(fence + "json", "")
    .replaceAll(fence, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end <= start) {
    throw new Error("Mirror response was not valid JSON");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}


async function getMirrorReply(topic, explanation, profile) {

  const apiKey = process.env.SARVAM_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SARVAM_API_KEY is missing from Render environment variables"
    );
  }

  const safeTopic =
    String(topic || "Infer the topic").slice(0, 500);

  const safeExplanation =
    String(explanation || "")
      .trim()
      .slice(0, 12000);

  if (!safeExplanation) {
    throw new Error(
      "Explanation must be a non-empty string"
    );
  }

  const profileText =
    JSON.stringify(profile || {}).slice(0, 5000);


  const response = await axios.post(
    "https://api.sarvam.ai/v1/chat/completions",

    {
      model: "sarvam-105b",

      messages: [

        {
          role: "system",

          content:
            `You are Swayam Mirror, a learning-science focused AI tutor.

Your job is NOT simply to give the student the correct answer.

Instead, analyze the student's own explanation.

Identify:

1. What the student understands correctly.
2. Misconceptions.
3. Important missing concepts.
4. How confident the diagnosis is.
5. An estimated mastery score.
6. A useful next question that targets the student's weakest important concept.

Be supportive but honest.

Never shame the learner.

Do not say that the student is stupid, bad, weak as a person, or anything insulting.

The mastery score is only an estimate based on the submitted explanation.

Return ONLY valid JSON.

Do not use Markdown.

Do not put the JSON inside a code block.

The JSON must contain exactly these fields:

{
  "topic": "string",
  "mastery_score": 0,
  "understanding": "strong|partial|weak",
  "strengths": [],
  "misconceptions": [],
  "missing_points": [],
  "confidence": "high|medium|low",
  "feedback": "string",
  "next_question": "string",
  "concept_tags": []
}

Rules:

- mastery_score must be an integer from 0 to 100.
- strengths must be an array of short strings.
- misconceptions must be an array of short strings.
- missing_points must be an array of short strings.
- concept_tags must be an array of short strings.
- If the explanation is correct, misconceptions may be empty.
- If the explanation is incomplete, identify what is missing.
- Do not invent misconceptions.
- The next_question must target the weakest important concept.
- Infer the topic if the topic hint is empty.`
        },

        {
          role: "user",

          content:
            "Topic hint:\n" +
            safeTopic +

            "\n\nStudent explanation:\n" +
            safeExplanation +

            "\n\nPrevious Learning Twin data:\n" +
            profileText
        }

      ],

      temperature: 0.2,

      max_tokens: 5000,

      reasoning_effort: null,

      stream: false
    },

    {
      headers: {
        "api-subscription-key": apiKey,

        "Content-Type":
          "application/json"
      },

      timeout: 30000
    }
  );


  const raw =
    response.data
      ?.choices?.[0]
      ?.message?.content;


  if (!raw) {

    console.error(
      "Unexpected Mirror response:",
      JSON.stringify(
        response.data,
        null,
        2
      )
    );

    throw new Error(
      "Swayam Mirror returned an empty response"
    );
  }


  return parseMirrorJson(raw);
}


// =====================================================
// MIRROR API ROUTE
// =====================================================

app.post(
  "/api/mirror",
  authenticate,
  async (req, res) => {
    const topic = req.body?.topic || "";
    const explanation = req.body?.explanation;
    const browserProfile = req.body?.profile || {};

    if (
      !explanation ||
      typeof explanation !== "string" ||
      explanation.trim() === ""
    ) {
      return res.status(400).json({
        error: "Please explain the concept in your own words.",
      });
    }

    try {
      console.log("SWAYAM MIRROR REQUEST:", {
        user: req.user.email || req.user.id,
        topic,
        explanationLength: explanation.length,
      });

      // Supabase is the server-side source of truth when available.
      // Browser data is only used as a fallback for first-time users.
      const storedProfile = await getStoredLearningTwin(req.user.id);
      const previousProfile =
        storedProfile && Object.keys(storedProfile).length > 0
          ? storedProfile
          : browserProfile;

      const analysis = await getMirrorReply(
        topic,
        explanation,
        previousProfile
      );

      const updatedProfile = updateStoredTwin(
        previousProfile,
        analysis
      );

      const persisted = await saveLearningTwin(
        req.user,
        updatedProfile
      );

      console.log(
        "SWAYAM MIRROR RESPONSE SUCCESS - Learning Twin persisted:",
        persisted
      );

      return res.json({
        analysis,
        learningTwin: updatedProfile,
        persisted,
      });
    } catch (error) {
      console.error("================================");
      console.error("SWAYAM MIRROR ERROR");
      console.error("Status:", error.response?.status);
      console.error("Message:", error.message);
      console.error(
        "Sarvam error response:",
        JSON.stringify(error.response?.data, null, 2)
      );
      console.error("================================");

      return res.status(error.response?.status || 500).json({
        error:
          error.response?.data?.error?.message ||
          error.message ||
          "Unable to analyze the explanation",
      });
    }
  }
);

// =====================================================
// YOUTUBE VIDEO SEARCH
// =====================================================

app.get(
  "/api/videos",
  authenticate,
  async (req, res) => {

    try {

      const query =
        req.query.q;

      if (
        !query ||
        query.trim() === ""
      ) {

        return res.status(400).json({
          error:
            "Video search query is required",
        });
      }

      const youtubeKey =
        process.env.YOUTUBE_API_KEY;

      if (!youtubeKey) {

        return res.status(500).json({
          error:
            "YOUTUBE_API_KEY is missing from Render environment variables",
        });
      }

      console.log(
        "YouTube search:",
        query
      );

      const response =
        await axios.get(

          "https://www.googleapis.com/youtube/v3/search",

          {
            params: {

              part: "snippet",

              q: query.trim(),

              type: "video",

              maxResults: 100,

              key: youtubeKey,
            },

            timeout: 15000,
          }
        );

      const videos =
        (response.data.items || [])
          .map((item) => ({

            videoId:
              item.id?.videoId,

            title:
              item.snippet?.title ||
              "YouTube Video",

            description:
              item.snippet?.description ||
              "",

            thumbnail:
              item.snippet
                ?.thumbnails
                ?.medium
                ?.url ||
              item.snippet
                ?.thumbnails
                ?.default
                ?.url ||
              "",

            channel:
              item.snippet
                ?.channelTitle ||
              "YouTube",
          }))
          .filter(
            (video) =>
              video.videoId
          );

      return res.json({
        videos,
      });

    } catch (error) {

      console.error(
        "================================"
      );

      console.error(
        "YOUTUBE API ERROR"
      );

      console.error(
        "Status:",
        error.response?.status
      );

      console.error(
        "Message:",
        error.message
      );

      console.error(
        "YouTube response:",
        JSON.stringify(
          error.response?.data,
          null,
          2
        )
      );

      console.error(
        "================================"
      );

      return res.status(500).json({
        error:
          "Unable to fetch videos",
      });
    }
  }
);

// =====================================================
// 404 HANDLER
// =====================================================

app.use(
  (req, res) => {

    res.status(404).json({
      error:
        "Endpoint not found",
    });
  }
);

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      "UNHANDLED SERVER ERROR:",
      err
    );

    res.status(500).json({
      error:
        "Internal server error",
    });
  }
);

// =====================================================
// START SERVER
// =====================================================

const PORT =
  Number(process.env.PORT) ||
  3001;

app.listen(
  PORT,
  () => {

    console.log(
      "================================"
    );

    console.log(
      `Swayam AI server running on port ${PORT}`
    );

    console.log(
      `Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );

    console.log(
      `Sarvam API key: ${
        process.env.SARVAM_API_KEY
          ? "LOADED"
          : "MISSING"
      }`
    );

    console.log(
      `YouTube API key: ${
        process.env.YOUTUBE_API_KEY
          ? "LOADED"
          : "MISSING"
      }`
    );

    console.log(
      "================================"
    );
  }
);
