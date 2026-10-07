document.addEventListener("DOMContentLoaded", () => {
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  loginTab?.addEventListener("click", () => { loginTab.classList.add("active"); registerTab.classList.remove("active"); loginForm.classList.add("active"); registerForm.classList.remove("active"); });
  registerTab?.addEventListener("click", () => { registerTab.classList.add("active"); loginTab.classList.remove("active"); registerForm.classList.add("active"); loginForm.classList.remove("active"); });

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPass").value;
    if (!email || !password) return alert("Please enter your email and password.");
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) return alert(data.message || "Login failed.");
      window.location.href = "/chat.html";
    } catch (error) { console.error("LOGIN ERROR:", error); alert("Server error. Please try again."); }
  });

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("regUser").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPass").value;
    if (!username || !email || !password) return alert("Please fill all fields.");
    try {
      const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ username, email, password }) });
      const data = await res.json();
      if (!res.ok) return alert(data.message || "Registration failed.");
      if (data.user?.id && data.message?.includes("signed in")) return (window.location.href = "/chat.html");
      alert(data.message || "Registered successfully.");
      registerForm.reset();
      loginTab.click();
    } catch (error) { console.error("REGISTER ERROR:", error); alert("Server error. Please try again."); }
  });
});