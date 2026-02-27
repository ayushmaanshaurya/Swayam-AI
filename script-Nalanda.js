document.addEventListener("DOMContentLoaded", () => {

  const chatForm = document.getElementById("chat-form");
  const userInput = document.getElementById("user-input");
  const chatBox = document.getElementById("chat-box");
  const quizBtn = document.getElementById("quiz-btn");
  const exampleBtn = document.getElementById("example-btn");
  const sendBtn = chatForm.querySelector("button");

  function addMessage(content, sender) {
    const message = document.createElement("div");
    message.className = `message ${sender}`;

    const prefix = sender === "user" ? "You" : "AI Tutor";

    message.innerHTML = `
      <strong>${prefix}:</strong>
      <div class="message-content">
        ${sender === "ai" ? marked.parse(content) : content}
      </div>
    `;

    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function showTyping() {
    const typing = document.createElement("div");
    typing.className = "message ai typing";
    typing.id = "typing";

    typing.innerHTML = `
      <strong>AI Tutor:</strong>
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;

    chatBox.appendChild(typing);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function removeTyping() {
    const typing = document.getElementById("typing");
    if (typing) typing.remove();
  }

  async function callAPI(endpoint, topic) {
    const res = await fetch(`http://localhost:3001${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic })
    });

    if (!res.ok) throw new Error("API failed");

    return res.json();
  }

  async function handleRequest(endpoint, topic) {
    if (!topic) return;

    addMessage(topic, "user");
    userInput.value = "";

    sendBtn.disabled = true;
    quizBtn.disabled = true;
    exampleBtn.disabled = true;

    showTyping();

    try {
      const data = await callAPI(endpoint, topic);
      removeTyping();
      addMessage(data.reply, "ai");
    } catch (err) {
      removeTyping();
      addMessage("Something went wrong. Please try again.", "ai");
    }

    sendBtn.disabled = false;
    quizBtn.disabled = false;
    exampleBtn.disabled = false;
  }
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    await handleRequest("/api/explain", message);
  });
  quizBtn.addEventListener("click", async () => {
    const topic = userInput.value.trim();
    await handleRequest("/api/quiz", topic);
  });
  exampleBtn.addEventListener("click", async () => {
    const topic = userInput.value.trim();
    await handleRequest("/api/code", topic);
  });

});