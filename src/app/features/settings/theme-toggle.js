(function createThemeToggleModule() {
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
    

  }

  window.TripLog.register("features.settings.themeToggle", {
    setTheme,
    renderThemeControls,
  });
})();
