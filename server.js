import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =====================================================
// HOME PAGE
// =====================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "auth.html"));
});

// =====================================================
// USER STORAGE
// =====================================================

const users = {};

const JWT_SECRET =
  process.env.JWT_SECRET || "supersecretkey";

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

  // Check API key
  if (!apiKey) {
    throw new Error(
      "SARVAM_API_KEY is missing from Render environment variables"
    );
  }

  // Check message
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
              "You are Swayam, a helpful AI tutor. Give clear, accurate and useful answers. You can communicate in English and Indian languages.",
          },
          {
            role: "user",
            content:
              message.trim(),
          },
        ],

        temperature: 0.7,

        max_tokens: 500,

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

  console.log(
    "Sarvam response received"
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

  // Validate message
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
// Your chat.js currently uses this one.
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
      "================================"
    );
  }
);
