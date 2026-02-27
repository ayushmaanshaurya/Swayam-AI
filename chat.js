document.addEventListener("DOMContentLoaded", async () => {

  const splash = document.getElementById("splashScreen");
  const mainApp = document.getElementById("mainApp");

  if (splash && mainApp) {
    setTimeout(() => {
      splash.style.opacity = "0";
      splash.style.transition = "0.6s ease";
      setTimeout(() => {
        splash.style.display = "none";
        mainApp.style.display = "flex";
      }, 600);
    }, 2500);
  }

  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "auth.html";
    return;
  }

  const profilePic = localStorage.getItem("profilePic");
  const navProfilePic = document.getElementById("navProfilePic");

  if (profilePic && navProfilePic) {
    navProfilePic.src = "http://localhost:3001/uploads/" + profilePic;
  }

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("profilePic");
    window.location.href = "auth.html";
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
    speech.rate = 1;
    speech.pitch = 1;
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
      const res = await fetch("http://localhost:3001/api/explain", {
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
      if (currentLang === "en-IN") {
        currentLang = "hi-IN";
        langToggle.textContent = "HI";
      } else {
        currentLang = "en-IN";
        langToggle.textContent = "EN";
      }
    });
  }

  if (micBtn && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;

    micBtn.addEventListener("click", () => {
      recognition.lang = currentLang;
      recognition.start();
      micBtn.classList.add("recording");
    });

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      userInput.value = transcript;
      micBtn.classList.remove("recording");
      chatForm.dispatchEvent(new Event("submit"));
    };

    recognition.onerror = () => {
      micBtn.classList.remove("recording");
    };

    recognition.onend = () => {
      micBtn.classList.remove("recording");
    };
  }

  const anthemBtn = document.getElementById("anthemBtn");
  const anthemAudio = document.getElementById("anthemAudio");

  let isPlaying = false;

  if (anthemBtn && anthemAudio) {
    anthemBtn.addEventListener("click", () => {
      if (!isPlaying) {
        anthemAudio.play();
        anthemBtn.style.background = "#138808";
        isPlaying = true;
      } else {
        anthemAudio.pause();
        anthemAudio.currentTime = 0;
        anthemBtn.style.background = "";
        isPlaying = false;
      }
    });

    anthemAudio.addEventListener("ended", () => {
      anthemBtn.style.background = "";
      isPlaying = false;
    });
  }

});