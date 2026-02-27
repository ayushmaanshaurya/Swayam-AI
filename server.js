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
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= STATIC FILES =================
app.use(express.static(__dirname));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================= HOMEPAGE (LOGIN PAGE) =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "auth.html"));
});

// ================= IN-MEMORY USER STORAGE =================
const users = {};
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ================= FILE UPLOAD SETUP =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// ================= REGISTER =================
app.post("/api/register", upload.single("profilePic"), async (req, res) => {
  const { username, password } = req.body;

  if (users[username]) {
    return res.status(400).json({ message: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  users[username] = {
    password: hashedPassword,
    profilePic: req.file ? req.file.filename : null
  };

  res.json({ message: "Registered successfully" });
});

// ================= LOGIN =================
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const user = users[username];
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ message: "Invalid credentials" });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "2h" });

  res.json({
    token,
    profilePic: user.profilePic
  });
});

// ================= AUTH MIDDLEWARE =================
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token" });

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.username;
    next();
  } catch {
    res.status(403).json({ message: "Invalid token" });
  }
}

// ================= PROFILE =================
app.get("/api/profile", authenticate, (req, res) => {
  const user = users[req.user];

  res.json({
    username: req.user,
    profilePic: user.profilePic
  });
});

// ================= AI EXPLAIN =================
app.post("/api/explain", async (req, res) => {
  try {
    const { topic } = req.body;

    const response = await axios.post(
      "https://api.sarvam.ai/v1/chat/completions",
      {
        model: "sarvam-m",
        messages: [{ role: "user", content: topic }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SARVAM_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      reply: response.data.choices[0].message.content
    });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ reply: "AI server error" });
  }
});

// ================= AI SECURE =================
app.post("/api/explain-secure", authenticate, async (req, res) => {
  try {
    const { topic } = req.body;

    const response = await axios.post(
      "https://api.sarvam.ai/v1/chat/completions",
      {
        model: "sarvam-m",
        messages: [{ role: "user", content: topic }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SARVAM_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      reply: response.data.choices[0].message.content
    });

  } catch {
    res.status(500).json({ reply: "AI error" });
  }
});

// ================= PRODUCTION PORT (RENDER) =================
const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});