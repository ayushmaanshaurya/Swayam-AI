document.addEventListener("DOMContentLoaded", () => {

  const chatBox = document.getElementById("chat-box");
  const chatForm = document.getElementById("chat-form");
  const userInput = document.getElementById("user-input");
  const quizBtn = document.getElementById("quiz-btn");
  const exampleBtn = document.getElementById("example-btn");
  const darkToggle = document.getElementById("dark-toggle");
  const chatList = document.getElementById("chat-list");
  const newChatBtn = document.getElementById("new-chat");

  let chats = JSON.parse(localStorage.getItem("chats")) || {};
  let currentChatId = null;

  function saveChats() {
    localStorage.setItem("chats", JSON.stringify(chats));
  }

  function createNewChat() {
    currentChatId = Date.now().toString();
    chats[currentChatId] = [];
    renderChatList();
    renderMessages();
    saveChats();
  }

  function renderChatList() {
    chatList.innerHTML = "";
    Object.keys(chats).forEach(id => {
      const item = document.createElement("div");
      item.className = "chat-item";
      item.textContent = "Chat " + id.slice(-4);
      item.onclick = () => {
        currentChatId = id;
        renderMessages();
      };
      chatList.appendChild(item);
    });
  }

  function renderMessages() {
    chatBox.innerHTML = "";
    if (!chats[currentChatId]) return;

    chats[currentChatId].forEach(msg => {
      addMessage(msg.content, msg.sender, false);
    });
  }

  function addMessage(content, sender, save = true) {
    const msg = document.createElement("div");
    msg.className = `message ${sender}`;

    msg.innerHTML = `
      <strong>${sender === "user" ? "You" : "AI"}:</strong>
      <div>${marked.parse(content)}</div>
    `;

    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (save) {
      chats[currentChatId].push({ content, sender });
      saveChats();
    }

    addCopyButtons();
  }

  function addCopyButtons() {
    document.querySelectorAll("pre").forEach(block => {
      if (block.querySelector(".copy-btn")) return;

      const btn = document.createElement("button");
      btn.textContent = "Copy";
      btn.className = "copy-btn";
      btn.onclick = () => {
        navigator.clipboard.writeText(block.innerText);
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy", 1000);
      };

      block.style.position = "relative";
      btn.style.position = "absolute";
      btn.style.top = "5px";
      btn.style.right = "5px";

      block.appendChild(btn);
    });
  }

  async function streamText(element, text) {
    element.innerHTML = "<strong>AI:</strong><div></div>";
    const div = element.querySelector("div");

    let i = 0;
    const interval = setInterval(() => {
      div.innerHTML = marked.parse(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 10);
  }

  async function callAPI(endpoint, topic) {
    const res = await fetch(`http://localhost:3001${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic })
    });
    return res.json();
  }

  async function handleRequest(endpoint) {
    const topic = userInput.value.trim();
    if (!topic) return;

    addMessage(topic, "user");
    userInput.value = "";

    const aiMsg = document.createElement("div");
    aiMsg.className = "message ai";
    chatBox.appendChild(aiMsg);

    const data = await callAPI(endpoint, topic);
    await streamText(aiMsg, data.reply);

    chats[currentChatId].push({ content: data.reply, sender: "ai" });
    saveChats();
  }

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleRequest("/api/explain");
  });

  quizBtn.addEventListener("click", () => handleRequest("/api/quiz"));
  exampleBtn.addEventListener("click", () => handleRequest("/api/code"));

  darkToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
  });

  newChatBtn.addEventListener("click", createNewChat);

  if (!currentChatId) createNewChat();
  renderChatList();

});