// ================= TAB SWITCHING =================

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

loginTab.addEventListener("click", () => {
  loginTab.classList.add("active");
  registerTab.classList.remove("active");

  loginForm.classList.add("active");
  registerForm.classList.remove("active");
});

registerTab.addEventListener("click", () => {
  registerTab.classList.add("active");
  loginTab.classList.remove("active");

  registerForm.classList.add("active");
  loginForm.classList.remove("active");
});


// ================= LOGIN =================

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value.trim();

  if (!username || !password) {
    alert("Please fill all fields");
    return;
  }

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("profilePic", data.profilePic || "");

      // Redirect to chat page
      window.location.href = "chat.html";
    } else {
      alert("Invalid username or password");
    }

  } catch (error) {
    alert("Server error. Please try again.");
  }
});


// ================= REGISTER =================

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("regUser").value.trim();
  const password = document.getElementById("regPass").value.trim();
  const file = document.getElementById("profilePic").files[0];

  if (!username || !password) {
    alert("Please fill all fields");
    return;
  }

  const formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);

  if (file) {
    formData.append("profilePic", file);
  }

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (res.ok) {
      alert("Registered successfully! Please login.");
      registerForm.reset();
      loginTab.click();
    } else {
      alert(data.message || "Registration failed");
    }

  } catch (error) {
    alert("Server error. Please try again.");
  }
});