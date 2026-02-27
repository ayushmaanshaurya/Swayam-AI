document.addEventListener("DOMContentLoaded", () => {

  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  const splash = document.getElementById("splashScreen");
  const mainApp = document.getElementById("mainApp");

  if (splash && mainApp) {
    setTimeout(() => {
      splash.style.opacity = "0";
      setTimeout(() => {
        splash.style.display = "none";
        mainApp.style.display = "flex";
      }, 600);
    }, 2500);
  }

  const profilePic = localStorage.getItem("profilePic");
  const navProfilePic = document.getElementById("navProfilePic");

  if (profilePic && navProfilePic) {
    navProfilePic.src = "/uploads/" + profilePic;
  }

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("profilePic");
    window.location.href = "index.html";
  });

  const chatForm = document.getElementById("chat-form");
  const userInput = document.getElementById("user-input");
  const chatBox = document.getElementById("chat-box");

  function addMessage(content, sender) {
    const msg = document.createElement("div");
    msg.className = "message " + sender.toLowerCase();
    msg.innerHTML = `<strong>${sender}:</strong> ${marked.parse(content)}`;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  let currentLang = "en-IN";

  function speakText(text) {
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = currentLang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
  }

  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const message = userInput.value.trim();
    if (!message) return;

    addMessage(message, "You");
    userInput.value = "";

    try {
      const res = await fetch("/api/explain-secure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ topic: message })
      });

      const data = await res.json();
      addMessage(data.reply, "AI");
      speakText(data.reply);

    } catch {
      addMessage("Server error. Please try again.", "AI");
    }
  });

  const micBtn = document.getElementById("micBtn");
  const langToggle = document.getElementById("langToggle");

  if (langToggle) {
    langToggle.addEventListener("click", () => {
      currentLang = currentLang === "en-IN" ? "hi-IN" : "en-IN";
      langToggle.textContent = currentLang === "en-IN" ? "EN" : "HI";
    });
  }

  if (micBtn && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    micBtn.addEventListener("click", () => {
      recognition.lang = currentLang;
      recognition.start();
      micBtn.classList.add("recording");
    });

    recognition.onresult = (event) => {
      userInput.value = event.results[0][0].transcript;
      micBtn.classList.remove("recording");
      chatForm.dispatchEvent(new Event("submit"));
    };

    recognition.onend = () => {
      micBtn.classList.remove("recording");
    };
  }

  const anthemBtn = document.getElementById("anthemBtn");
  const anthemAudio = document.getElementById("anthemAudio");

  if (anthemBtn && anthemAudio) {
    anthemBtn.addEventListener("click", () => {
      if (anthemAudio.paused) {
        anthemAudio.play();
        anthemBtn.style.background = "#138808";
      } else {
        anthemAudio.pause();
        anthemAudio.currentTime = 0;
        anthemBtn.style.background = "";
      }
    });
  }

});