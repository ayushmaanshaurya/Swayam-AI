document.addEventListener("DOMContentLoaded", () => {

  // =====================================================
  // AUTH CHECK
  // =====================================================

  const token =
    localStorage.getItem("token");

  if (!token) {
    window.location.href =
      "index.html";
    return;
  }

  // =====================================================
  // SPLASH SCREEN
  // =====================================================

  const splash =
    document.getElementById(
      "splashScreen"
    );

  const mainApp =
    document.getElementById(
      "mainApp"
    );

  if (splash && mainApp) {

    setTimeout(() => {

      splash.style.opacity =
        "0";

      setTimeout(() => {

        splash.style.display =
          "none";

        mainApp.style.display =
          "flex";

      }, 600);

    }, 2500);
  }

  // =====================================================
  // PROFILE PICTURE
  // =====================================================

  const profilePic =
    localStorage.getItem(
      "profilePic"
    );

  const navProfilePic =
    document.getElementById(
      "navProfilePic"
    );

  if (
    profilePic &&
    navProfilePic
  ) {

    navProfilePic.src =
      "/uploads/" +
      profilePic;
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  document
    .getElementById("logoutBtn")
    ?.addEventListener(
      "click",
      () => {

        localStorage.removeItem(
          "token"
        );

        localStorage.removeItem(
          "profilePic"
        );

        window.location.href =
          "index.html";
      }
    );

  // =====================================================
  // CHAT ELEMENTS
  // =====================================================

  const chatForm =
    document.getElementById(
      "chat-form"
    );

  const userInput =
    document.getElementById(
      "user-input"
    );

  const chatBox =
    document.getElementById(
      "chat-box"
    );

  // =====================================================
  // ADD MESSAGE
  // =====================================================

  function addMessage(
    content,
    sender
  ) {

    const msg =
      document.createElement(
        "div"
      );

    msg.className =
      "message " +
      sender.toLowerCase();

    msg.innerHTML =
      `<strong>${sender}:</strong> ${marked.parse(content)}`;

    chatBox.appendChild(msg);

    chatBox.scrollTop =
      chatBox.scrollHeight;
  }

  // =====================================================
  // TEXT TO SPEECH
  // =====================================================

  let currentLang =
    "en-IN";

  function speakText(text) {

    if (
      !text ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    const speech =
      new SpeechSynthesisUtterance(
        text
      );

    speech.lang =
      currentLang;

    window.speechSynthesis.cancel();

    window.speechSynthesis.speak(
      speech
    );
  }

  // =====================================================
  // HTML ESCAPE
  // =====================================================

  function escapeHtml(text) {

    const div =
      document.createElement(
        "div"
      );

    div.textContent =
      text || "";

    return div.innerHTML;
  }

  // =====================================================
  // YOUTUBE VIDEO SEARCH
  // =====================================================

  async function searchVideos(
    query
  ) {

    try {

      const res =
        await fetch(
          `/api/videos?q=${encodeURIComponent(query)}`,
          {
            method: "GET",

            headers: {
              "Authorization":
                "Bearer " +
                token
            }
          }
        );

      const data =
        await res.json();

      if (
        !res.ok ||
        !data.videos
      ) {

        throw new Error(
          data.error ||
          "Video search failed"
        );
      }

      displayVideos(
        data.videos
      );

    } catch (error) {

      console.error(
        "VIDEO SEARCH ERROR:",
        error
      );

      addMessage(
        "I couldn't find videos right now. Please try again.",
        "AI"
      );
    }
  }

  // =====================================================
  // DISPLAY VIDEOS
  // =====================================================

  function displayVideos(
    videos
  ) {

    if (
      !videos ||
      videos.length === 0
    ) {

      addMessage(
        "I couldn't find any videos for that topic.",
        "AI"
      );

      return;
    }

    const container =
      document.createElement(
        "div"
      );

    container.className =
      "video-results";

    const heading =
      document.createElement(
        "div"
      );

    heading.className =
      "video-heading";

    heading.innerHTML =
      "<strong>🎥 Videos you may like</strong>";

    container.appendChild(
      heading
    );

    videos.forEach(
      (video) => {

        const card =
          document.createElement(
            "div"
          );

        card.className =
          "video-card";

        const safeTitle =
          escapeHtml(
            video.title
          );

        const safeChannel =
          escapeHtml(
            video.channel
          );

        card.innerHTML = `

          <div class="video-player">

            <iframe
              src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}"
              title="${safeTitle}"
              frameborder="0"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen>
            </iframe>

          </div>

          <div class="video-info">

            <div class="video-title">
              ${safeTitle}
            </div>

            <div class="video-channel">
              ${safeChannel}
            </div>

          </div>
        `;

        container.appendChild(
          card
        );
      }
    );

    chatBox.appendChild(
      container
    );

    chatBox.scrollTop =
      chatBox.scrollHeight;
  }

  // =====================================================
  // DETECT VIDEO REQUEST
  // =====================================================

  function wantsVideoSearch(
    message
  ) {

    const text =
      message.toLowerCase();

    const videoWords = [
      "video",
      "videos",
      "watch",
      "tutorial",
      "tutorials",
      "show me",
      "youtube",
      "music",
      "song",
      "songs",
      "playlist",
      "movie trailer",
      "trailer",
      "documentary",
      "highlights"
    ];

    return videoWords.some(
      (word) =>
        text.includes(word)
    );
  }

  // =====================================================
  // CHAT SUBMIT
  // =====================================================

  chatForm?.addEventListener(
    "submit",
    async (e) => {

      e.preventDefault();

      const message =
        userInput.value.trim();

      if (!message) {
        return;
      }

      // Show user's message
      addMessage(
        message,
        "You"
      );

      userInput.value = "";

      // Disable input while AI responds
      userInput.disabled =
        true;

      try {

        // ==============================================
        // SARVAM AI
        // ==============================================

        const res =
          await fetch(
            "/api/explain-secure",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "Authorization":
                  "Bearer " +
                  token
              },

              body:
                JSON.stringify({
                  topic: message
                })
            }
          );

        const data =
          await res.json();

        if (!res.ok) {

          throw new Error(
            data.error ||
            data.reply ||
            "AI request failed"
          );
        }

        // ==============================================
        // SHOW AI RESPONSE
        // ==============================================

        const reply =
          data.reply ||
          "I couldn't generate a response.";

        addMessage(
          reply,
          "AI"
        );

        speakText(
          reply
        );

        // ==============================================
        // SEARCH YOUTUBE WHEN REQUESTED
        // ==============================================

        if (
          wantsVideoSearch(
            message
          )
        ) {

          await searchVideos(
            message
          );
        }

      } catch (error) {

        console.error(
          "CHAT ERROR:",
          error
        );

        addMessage(
          "Server error. Please try again.",
          "AI"
        );

      } finally {

        userInput.disabled =
          false;

        userInput.focus();
      }
    }
  );

  // =====================================================
  // LANGUAGE TOGGLE
  // =====================================================

  const langToggle =
    document.getElementById(
      "langToggle"
    );

  if (langToggle) {

    langToggle.addEventListener(
      "click",
      () => {

        currentLang =
          currentLang === "en-IN"
            ? "hi-IN"
            : "en-IN";

        langToggle.textContent =
          currentLang === "en-IN"
            ? "EN"
            : "HI";
      }
    );
  }

  // =====================================================
  // MICROPHONE / SPEECH RECOGNITION
  // =====================================================

  const micBtn =
    document.getElementById(
      "micBtn"
    );

  if (
    micBtn &&
    (
      "webkitSpeechRecognition"
      in window ||
      "SpeechRecognition"
      in window
    )
  ) {

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    const recognition =
      new SpeechRecognition();

    recognition.continuous =
      false;

    recognition.interimResults =
      false;

    micBtn.addEventListener(
      "click",
      () => {

        try {

          recognition.lang =
            currentLang;

          recognition.start();

          micBtn.classList.add(
            "recording"
          );

        } catch (error) {

          console.error(
            "Speech recognition error:",
            error
          );
        }
      }
    );

    recognition.onresult =
      (event) => {

        const transcript =
          event
            .results[0][0]
            .transcript;

        userInput.value =
          transcript;

        micBtn.classList.remove(
          "recording"
        );

        chatForm.dispatchEvent(
          new Event("submit")
        );
      };

    recognition.onerror =
      (event) => {

        console.error(
          "Speech recognition error:",
          event.error
        );

        micBtn.classList.remove(
          "recording"
        );
      };

    recognition.onend =
      () => {

        micBtn.classList.remove(
          "recording"
        );
      };
  }

  // =====================================================
  // ANTHEM / MUSIC BUTTON
  // =====================================================

  const anthemBtn =
    document.getElementById(
      "anthemBtn"
    );

  const anthemAudio =
    document.getElementById(
      "anthemAudio"
    );

  if (
    anthemBtn &&
    anthemAudio
  ) {

    anthemBtn.addEventListener(
      "click",
      () => {

        if (
          anthemAudio.paused
        ) {

          anthemAudio
            .play()
            .catch(
              (error) => {
                console.error(
                  "Audio play error:",
                  error
                );
              }
            );

          anthemBtn.style.background =
            "#000";

        } else {

          anthemAudio.pause();

          anthemAudio.currentTime =
            0;

          anthemBtn.style.background =
            "";
        }
      }
    );
  }

});
