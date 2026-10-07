document.addEventListener("DOMContentLoaded", async () => {

  try {
    const sessionRes = await fetch("/api/session", { credentials: "same-origin" });
    if (!sessionRes.ok) { window.location.href = "/index.html"; return; }
    window.currentUser = (await sessionRes.json()).user || null;
  } catch (error) {
    console.error("SESSION CHECK ERROR:", error);
    window.location.href = "/index.html";
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

  const navProfilePic = document.getElementById("navProfilePic");
  if (window.currentUser?.avatarUrl && navProfilePic) navProfilePic.src = window.currentUser.avatarUrl;


  // =====================================================
  // LOGOUT
  // =====================================================

  document
    .getElementById("logoutBtn")
    ?.addEventListener(
      "click",
      async () => {

        await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
        localStorage.removeItem("learningTwin");
        window.location.href = "/index.html";
      }
    );


  // =====================================================
  // LEARNING TWIN DASHBOARD
  // =====================================================

  const dashboard = document.getElementById("learningDashboard");
  const dashboardClose = document.getElementById("closeLearningDashboard");
  const profileButton = document.getElementById("navProfilePic");

  async function openLearningDashboard() {
    if (!dashboard) return;

    const twin = await loadLearningTwinFromServer();
    const topics = Object.entries(twin.topics || {});
    const history = Array.isArray(twin.history) ? twin.history : [];

    const topicCount = document.getElementById("dashboardTopics");
    const masteryEl = document.getElementById("dashboardMastery");
    const analysesEl = document.getElementById("dashboardAnalyses");
    const streakEl = document.getElementById("dashboardStreak");
    const topicsList = document.getElementById("dashboardTopicsList");
    const recentList = document.getElementById("dashboardRecent");
    const userEl = document.getElementById("learningDashboardUser");

    if (userEl) {
      userEl.textContent =
        window.currentUser?.email ||
        window.currentUser?.username ||
        "Your learning snapshot";
    }

    const scores = topics
      .map(([, item]) => Number(item?.mastery_score))
      .filter(Number.isFinite);

    const average = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null;

    const uniqueDays = new Set(
      history
        .map(item => item?.timestamp)
        .filter(Boolean)
        .map(timestamp => new Date(timestamp).toISOString().slice(0, 10))
    );

    if (topicCount) topicCount.textContent = String(topics.length);
    if (masteryEl) masteryEl.textContent = average === null ? "—" : average + "%";
    if (analysesEl) analysesEl.textContent = String(history.length);
    if (streakEl) streakEl.textContent = String(uniqueDays.size);

    if (topicsList) {
      if (!topics.length) {
        topicsList.innerHTML = '<div class="learning-empty">Use 🪞 Mirror to start building your Learning Twin.</div>';
      } else {
        topics.sort((a, b) => (Number(b[1]?.mastery_score) || 0) - (Number(a[1]?.mastery_score) || 0));
        topicsList.innerHTML = topics.slice(0, 8).map(([topic, item]) => {
          const score = Math.max(0, Math.min(100, Number(item?.mastery_score) || 0));
          return `
            <div class="learning-topic-row">
              <div class="learning-topic-main">
                <span class="learning-topic-name">${escapeHtml(topic)}</span>
                <span class="learning-topic-score">${score}%</span>
              </div>
              <div class="learning-progress"><span style="width:${score}%"></span></div>
            </div>
          `;
        }).join("");
      }
    }

    if (recentList) {
      const recent = [...history].reverse().slice(0, 5);
      if (!recent.length) {
        recentList.innerHTML = '<div class="learning-empty">No Mirror analyses yet.</div>';
      } else {
        recentList.innerHTML = recent.map(item => {
          const date = item.timestamp
            ? new Date(item.timestamp).toLocaleDateString(undefined, { day: "numeric", month: "short" })
            : "";
          const score = Number(item.mastery_score) || 0;
          return `
            <div class="learning-recent-row">
              <div>
                <strong>${escapeHtml(item.topic || "General")}</strong>
                <span>${date}</span>
              </div>
              <b>${score}%</b>
            </div>
          `;
        }).join("");
      }
    }

    dashboard.hidden = false;
    document.body.classList.add("dashboard-open");
    dashboardClose?.focus();
  }

  function closeLearningDashboard() {
    if (!dashboard) return;
    dashboard.hidden = true;
    document.body.classList.remove("dashboard-open");
  }

  profileButton?.addEventListener("click", openLearningDashboard);
  dashboardClose?.addEventListener("click", closeLearningDashboard);
  dashboard?.querySelector("[data-close-dashboard]")?.addEventListener("click", closeLearningDashboard);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && dashboard && !dashboard.hidden) {
      closeLearningDashboard();
    }
  });

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

  const mirrorTopicArea =
    document.getElementById(
      "mirrorTopicArea"
    );

  const mirrorTopicInput =
    document.getElementById(
      "mirrorTopicInput"
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


  // =====================================================
  // CODING AGENT MODE
  // =====================================================

  let codingMode = false;

  const codingModeBtn =
    document.getElementById(
      "codingModeBtn"
    );


  // =====================================================
  // SWAYAM MIRROR MODE
  // =====================================================

  let mirrorMode = false;

  const mirrorModeBtn =
    document.getElementById(
      "mirrorModeBtn"
    );


  // =====================================================
  // LEARNING TWIN
  // =====================================================

  function getLearningTwin() {

    try {

      return JSON.parse(
        localStorage.getItem(
          "learningTwin"
        ) || "{}"
      );

    } catch (error) {

      console.error(
        "LEARNING TWIN READ ERROR:",
        error
      );

      return {};
    }
  }


  function saveLearningTwin(
    analysis
  ) {

    try {

      const currentTwin =
        getLearningTwin();

      const topic =
        analysis.topic ||
        "General";


      if (!currentTwin.topics) {
        currentTwin.topics = {};
      }


      if (!currentTwin.history) {
        currentTwin.history = [];
      }


      currentTwin.topics[topic] = {

        mastery_score:
          analysis.mastery_score ?? 0,

        understanding:
          analysis.understanding ||
          "partial",

        strengths:
          analysis.strengths || [],

        misconceptions:
          analysis.misconceptions || [],

        missing_points:
          analysis.missing_points || [],

        confidence:
          analysis.confidence ||
          "medium",

        concept_tags:
          analysis.concept_tags || [],

        updated_at:
          new Date().toISOString()

      };


      currentTwin.history.push({

        topic,

        mastery_score:
          analysis.mastery_score ?? 0,

        misconceptions:
          analysis.misconceptions || [],

        missing_points:
          analysis.missing_points || [],

        timestamp:
          new Date().toISOString()

      });


      // Keep only the latest 50 analyses
      if (
        currentTwin.history.length > 50
      ) {

        currentTwin.history =
          currentTwin.history.slice(-50);
      }


      localStorage.setItem(
        "learningTwin",
        JSON.stringify(
          currentTwin
        )
      );


    } catch (error) {

      console.error(
        "LEARNING TWIN SAVE ERROR:",
        error
      );
    }
  }

  async function loadLearningTwinFromServer() {
    try {
      const res = await fetch("/api/learning-twin", {
        credentials: "same-origin",
      });

      if (!res.ok) {
        console.warn("LEARNING TWIN SYNC READ:", res.status);
        return getLearningTwin();
      }

      const data = await res.json();
      const serverTwin = data.learningTwin || {};

      localStorage.setItem(
        "learningTwin",
        JSON.stringify(serverTwin)
      );

      return serverTwin;
    } catch (error) {
      console.warn("LEARNING TWIN SYNC READ ERROR:", error);
      return getLearningTwin();
    }
  }




  // =====================================================
  // UPDATE CODING MODE UI
  // =====================================================

  function updateCodingModeUI() {

    if (!codingModeBtn) return;

    codingModeBtn.textContent =
      codingMode
        ? "💻 Coding ON"
        : "💻 Coding";

    codingModeBtn.classList.toggle(
      "active",
      codingMode
    );

    codingModeBtn.setAttribute(
      "aria-pressed",
      String(codingMode)
    );


    if (userInput) {

      userInput.placeholder =
        codingMode
          ? "Describe your coding problem or paste your code..."
          : mirrorMode
            ? "Explain a concept in your own words..."
            : "Ask anything...";
    }
  }


  // =====================================================
  // UPDATE MIRROR MODE UI
  // =====================================================

  function updateMirrorModeUI() {

    if (!mirrorModeBtn) return;

    mirrorModeBtn.textContent =
      mirrorMode
        ? "🪞 Mirror ON"
        : "🪞 Mirror";

    mirrorModeBtn.classList.toggle(
      "active",
      mirrorMode
    );

    mirrorModeBtn.setAttribute(
      "aria-pressed",
      String(mirrorMode)
    );


    if (mirrorTopicArea) {
      mirrorTopicArea.hidden = !mirrorMode;
    }

    if (userInput) {

      userInput.placeholder =
        mirrorMode
          ? "Explain a concept in your own words..."
          : codingMode
            ? "Describe your coding problem or paste your code..."
            : "Ask anything...";
    }
  }


  // =====================================================
  // CODING BUTTON
  // =====================================================

  codingModeBtn?.addEventListener(
    "click",
    () => {

      codingMode =
        !codingMode;


      // Coding and Mirror are mutually exclusive
      if (codingMode) {
        mirrorMode = false;
      }


      updateCodingModeUI();
      updateMirrorModeUI();


      if (codingMode) {

        addMessage(
          "💻 **Coding Agent mode is ON.**\n\nAsk me to write code, explain code, find bugs, fix errors, optimize code, or convert code between languages.",
          "AI"
        );

      }

    }
  );


  // =====================================================
  // MIRROR BUTTON
  // =====================================================

  mirrorModeBtn?.addEventListener(
    "click",
    () => {

      mirrorMode =
        !mirrorMode;


      // Coding and Mirror are mutually exclusive
      if (mirrorMode) {
        codingMode = false;
      }


      updateCodingModeUI();
      updateMirrorModeUI();


      if (mirrorMode) {

        addMessage(
          "🪞 **Swayam Mirror mode is ON.**\n\nExplain a concept in your own words. I will analyze your understanding, identify misconceptions, find missing concepts, estimate your mastery, and give you a targeted next question.",
          "AI"
        );

      }

    }
  );


  updateCodingModeUI();
  updateMirrorModeUI();


  // =====================================================
  // TEXT TO SPEECH
  // =====================================================

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
  // CODING AGENT REQUEST
  // =====================================================

  async function askCodingAgent(
    query
  ) {

    const res =
      await fetch(
        "/api/coding",
        {
          method: "POST",

          headers: { "Content-Type": "application/json" },

          body:
            JSON.stringify({
              message: query
            })
        }
      );


    const data =
      await res.json();


    if (!res.ok) {

      throw new Error(
        data.error ||
        data.reply ||
        "Coding agent request failed"
      );
    }


    return data.reply;
  }


  // =====================================================
  // SWAYAM MIRROR REQUEST
  // =====================================================

  async function askMirror(
    topic,
    explanation
  ) {

    const res =
      await fetch(
        "/api/mirror",
        {
          method: "POST",

          headers: { "Content-Type": "application/json" },

          body:
            JSON.stringify({

              topic:
                topic || "",

              explanation:
                explanation

            })
        }
      );


    const data =
      await res.json();


    if (!res.ok) {

      throw new Error(
        data.error ||
        data.message ||
        "Mirror analysis failed"
      );
    }


    if (!data.analysis) {

      throw new Error(
        "Mirror returned no analysis"
      );
    }


    if (data.learningTwin) {
      localStorage.setItem(
        "learningTwin",
        JSON.stringify(data.learningTwin)
      );
    }

    return data;
  }


  // =====================================================
  // DISPLAY MIRROR RESULT
  // =====================================================

  function displayMirrorResult(
    mirrorResult
  ) {

    const analysis = mirrorResult?.analysis || mirrorResult || {};

    if (mirrorResult?.learningTwin) {
      localStorage.setItem(
        "learningTwin",
        JSON.stringify(mirrorResult.learningTwin)
      );
    }


    const container =
      document.createElement(
        "div"
      );

    container.className =
      "mirror-result";


    const score =
      Number(
        analysis.mastery_score
      ) || 0;


    const understanding =
      escapeHtml(
        analysis.understanding ||
        "partial"
      );


    const confidence =
      escapeHtml(
        analysis.confidence ||
        "medium"
      );


    const topic =
      escapeHtml(
        analysis.topic ||
        "Concept"
      );


    const feedback =
      escapeHtml(
        analysis.feedback ||
        "Keep practicing and explaining the concept in your own words."
      );


    const nextQuestion =
      escapeHtml(
        analysis.next_question ||
        "Can you explain the most important part of this concept in another way?"
      );


    const strengths =
      Array.isArray(
        analysis.strengths
      )
        ? analysis.strengths
        : [];


    const misconceptions =
      Array.isArray(
        analysis.misconceptions
      )
        ? analysis.misconceptions
        : [];


    const missingPoints =
      Array.isArray(
        analysis.missing_points
      )
        ? analysis.missing_points
        : [];


    const conceptTags =
      Array.isArray(
        analysis.concept_tags
      )
        ? analysis.concept_tags
        : [];


    function makeList(
      items,
      emptyText
    ) {

      if (!items.length) {

        return `
          <div class="mirror-empty">
            ${emptyText}
          </div>
        `;
      }


      return `
        <ul>
          ${items
            .map(
              item =>
                `<li>${escapeHtml(item)}</li>`
            )
            .join("")}
        </ul>
      `;
    }


    function makeTableCell(items, emptyText) {

      if (!items.length) {
        return escapeHtml(emptyText);
      }

      return items
        .map(item => escapeHtml(item))
        .join("<br>• ");
    }


    container.innerHTML = `

      <div class="mirror-header">

        <div>
          <div class="mirror-title">
            🪞 Swayam Mirror
          </div>

          <div class="mirror-topic">
            ${topic}
          </div>
        </div>

        <div class="mirror-score">
          <div class="mirror-score-number">
            ${score}
          </div>

          <div class="mirror-score-label">
            Mastery
          </div>
        </div>

      </div>


      <div class="mirror-analysis-table-wrap">

        <table class="mirror-analysis-table">

          <caption>Learning Analysis</caption>

          <tbody>

            <tr>
              <th scope="row">Mastery</th>
              <td>${score}/100</td>
            </tr>

            <tr>
              <th scope="row">Understanding</th>
              <td>${understanding}</td>
            </tr>

            <tr>
              <th scope="row">Confidence</th>
              <td>${confidence}</td>
            </tr>

            <tr>
              <th scope="row">Strengths</th>
              <td>${makeTableCell(strengths, "None detected yet.")}</td>
            </tr>

            <tr>
              <th scope="row">Possible misconceptions</th>
              <td>${makeTableCell(misconceptions, "No clear misconceptions detected.")}</td>
            </tr>

            <tr>
              <th scope="row">Missing points</th>
              <td>${makeTableCell(missingPoints, "No important missing points detected.")}</td>
            </tr>

          </tbody>

        </table>

      </div>


      <div class="mirror-summary">

        <div class="mirror-stat">

          <span>
            Understanding
          </span>

          <strong>
            ${understanding}
          </strong>

        </div>


        <div class="mirror-stat">

          <span>
            Confidence
          </span>

          <strong>
            ${confidence}
          </strong>

        </div>

      </div>


      <div class="mirror-section">

        <h4>
          ✅ What you understand
        </h4>

        ${makeList(
          strengths,
          "No specific strengths detected yet."
        )}

      </div>


      <div class="mirror-section">

        <h4>
          ⚠️ Possible misconceptions
        </h4>

        ${makeList(
          misconceptions,
          "No clear misconceptions detected."
        )}

      </div>


      <div class="mirror-section">

        <h4>
          📚 Missing points
        </h4>

        ${makeList(
          missingPoints,
          "No important missing points detected."
        )}

      </div>


      <div class="mirror-section">

        <h4>
          💬 Swayam's feedback
        </h4>

        <p>
          ${feedback}
        </p>

      </div>


      <div class="mirror-next-question">

        <div class="mirror-next-label">
          🎯 Your next challenge
        </div>

        <div class="mirror-question">
          ${nextQuestion}
        </div>

      </div>


      ${
        conceptTags.length
          ? `
            <div class="mirror-tags">

              ${conceptTags
                .map(
                  tag =>
                    `<span>${escapeHtml(tag)}</span>`
                )
                .join("")}

            </div>
          `
          : ""
      }

    `;


    chatBox.appendChild(
      container
    );

    // Make the next challenge actionable: clicking it focuses the
    // composer and pre-fills the exact question for the learner.
    const nextChallenge = container.querySelector(".mirror-next-question");
    if (nextChallenge) {
      nextChallenge.setAttribute("role", "button");
      nextChallenge.setAttribute("tabindex", "0");
      const useChallenge = () => {
        if (!userInput) return;
        userInput.value = analysis.next_question || "";
        userInput.focus();
        userInput.scrollIntoView({ behavior: "smooth", block: "nearest" });
      };
      nextChallenge.addEventListener("click", useChallenge);
      nextChallenge.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          useChallenge();
        }
      });
    }

    chatBox.scrollTop =
      chatBox.scrollHeight;
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

      const mirrorTopic =
        mirrorMode && mirrorTopicInput
          ? mirrorTopicInput.value.trim()
          : "";


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
        // SWAYAM MIRROR
        // ==============================================

        if (mirrorMode) {

          const analysis =
            await askMirror(
              mirrorTopic,
              message
            );


          displayMirrorResult(
            mirrorResult
          );


          // Speak only the useful feedback/question
          const speechText =
            [
              analysis.feedback,
              analysis.next_question
            ]
              .filter(Boolean)
              .join(". ");


          speakText(
            speechText
          );


        }

        // ==============================================
        // CODING AGENT
        // ==============================================

        else if (codingMode) {

          const reply =
            await askCodingAgent(
              message
            );


          addMessage(
            reply,
            "AI"
          );


          speakText(
            reply
          );

        }

        // ==============================================
        // NORMAL SARVAM AI
        // ==============================================

        else {

          const res =
            await fetch(
              "/api/explain-secure",
              {
                method: "POST",

                headers: { "Content-Type": "application/json" },

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


          // ==========================================
          // SEARCH YOUTUBE WHEN REQUESTED
          // ==========================================

          if (
            wantsVideoSearch(
              message
            )
          ) {

            await searchVideos(
              message
            );

          }

        }


      } catch (error) {

        console.error(
          "CHAT ERROR:",
          error
        );


        addMessage(
          error.message ||
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
