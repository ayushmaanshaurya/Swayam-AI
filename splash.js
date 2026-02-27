document.addEventListener("DOMContentLoaded", () => {
  const splash = document.getElementById("splashScreen");
  const login = document.getElementById("loginContent");

  setTimeout(() => {
    splash.style.opacity = "0";
    splash.style.transition = "0.6s ease";

    setTimeout(() => {
      splash.style.display = "none";
      login.style.display = "block";
    }, 600);

  }, 2500);
});