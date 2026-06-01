(function createThemeToggleModule() {
  const { els } = window.TripLog.core.runtime;
  const { saveAndRender } = window.TripLog.persistence.stateStorage;

  function setTheme(themeName) {
    const previousTheme = state.theme;
    state.theme = themeName === "toss" ? "toss" : "brutalist";
    
    // Set theme attribute on root element immediately
    document.documentElement.setAttribute("data-theme", state.theme);
    
    if (previousTheme !== state.theme) {
      saveAndRender();
    }
  }

  function renderThemeControls() {
    const theme = state.theme || "brutalist";
    
    // Ensure document attribute is in sync
    document.documentElement.setAttribute("data-theme", theme);
    
    if (els.themeBrutalistButton && els.themeTossButton) {
      const isBrutalist = theme === "brutalist";
      const isToss = theme === "toss";
      
      els.themeBrutalistButton.classList.toggle("active", isBrutalist);
      els.themeTossButton.classList.toggle("active", isToss);
      
      els.themeBrutalistButton.setAttribute("aria-pressed", String(isBrutalist));
      els.themeTossButton.setAttribute("aria-pressed", String(isToss));
    }
  }

  window.TripLog.register("features.settings.themeToggle", {
    setTheme,
    renderThemeControls,
  });
})();
