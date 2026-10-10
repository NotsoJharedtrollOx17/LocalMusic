(() => {
  let theme = "system";
  try {
    const saved = localStorage.getItem("local-music-theme");
    if (["light", "dark", "system"].includes(saved)) theme = saved;
  } catch {}
  document.documentElement.dataset.theme = theme;
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.style.backgroundColor = dark ? "#141615" : "#faf8f4";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
})();
