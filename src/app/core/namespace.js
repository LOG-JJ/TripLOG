(function createTripLogNamespace(global) {
  const TripLog = global.TripLog || {};
  const registry = TripLog.registry || {};

  function ensurePath(path) {
    return path.split(".").reduce((scope, part) => {
      if (!scope[part]) scope[part] = {};
      return scope[part];
    }, TripLog);
  }

  TripLog.register = function register(path, members = {}) {
    const scope = ensurePath(path);
    Object.assign(scope, members);
    registry[path] = { ...registry[path], ...members };
    if (global.document?.documentElement) {
      global.document.documentElement.dataset.triplogRegistryCount = String(Object.keys(registry).length);
      global.document.documentElement.dataset.triplogLastModule = path;
    }
    return scope;
  };

  TripLog.registry = registry;
  global.TripLog = TripLog;
  if (global.document?.documentElement) {
    global.document.documentElement.dataset.triplogLayered = "true";
  }
})(window);
