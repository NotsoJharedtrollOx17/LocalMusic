const themeButton = document.querySelector(".theme-toggle");
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
let chosen;
try {
  chosen = localStorage.getItem("local-music-site-theme");
} catch {}
if (chosen === "light" || chosen === "dark")
  document.documentElement.dataset.theme = chosen;
const isDark = () =>
  document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : systemTheme.matches;
const updateThemeButton = () =>
  themeButton.setAttribute(
    "aria-label",
    `Switch to ${isDark() ? "light" : "dark"} theme`,
  );
themeButton.hidden = false;
updateThemeButton();
systemTheme.addEventListener("change", updateThemeButton);
themeButton.addEventListener("click", () => {
  const theme = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("local-music-site-theme", theme);
  } catch {}
  updateThemeButton();
});
const image = document.querySelector("#visualizer-image");
const caption = document.querySelector("#mode-caption");
const descriptions = {
  spectrum:
    "Spectrum visualizer in the application, showing orange-to-blue frequency bars responding to original sample audio.",
  geometry:
    "Geometry visualizer in the application, showing an orange and blue attractor responding to original sample audio.",
  xmb: "XMB wave visualizer in the application, showing layered flowing ribbons responding to original sample audio.",
};
for (const link of document.querySelectorAll("[data-mode]")) {
  link.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    for (const option of document.querySelectorAll("[data-mode]"))
      option.removeAttribute("aria-current");
    link.setAttribute("aria-current", "true");
    image.src = link.getAttribute("href");
    image.alt = descriptions[link.dataset.mode];
    caption.textContent = `${link.textContent} / captured with original sample audio`;
  });
}
