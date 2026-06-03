(function createTripCollaborationModule() {
  const ACCOUNT_STORAGE_KEY = "domesticTravelExpensePlanner.account.v1";
  const INVITES_STORAGE_KEY = "domesticTravelExpensePlanner.invites.v1";
  const SUPABASE_CONFIG_STORAGE_KEY = "domesticTravelExpensePlanner.supabaseConfig.v1";
  const SUPABASE_CDN_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.107.0/dist/umd/supabase.min.js";
  const DEFAULT_SUPABASE_CONFIG = {
    url: "https://iehdziiplzgvxcrbizgv.supabase.co",
    publishableKey: "sb_publishable_b5CwF1zyb5bzNHUT50xNsg_pSon5Glc",
  };
  const INVITE_PARAM = "invite";
  const INVITE_EXPIRES_DAYS = 14;
  const AUTH_PASSWORD_MIN_LENGTH = 8;

  let setupComplete = false;
  let supabaseClient = null;
  let supabaseClientSignature = "";
  let supabaseScriptPromise = null;
  let authListenerAttached = false;
  let currentSession = null;
  let pendingInviteRecord = null;
  let supabaseStatusOverride = null;
  let authGateMode = "login";
  let authGateBusy = false;
  let passwordRecoveryRequested = false;
  let authStatusOverride = null;

  function readJsonStorage(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getCollaboration() {
    state.collaboration = window.TripLog.persistence.stateStorage.normalizeCollaborationSettings(state.collaboration);
    return state.collaboration;
  }

  function getSupabaseConfig() {
    const saved = readJsonStorage(SUPABASE_CONFIG_STORAGE_KEY, {});
    const savedUrl = typeof saved.url === "string" ? saved.url.trim() : "";
    const savedKey = typeof saved.publishableKey === "string" ? saved.publishableKey.trim() : "";
    if (savedUrl && savedKey) {
      return {
        url: savedUrl,
        publishableKey: savedKey,
        source: "saved",
      };
    }

    return {
      ...DEFAULT_SUPABASE_CONFIG,
      source: "default",
    };
  }

  function hasSupabaseConfig(config = getSupabaseConfig()) {
    return /^https?:\/\//.test(config.url) && config.publishableKey.length > 20;
  }

  function saveSupabaseConfig(url, publishableKey) {
    const next = { url: url.trim(), publishableKey: publishableKey.trim() };
    writeJsonStorage(SUPABASE_CONFIG_STORAGE_KEY, next);
    supabaseClient = null;
    supabaseClientSignature = "";
    authListenerAttached = false;
    supabaseStatusOverride = null;
    return next;
  }

  function clearSupabaseConfig() {
    localStorage.removeItem(SUPABASE_CONFIG_STORAGE_KEY);
    supabaseClient = null;
    supabaseClientSignature = "";
    authListenerAttached = false;
    currentSession = null;
    supabaseStatusOverride = null;
  }

  function loadSupabaseScript() {
    if (window.supabase?.createClient) return Promise.resolve();
    if (supabaseScriptPromise) return supabaseScriptPromise;

    supabaseScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeoutId = window.setTimeout(() => reject(new Error("Supabase 클라이언트 로딩 시간이 초과되었습니다.")), 8000);
      script.src = SUPABASE_CDN_URL;
      script.async = true;
      script.onload = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
      script.onerror = () => {
        window.clearTimeout(timeoutId);
        reject(new Error("Supabase 클라이언트를 불러오지 못했습니다."));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      supabaseScriptPromise = null;
      throw error;
    });

    return supabaseScriptPromise;
  }

  async function getSupabaseClient() {
    const config = getSupabaseConfig();
    if (!hasSupabaseConfig(config)) throw new Error("Supabase 연결 정보가 필요합니다.");
    const signature = `${config.url}|${config.publishableKey.slice(0, 16)}`;
    if (supabaseClient && supabaseClientSignature === signature) return supabaseClient;

    await loadSupabaseScript();
    supabaseClient = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
    supabaseClientSignature = signature;
    return supabaseClient;
  }

  function getStoredAccount() {
    const account = readJsonStorage(ACCOUNT_STORAGE_KEY, null);
    if (!account || typeof account !== "object") return null;
    return {
      id: typeof account.id === "string" ? account.id : "",
      email: typeof account.email === "string" ? account.email : "",
      displayName: typeof account.displayName === "string" ? account.displayName : "",
      provider: typeof account.provider === "string" ? account.provider : "local",
    };
  }

  function isSupabaseAuthRequiredError(error) {
    const message = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "");
    return code === "42501"
      || message.includes("permission denied")
      || message.includes("row-level security")
      || message.includes("jwt");
  }

  function getSessionAccount() {
    const user = currentSession?.user;
    if (!user) return null;
    const metadata = user.user_metadata || {};
    return {
      id: user.id,
      email: user.email || "",
      displayName: metadata.full_name || metadata.name || user.email?.split("@")[0] || "나",
      provider: "supabase",
    };
  }

  function getCurrentAccount() {
    return getSessionAccount() || getStoredAccount();
  }

  function saveLocalAccount({ email, displayName }) {
    const normalizedEmail = String(email || "").trim();
    const normalizedName = String(displayName || "").trim() || normalizedEmail.split("@")[0] || "나";
    const previous = getStoredAccount();
    const account = {
      id: previous?.id || `local_${Date.now()}`,
      email: normalizedEmail,
      displayName: normalizedName,
      provider: "local",
    };
    writeJsonStorage(ACCOUNT_STORAGE_KEY, account);
    applyOwnerAccount(account);
    return account;
  }

  function clearLocalAccount() {
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
  }

  function applyOwnerAccount(account) {
    if (!account) return;
    const collaboration = getCollaboration();
    const canClaimOwner = !collaboration.ownerId
      || collaboration.ownerId.startsWith("local_")
      || collaboration.ownerEmail === account.email;
    if (!canClaimOwner) return;
    collaboration.ownerId = account.id || collaboration.ownerId;
    collaboration.ownerName = account.displayName || collaboration.ownerName || "나";
    collaboration.ownerEmail = account.email || collaboration.ownerEmail || "";
    saveStateSilently();
  }

  async function syncSupabaseSession() {
    if (!hasSupabaseConfig()) {
      currentSession = null;
      renderTripCollaboration();
      return;
    }

    try {
      const client = await getSupabaseClient();
      if (!authListenerAttached) {
        client.auth.onAuthStateChange((event, session) => {
          currentSession = session || null;
          supabaseStatusOverride = null;
          if (event === "PASSWORD_RECOVERY") {
            passwordRecoveryRequested = true;
            authGateMode = "recovery";
            authStatusOverride = {
              message: "새 비밀번호를 입력하면 계정 복구가 완료됩니다.",
              tone: "neutral",
            };
          } else if (event === "SIGNED_IN") {
            authStatusOverride = null;
          } else if (event === "SIGNED_OUT") {
            passwordRecoveryRequested = false;
            authGateMode = "login";
          }
          const account = getSessionAccount();
          if (account) applyOwnerAccount(account);
          renderTripCollaboration();
        });
        authListenerAttached = true;
      }

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      currentSession = data.session || null;
      supabaseStatusOverride = null;
      if (currentSession && hasPasswordRecoveryParams()) {
        passwordRecoveryRequested = true;
        authGateMode = "recovery";
        authStatusOverride = {
          message: "새 비밀번호를 입력하면 계정 복구가 완료됩니다.",
          tone: "neutral",
        };
      }
      const sessionAccount = getSessionAccount();
      if (sessionAccount) applyOwnerAccount(sessionAccount);
    } catch (error) {
      currentSession = null;
      supabaseStatusOverride = {
        message: `Supabase 세션 확인 실패: ${error.message}`,
        tone: "warning",
      };
      authStatusOverride = {
        message: `Supabase 연결 확인 실패: ${error.message}`,
        tone: "warning",
      };
    } finally {
      renderTripCollaboration();
    }
  }

  function getMemberKey(member) {
    return String(member.email || member.id || member.name || "").trim().toLowerCase();
  }

  function addUniqueMember(members, member) {
    const key = getMemberKey(member);
    if (!key || members.some((existing) => getMemberKey(existing) === key)) return;
    members.push(member);
  }

  function getTripMembers() {
    const collaboration = getCollaboration();
    const hasOwnerIdentity = Boolean(collaboration.ownerId || collaboration.ownerEmail);
    const owner = {
      id: collaboration.ownerId || "owner",
      name: collaboration.ownerName || "나",
      email: hasOwnerIdentity ? collaboration.ownerEmail : "",
      role: "owner",
      status: "accepted",
    };
    const members = [owner];

    (collaboration.members || [])
      .filter((member) => member.status !== "pending")
      .forEach((member) => addUniqueMember(members, member));

    (state.companions || []).forEach((companion, index) => {
      addUniqueMember(members, {
        id: `companion_${index}_${companion.name}`,
        name: companion.name,
        email: companion.email || "",
        role: "member",
        status: "accepted",
      });
    });

    return members;
  }

  function getMemberInitial(member) {
    const source = String(member.name || member.email || "?").trim();
    return source.slice(0, 2).toUpperCase();
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function setInputValue(input, value) {
    if (input && document.activeElement !== input) input.value = value || "";
  }

  function setStatus(element, message, tone = "neutral") {
    if (!element) return;
    element.textContent = message;
    element.dataset.tone = tone;
  }

  function setSettingsStatus(message, tone = "neutral") {
    setStatus(els.settingsSupabaseStatus, message, tone);
  }

  function hasPasswordRecoveryParams() {
    const hashParams = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const type = hashParams.get("type") || queryParams.get("type");
    return type === "recovery" || type === "password_recovery";
  }

  function isSignedIn() {
    return Boolean(currentSession?.user);
  }

  function setAuthStatus(message, tone = "neutral") {
    setStatus(els.authGateStatus, message, tone);
  }

  function getFriendlyAuthError(error) {
    const message = String(error?.message || "인증에 실패했습니다.");
    const normalized = message.toLowerCase();
    if (normalized.includes("invalid login credentials")) return "이메일 또는 비밀번호를 확인해 주세요.";
    if (normalized.includes("email not confirmed")) return "가입 확인 이메일을 먼저 열어 주세요.";
    if (normalized.includes("signup is disabled")) return "Supabase에서 회원가입이 꺼져 있습니다.";
    if (normalized.includes("password should be")) return "비밀번호는 Supabase 보안 기준에 맞게 더 길고 안전하게 입력해 주세요.";
    return message;
  }

  function setAuthGateBusy(isBusy) {
    authGateBusy = Boolean(isBusy);
    [
      els.authGateSubmitButton,
      els.authModeLogin,
      els.authModeSignup,
      els.authGateForgotButton,
      els.authGateResetSupabaseButton,
    ].forEach((button) => {
      if (button) button.disabled = authGateBusy;
    });
  }

  function setAuthGateMode(mode, { keepStatus = false } = {}) {
    authGateMode = mode === "signup" || mode === "recovery" ? mode : "login";
    if (!keepStatus) authStatusOverride = null;
    if (authGateMode !== "recovery") passwordRecoveryRequested = false;
    renderAuthGate();
  }

  function fillAuthEmailFromAccount(account = getCurrentAccount()) {
    if (!account) return;
    setInputValue(els.authGateNameInput, account.displayName);
    setInputValue(els.authGateEmailInput, account.email);
  }

  function renderAuthGate() {
    const shouldShowGate = passwordRecoveryRequested || !isSignedIn();
    if (els.appShell) {
      els.appShell.hidden = shouldShowGate;
      els.appShell.setAttribute("aria-hidden", String(shouldShowGate));
    }
    if (els.authGate) {
      els.authGate.hidden = !shouldShowGate;
      els.authGate.setAttribute("aria-hidden", String(!shouldShowGate));
    }
    document.body?.classList.toggle("auth-required", shouldShowGate);
    document.documentElement.dataset.auth = shouldShowGate ? "locked" : "signed-in";
    if (!shouldShowGate) return;

    const isSignup = authGateMode === "signup";
    const isRecovery = authGateMode === "recovery";
    const modeTitle = isRecovery ? "새 비밀번호 설정" : (isSignup ? "회원가입" : "로그인");
    const modeSubtitle = isRecovery
      ? "복구 링크가 확인되었습니다. 새 비밀번호를 저장하세요."
      : (isSignup ? "이메일과 비밀번호로 TripLOG 계정을 만듭니다." : "이메일과 비밀번호로 바로 시작합니다.");

    setText(els.authGateTitle, modeTitle);
    setText(els.authGateSubtitle, modeSubtitle);
    if (els.authModeToggle) els.authModeToggle.hidden = isRecovery;
    if (els.authModeLogin) {
      els.authModeLogin.classList.toggle("active", !isSignup);
      els.authModeLogin.setAttribute("aria-pressed", String(!isSignup));
    }
    if (els.authModeSignup) {
      els.authModeSignup.classList.toggle("active", isSignup);
      els.authModeSignup.setAttribute("aria-pressed", String(isSignup));
    }

    if (els.authGateNameField) els.authGateNameField.hidden = !isSignup;
    if (els.authGateEmailField) els.authGateEmailField.hidden = isRecovery;
    if (els.authGatePasswordConfirmField) els.authGatePasswordConfirmField.hidden = !(isSignup || isRecovery);
    if (els.authGateEmailInput) els.authGateEmailInput.required = !isRecovery;
    if (els.authGateNameInput) els.authGateNameInput.required = isSignup;
    if (els.authGatePasswordInput) {
      els.authGatePasswordInput.required = true;
      els.authGatePasswordInput.autocomplete = isSignup || isRecovery ? "new-password" : "current-password";
    }
    if (els.authGatePasswordConfirmInput) {
      els.authGatePasswordConfirmInput.required = isSignup || isRecovery;
      els.authGatePasswordConfirmInput.autocomplete = "new-password";
    }
    if (els.authGateSubmitButton) {
      els.authGateSubmitButton.textContent = isRecovery ? "비밀번호 저장" : (isSignup ? "계정 만들기" : "로그인");
    }

    fillAuthEmailFromAccount();
    if (authStatusOverride) {
      setAuthStatus(authStatusOverride.message, authStatusOverride.tone);
    } else if (supabaseStatusOverride) {
      setAuthStatus(supabaseStatusOverride.message, supabaseStatusOverride.tone);
    } else if (!hasSupabaseConfig()) {
      setAuthStatus("Supabase 연결 정보가 필요합니다. 기본 연결 복구를 눌러 주세요.", "warning");
    } else {
      setAuthStatus(isSignup ? "가입 후 이메일 확인이 필요할 수 있습니다." : "TripLOG 계정으로 로그인해 주세요.", "neutral");
    }
    setAuthGateBusy(authGateBusy);
  }

  function getAuthFormValues() {
    return {
      displayName: String(els.authGateNameInput?.value || "").trim(),
      email: String(els.authGateEmailInput?.value || "").trim(),
      password: String(els.authGatePasswordInput?.value || ""),
      passwordConfirm: String(els.authGatePasswordConfirmInput?.value || ""),
    };
  }

  function validatePasswordFields(password, passwordConfirm, needsConfirm) {
    if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
      throw new Error(`비밀번호는 ${AUTH_PASSWORD_MIN_LENGTH}자 이상으로 입력해 주세요.`);
    }
    if (needsConfirm && password !== passwordConfirm) {
      throw new Error("비밀번호 확인이 일치하지 않습니다.");
    }
  }

  function clearAuthPasswordInputs() {
    if (els.authGatePasswordInput) els.authGatePasswordInput.value = "";
    if (els.authGatePasswordConfirmInput) els.authGatePasswordConfirmInput.value = "";
  }

  async function handleAuthGateSubmit(event) {
    event?.preventDefault();
    if (authGateBusy) return;

    const { displayName, email, password, passwordConfirm } = getAuthFormValues();
    const isSignup = authGateMode === "signup";
    const isRecovery = authGateMode === "recovery";
    try {
      if (!hasSupabaseConfig()) throw new Error("Supabase 연결 정보가 필요합니다.");
      if (!isRecovery && !email) throw new Error("이메일을 입력해 주세요.");
      if (isSignup && !displayName) throw new Error("표시 이름을 입력해 주세요.");
      validatePasswordFields(password, passwordConfirm, isSignup || isRecovery);
      setAuthGateBusy(true);
      setAuthStatus(isRecovery ? "새 비밀번호를 저장하는 중입니다." : (isSignup ? "계정을 만드는 중입니다." : "로그인 중입니다."));

      const client = await getSupabaseClient();
      if (isRecovery) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        passwordRecoveryRequested = false;
        authGateMode = "login";
        authStatusOverride = {
          message: "비밀번호가 변경되었습니다. TripLOG를 계속 사용할 수 있습니다.",
          tone: "success",
        };
        clearAuthPasswordInputs();
        window.history.replaceState({}, document.title, buildAuthRedirectUrl());
        await syncSupabaseSession();
        return;
      }

      if (isSignup) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: buildAuthRedirectUrl(),
            data: {
              display_name: displayName,
              full_name: displayName,
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          currentSession = data.session;
          applyOwnerAccount(getSessionAccount());
          authStatusOverride = null;
          renderTripCollaboration();
        } else {
          authStatusOverride = {
            message: "가입 확인 이메일을 보냈습니다. 이메일을 확인한 뒤 로그인해 주세요.",
            tone: "success",
          };
          clearAuthPasswordInputs();
          setAuthGateMode("login", { keepStatus: true });
        }
        return;
      }

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentSession = data.session || null;
      const account = getSessionAccount();
      if (account) applyOwnerAccount(account);
      authStatusOverride = null;
      clearAuthPasswordInputs();
      renderTripCollaboration();
    } catch (error) {
      authStatusOverride = {
        message: getFriendlyAuthError(error),
        tone: "warning",
      };
      renderAuthGate();
    } finally {
      setAuthGateBusy(false);
    }
  }

  async function requestPasswordReset() {
    if (authGateBusy) return;
    const email = String(els.authGateEmailInput?.value || els.settingsAccountEmailInput?.value || "").trim();
    if (!email) {
      authStatusOverride = { message: "비밀번호를 재설정할 이메일을 입력해 주세요.", tone: "warning" };
      renderAuthGate();
      return;
    }
    try {
      if (!hasSupabaseConfig()) throw new Error("Supabase 연결 정보가 필요합니다.");
      setAuthGateBusy(true);
      setAuthStatus("비밀번호 재설정 이메일을 보내는 중입니다.");
      const client = await getSupabaseClient();
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: buildAuthRedirectUrl(),
      });
      if (error) throw error;
      authStatusOverride = {
        message: "비밀번호 재설정 이메일을 보냈습니다. 이메일 링크를 열면 새 비밀번호를 설정할 수 있습니다.",
        tone: "success",
      };
    } catch (error) {
      authStatusOverride = {
        message: getFriendlyAuthError(error),
        tone: "warning",
      };
    } finally {
      setAuthGateBusy(false);
      renderAuthGate();
    }
  }

  function resetAuthSupabaseConfig() {
    clearSupabaseConfig();
    authStatusOverride = {
      message: "기본 TripLOG Supabase 연결로 복구했습니다. 다시 로그인해 주세요.",
      tone: "success",
    };
    syncSupabaseSession();
  }

  function renderHeaderMembers() {
    if (!els.headerTripMembers) return;
    const members = getTripMembers();
    const showEmail = getCollaboration().privacy.showMemberEmail;
    els.headerTripMemberAvatars?.replaceChildren();
    members.slice(0, 4).forEach((member, index) => {
      const avatar = document.createElement("span");
      avatar.textContent = getMemberInitial(member);
      avatar.title = member.name;
      avatar.style.setProperty("--member-index", String(index));
      els.headerTripMemberAvatars.appendChild(avatar);
    });
    const names = members
      .map((member) => showEmail && member.email ? `${member.name} (${member.email})` : member.name)
      .join(", ");
    setText(els.headerTripMemberCount, `${members.length}명`);
    setText(els.headerTripMemberNames, names || "나");
    els.headerTripMembers.title = names || "현재 여행 인원";
  }

  function renderAccountSettings() {
    const account = getCurrentAccount();
    const config = getSupabaseConfig();
    const providerLabel = account?.provider === "supabase" ? "Supabase 로그인" : "이 기기 프로필";
    const status = account
      ? `${providerLabel} · ${account.displayName || account.email || "사용자"}`
      : "로그인 전 · 초대 수락과 서버 저장은 로그인 후 사용할 수 있습니다.";

    setText(els.settingsAccountStatus, status);
    if (account) {
      setInputValue(els.settingsAccountNameInput, account.displayName);
      setInputValue(els.settingsAccountEmailInput, account.email);
    }

    setInputValue(els.settingsSupabaseUrlInput, config.url);
    if (els.settingsSupabaseKeyInput && document.activeElement !== els.settingsSupabaseKeyInput) {
      els.settingsSupabaseKeyInput.value = "";
      els.settingsSupabaseKeyInput.placeholder = config.publishableKey
        ? (config.source === "default" ? "기본 공개 키 사용 중" : "저장된 공개 키 사용 중")
        : "sb_publishable_... 또는 anon key";
    }

    const collaboration = getCollaboration();
    if (els.privacyShareItineraryInput) els.privacyShareItineraryInput.checked = collaboration.privacy.shareItinerary;
    if (els.privacyShareExpensesInput) els.privacyShareExpensesInput.checked = collaboration.privacy.shareExpenses;
    if (els.privacyShowEmailInput) els.privacyShowEmailInput.checked = collaboration.privacy.showMemberEmail;
    if (els.privacyAllowInviteInput) els.privacyAllowInviteInput.checked = collaboration.privacy.allowInviteRequests;

    if (supabaseStatusOverride) {
      setSettingsStatus(supabaseStatusOverride.message, supabaseStatusOverride.tone);
      return;
    }

    const sourceLabel = config.source === "default" ? "기본 Supabase 연결" : "저장된 Supabase 연결";
    const configStatus = hasSupabaseConfig(config)
      ? `${sourceLabel}됨 · ${currentSession ? "로그인 세션 활성" : "로그인 필요"}`
      : "Supabase 미연결 · 로컬 프로필로 화면 흐름만 확인합니다.";
    setSettingsStatus(configStatus, hasSupabaseConfig(config) ? "success" : "warning");
  }

  function renderInviteModal() {
    if (!els.tripInviteModal) return;
    const members = getTripMembers();
    const collaboration = getCollaboration();
    const showEmail = collaboration.privacy.showMemberEmail;
    const memberNames = members
      .map((member) => showEmail && member.email ? `${member.name} (${member.email})` : member.name)
      .join(", ");
    setText(els.tripInviteTripName, state.tripName || "현재 여행");
    setText(els.tripInviteMemberSummary, `인원 ${members.length}명 · ${memberNames}`);
    if (els.tripInviteLinkInput && document.activeElement !== els.tripInviteLinkInput) {
      els.tripInviteLinkInput.value = collaboration.lastInviteUrl || els.tripInviteLinkInput.value || "";
    }
  }

  function renderAcceptInviteModal() {
    if (!pendingInviteRecord) return;
    const account = getCurrentAccount();
    const tripName = pendingInviteRecord.tripName || pendingInviteRecord.trip_name || "초대된 여행";
    const expiresAt = pendingInviteRecord.expiresAt || pendingInviteRecord.expires_at || "";
    setText(els.tripInviteAcceptTripName, tripName);
    setText(els.tripInviteAcceptMeta, expiresAt ? `초대 만료 ${formatInviteDate(expiresAt)}` : "초대 링크를 확인했습니다.");
    if (account) {
      setInputValue(els.tripInviteAcceptNameInput, account.displayName);
      setInputValue(els.tripInviteAcceptEmailInput, account.email);
    }
  }

  function renderTripCollaboration() {
    renderAuthGate();
    renderHeaderMembers();
    renderAccountSettings();
    renderInviteModal();
    renderAcceptInviteModal();
  }

  function createInviteToken() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `invite_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function getInviteExpiry() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRES_DAYS);
    return expiresAt.toISOString();
  }

  function buildInviteUrl(token) {
    const url = new URL(window.location.href);
    url.searchParams.set(INVITE_PARAM, token);
    url.searchParams.set("trip", state.id || "");
    url.searchParams.set("page", "start");
    return url.toString();
  }

  function buildAuthRedirectUrl() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(INVITE_PARAM)) url.searchParams.set("page", "settings");
    url.hash = "";
    return url.toString();
  }

  function getLocalInvites() {
    const invites = readJsonStorage(INVITES_STORAGE_KEY, []);
    return Array.isArray(invites) ? invites : [];
  }

  function saveLocalInvite(invite) {
    const invites = getLocalInvites().filter((item) => item.token !== invite.token);
    invites.unshift(invite);
    writeJsonStorage(INVITES_STORAGE_KEY, invites.slice(0, 50));
  }

  function buildSharedTripSnapshot() {
    const snapshot = getStateSnapshot();
    const privacy = getCollaboration().privacy;
    if (!privacy.shareExpenses) snapshot.entries = [];
    if (!privacy.shareItinerary) snapshot.itineraryItems = [];
    return snapshot;
  }

  async function syncTripInviteToSupabase(inviteRecord) {
    const sessionAccount = getSessionAccount();
    if (!sessionAccount) throw new Error("Supabase 로그인 후 서버 초대 저장이 가능합니다.");

    const client = await getSupabaseClient();
    const snapshot = buildSharedTripSnapshot();
    const collaboration = getCollaboration();
    const { data: tripRow, error: tripError } = await client
      .from("triplog_trips")
      .upsert({
        app_trip_id: state.id,
        owner_id: sessionAccount.id,
        trip_name: state.tripName || "현재 여행",
        start_date: state.startDate || null,
        end_date: state.endDate || null,
        travel_state: snapshot,
        privacy: collaboration.privacy,
        updated_at: new Date().toISOString(),
      }, { onConflict: "app_trip_id" })
      .select("id")
      .single();

    if (tripError) throw tripError;

    await client.from("triplog_trip_members").upsert({
      trip_id: tripRow.id,
      user_id: sessionAccount.id,
      email: sessionAccount.email,
      display_name: sessionAccount.displayName,
      role: "owner",
      status: "accepted",
      joined_at: new Date().toISOString(),
    }, { onConflict: "trip_id,user_id" });

    const { error: inviteError } = await client
      .from("triplog_trip_invites")
      .upsert({
        token: inviteRecord.token,
        trip_id: tripRow.id,
        app_trip_id: state.id,
        trip_name: state.tripName || "현재 여행",
        created_by: sessionAccount.id,
        expires_at: inviteRecord.expiresAt,
        status: "open",
      }, { onConflict: "token" });

    if (inviteError) throw inviteError;
    return tripRow;
  }

  async function createTripInvite({ forceNew = false } = {}) {
    const collaboration = getCollaboration();
    if (!collaboration.privacy.allowInviteRequests) {
      setStatus(els.tripInviteStatus, "개인정보 설정에서 초대 링크 수락이 꺼져 있습니다.", "warning");
      return null;
    }

    const token = forceNew || !collaboration.inviteToken ? createInviteToken() : collaboration.inviteToken;
    const inviteUrl = buildInviteUrl(token);
    const inviteRecord = {
      token,
      tripId: state.id,
      tripName: state.tripName || "현재 여행",
      startDate: state.startDate || "",
      endDate: state.endDate || "",
      createdAt: new Date().toISOString(),
      expiresAt: getInviteExpiry(),
      createdBy: getCurrentAccount()?.email || "",
      snapshot: buildSharedTripSnapshot(),
      source: "local",
    };

    collaboration.inviteToken = token;
    collaboration.lastInviteUrl = inviteUrl;
    saveLocalInvite(inviteRecord);
    saveStateSilently();
    renderTripCollaboration();
    if (els.tripInviteLinkInput) els.tripInviteLinkInput.value = inviteUrl;

    if (hasSupabaseConfig()) {
      try {
        await syncTripInviteToSupabase(inviteRecord);
        setStatus(els.tripInviteStatus, "Supabase에 초대 링크를 저장했습니다. 링크를 공유해도 됩니다.", "success");
      } catch (error) {
        setStatus(els.tripInviteStatus, `로컬 링크 생성됨 · 서버 저장 보류: ${error.message}`, "warning");
      }
    } else {
      setStatus(els.tripInviteStatus, "로컬 링크가 생성되었습니다. 다른 기기 수락은 Supabase 연결 후 가능합니다.", "warning");
    }

    return inviteRecord;
  }

  async function openTripInviteModal() {
    if (!els.tripInviteModal) return;
    els.tripInviteModal.hidden = false;
    renderTripCollaboration();
    await createTripInvite();
  }

  function closeTripInviteModal() {
    if (els.tripInviteModal) els.tripInviteModal.hidden = true;
  }

  async function copyInviteLink() {
    const value = els.tripInviteLinkInput?.value || getCollaboration().lastInviteUrl;
    if (!value) {
      await createTripInvite();
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setStatus(els.tripInviteStatus, "초대 링크를 복사했습니다.", "success");
    } catch {
      els.tripInviteLinkInput?.select();
      document.execCommand("copy");
      setStatus(els.tripInviteStatus, "초대 링크를 선택했습니다. 복사해서 공유하세요.", "success");
    }
  }

  async function sendMagicLink(profile = {}) {
    const email = String(profile.email || els.settingsAccountEmailInput?.value || "").trim();
    const displayName = String(profile.displayName || els.settingsAccountNameInput?.value || "").trim();
    if (!email) {
      setText(els.settingsAccountStatus, "이메일을 입력해 주세요.");
      return;
    }
    saveLocalAccount({ email, displayName });

    if (!hasSupabaseConfig()) {
      setText(els.settingsAccountStatus, "프로필을 이 기기에 저장했습니다. Supabase 연결 후 이메일 링크를 보낼 수 있습니다.");
      renderTripCollaboration();
      return;
    }

    try {
      const client = await getSupabaseClient();
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: buildAuthRedirectUrl(),
          data: { display_name: displayName || email.split("@")[0] },
        },
      });
      if (error) throw error;
      setText(els.settingsAccountStatus, "이메일 링크를 보냈습니다. 이메일에서 링크를 열어 주세요.");
    } catch (error) {
      setText(els.settingsAccountStatus, `이메일 링크 발송 실패: ${error.message}`);
    }
  }

  function saveProfileFromSettings() {
    const email = els.settingsAccountEmailInput?.value.trim();
    const displayName = els.settingsAccountNameInput?.value.trim();
    if (!displayName && !email) {
      setText(els.settingsAccountStatus, "표시 이름 또는 이메일을 입력해 주세요.");
      return;
    }
    saveLocalAccount({ email, displayName });
    renderTripCollaboration();
    setText(els.settingsAccountStatus, "이 기기 프로필을 저장했습니다.");
  }

  async function logoutTripAccount() {
    try {
      if (hasSupabaseConfig()) {
        const client = await getSupabaseClient();
        await client.auth.signOut({ scope: "local" });
      }
    } catch (error) {
      setText(els.settingsAccountStatus, `Supabase 로그아웃 확인 필요: ${error.message}`);
    }
    clearLocalAccount();
    currentSession = null;
    renderTripCollaboration();
  }

  function updatePrivacySetting(key, checked) {
    const collaboration = getCollaboration();
    collaboration.privacy[key] = checked;
    saveAndRender();
  }

  function handleSupabaseSave() {
    const currentConfig = getSupabaseConfig();
    const url = els.settingsSupabaseUrlInput?.value.trim() || "";
    const typedKey = els.settingsSupabaseKeyInput?.value.trim() || "";
    const key = typedKey || (url === currentConfig.url ? currentConfig.publishableKey : "");
    if (!url || !key) {
      setSettingsStatus("Project URL과 공개 키를 모두 입력해 주세요.", "warning");
      return;
    }
    saveSupabaseConfig(url, key);
    setSettingsStatus("Supabase 연결 정보를 저장했습니다.", "success");
    syncSupabaseSession();
  }

  function handleSupabaseClear() {
    clearSupabaseConfig();
    setSettingsStatus("저장된 연결 정보를 지우고 기본 Supabase 연결로 복구했습니다.", "success");
    syncSupabaseSession();
  }

  async function resolveInvite(token) {
    const localInvite = getLocalInvites().find((invite) => invite.token === token);
    if (localInvite) return { ...localInvite, source: "local" };

    if (!hasSupabaseConfig()) {
      return { token, tripName: "초대 정보를 찾을 수 없음", source: "missing" };
    }

    try {
      const client = await getSupabaseClient();
      const { data, error } = await client
        .from("triplog_trip_invites")
        .select("id, token, trip_id, app_trip_id, trip_name, expires_at, status")
        .eq("token", token)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { token, tripName: "초대 정보를 찾을 수 없음", source: "missing" };
      return { ...data, source: "supabase" };
    } catch (error) {
      if (isSupabaseAuthRequiredError(error)) {
        return { token, tripName: "로그인 후 초대 확인", source: "login_required" };
      }
      return { token, tripName: "초대 확인 실패", source: "error", errorMessage: error.message };
    }
  }

  async function openInviteAcceptModal(token) {
    if (!token || !els.tripInviteAcceptModal) return;
    pendingInviteRecord = { token, tripName: "초대 확인 중", source: "loading" };
    els.tripInviteAcceptModal.hidden = false;
    renderTripCollaboration();
    pendingInviteRecord = await resolveInvite(token);
    renderTripCollaboration();

    if (pendingInviteRecord.source === "missing") {
      setStatus(els.tripInviteAcceptStatus, "초대 링크를 찾지 못했습니다. Supabase 연결 또는 링크를 확인해 주세요.", "warning");
    } else if (pendingInviteRecord.source === "login_required") {
      setStatus(els.tripInviteAcceptStatus, "로그인 후 같은 초대 링크로 돌아오면 수락할 수 있습니다.", "neutral");
    } else if (pendingInviteRecord.source === "error") {
      setStatus(els.tripInviteAcceptStatus, `초대 확인 실패: ${pendingInviteRecord.errorMessage}`, "warning");
    } else {
      setStatus(els.tripInviteAcceptStatus, "이름과 이메일을 확인하고 초대를 수락하세요.", "neutral");
    }
  }

  function closeInviteAcceptModal() {
    if (els.tripInviteAcceptModal) els.tripInviteAcceptModal.hidden = true;
  }

  function addAcceptedMemberToState(account) {
    const collaboration = getCollaboration();
    const member = {
      id: account.id || `local_member_${Date.now()}`,
      name: account.displayName || account.email?.split("@")[0] || "여행 멤버",
      email: account.email || "",
      role: "member",
      status: "accepted",
      joinedAt: new Date().toISOString(),
    };
    const members = Array.isArray(collaboration.members) ? collaboration.members : [];
    const key = getMemberKey(member);
    if (!members.some((existing) => getMemberKey(existing) === key)) {
      members.push(member);
      collaboration.members = members;
    }
    state.companions = Array.isArray(state.companions) ? state.companions : [];
    if (!state.companions.some((companion) => companion.name === member.name)) {
      state.companions.push({ name: member.name, individualSpent: 0, email: member.email });
    }
  }

  async function acceptSupabaseInvite(account) {
    const sessionAccount = getSessionAccount();
    if (!sessionAccount) {
      setAuthGateMode("login");
      fillAuthEmailFromAccount(account);
      authStatusOverride = {
        message: "초대 수락은 로그인 후 가능합니다. 이메일과 비밀번호로 로그인해 주세요.",
        tone: "neutral",
      };
      renderAuthGate();
      throw new Error("먼저 로그인한 뒤 초대를 수락해 주세요.");
    }

    const client = await getSupabaseClient();
    const invite = pendingInviteRecord;
    const { error: memberError } = await client.from("triplog_trip_members").upsert({
      trip_id: invite.trip_id,
      user_id: sessionAccount.id,
      email: sessionAccount.email || account.email,
      display_name: account.displayName || sessionAccount.displayName,
      role: "member",
      status: "accepted",
      invite_token: invite.token,
      joined_at: new Date().toISOString(),
    }, { onConflict: "trip_id,user_id" });
    if (memberError) throw memberError;

    const { data: tripRow, error: tripError } = await client
      .from("triplog_trips")
      .select("travel_state")
      .eq("id", invite.trip_id)
      .single();
    if (tripError) throw tripError;

    const snapshot = tripRow?.travel_state && typeof tripRow.travel_state === "object"
      ? tripRow.travel_state
      : { id: invite.app_trip_id, tripName: invite.trip_name };
    window.TripLog.persistence.stateStorage.importSharedTripSnapshot(snapshot, { makeActive: true });
    addAcceptedMemberToState(sessionAccount);
    saveAndRender();
  }

  function acceptLocalInvite(account) {
    const invite = pendingInviteRecord;
    if (invite.snapshot) {
      window.TripLog.persistence.stateStorage.importSharedTripSnapshot(invite.snapshot, { makeActive: true });
    } else if (invite.tripId && invite.tripId !== state.id) {
      const hasTrip = window.TripLog.persistence.stateStorage.getTrips().some((trip) => trip.id === invite.tripId);
      if (hasTrip) window.TripLog.persistence.stateStorage.switchTrip(invite.tripId);
    }
    addAcceptedMemberToState(account);
    saveAndRender();
  }

  async function acceptPendingInvite(event) {
    event?.preventDefault();
    if (!pendingInviteRecord || ["missing", "error", "loading"].includes(pendingInviteRecord.source)) {
      setStatus(els.tripInviteAcceptStatus, "수락할 초대 정보를 먼저 확인해 주세요.", "warning");
      return;
    }

    const email = els.tripInviteAcceptEmailInput?.value.trim() || els.settingsAccountEmailInput?.value.trim() || "";
    const displayName = els.tripInviteAcceptNameInput?.value.trim() || els.settingsAccountNameInput?.value.trim() || "";
    if (!displayName && !email) {
      setStatus(els.tripInviteAcceptStatus, "표시 이름 또는 이메일을 입력해 주세요.", "warning");
      return;
    }

    const account = getSessionAccount() || saveLocalAccount({ email, displayName });
    try {
      if (pendingInviteRecord.source === "login_required") {
        setAuthGateMode("login");
        fillAuthEmailFromAccount(account);
        authStatusOverride = {
          message: "초대 수락은 로그인 후 가능합니다. 이메일과 비밀번호로 로그인해 주세요.",
          tone: "neutral",
        };
        renderAuthGate();
        setStatus(els.tripInviteAcceptStatus, "먼저 로그인한 뒤 같은 초대 링크에서 수락하세요.", "neutral");
        return;
      }
      if (pendingInviteRecord.source === "supabase") {
        await acceptSupabaseInvite(account);
      } else {
        acceptLocalInvite(account);
      }
      setStatus(els.tripInviteAcceptStatus, "초대를 수락했습니다. 현재 여행 인원에 추가되었습니다.", "success");
      clearInviteParams();
      window.setTimeout(closeInviteAcceptModal, 650);
    } catch (error) {
      setStatus(els.tripInviteAcceptStatus, error.message, "warning");
    }
  }

  function clearInviteParams() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(INVITE_PARAM)) return;
    url.searchParams.delete(INVITE_PARAM);
    url.searchParams.delete("trip");
    window.history.replaceState({}, document.title, url.toString());
  }

  function formatInviteDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  }

  function checkInitialInviteParam() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get(INVITE_PARAM) || params.get("tripInvite");
    if (token) openInviteAcceptModal(token);
  }

  function setupTripCollaboration() {
    if (setupComplete) return;
    setupComplete = true;

    els.headerTripInviteButton?.addEventListener("click", openTripInviteModal);
    els.tripInviteCloseButton?.addEventListener("click", closeTripInviteModal);
    els.tripInviteModal?.addEventListener("click", (event) => {
      if (event.target === els.tripInviteModal) closeTripInviteModal();
    });
    els.tripInviteCopyButton?.addEventListener("click", copyInviteLink);
    els.tripInviteRefreshButton?.addEventListener("click", () => createTripInvite({ forceNew: true }));

    els.authModeLogin?.addEventListener("click", () => setAuthGateMode("login"));
    els.authModeSignup?.addEventListener("click", () => setAuthGateMode("signup"));
    els.authGateForm?.addEventListener("submit", handleAuthGateSubmit);
    els.authGateForgotButton?.addEventListener("click", requestPasswordReset);
    els.authGateResetSupabaseButton?.addEventListener("click", resetAuthSupabaseConfig);

    els.settingsMagicLinkButton?.addEventListener("click", sendMagicLink);
    els.settingsLocalLoginButton?.addEventListener("click", saveProfileFromSettings);
    els.settingsLogoutButton?.addEventListener("click", logoutTripAccount);
    els.settingsSupabaseSaveButton?.addEventListener("click", handleSupabaseSave);
    els.settingsSupabaseClearButton?.addEventListener("click", handleSupabaseClear);

    els.privacyShareItineraryInput?.addEventListener("change", (event) => updatePrivacySetting("shareItinerary", event.target.checked));
    els.privacyShareExpensesInput?.addEventListener("change", (event) => updatePrivacySetting("shareExpenses", event.target.checked));
    els.privacyShowEmailInput?.addEventListener("change", (event) => updatePrivacySetting("showMemberEmail", event.target.checked));
    els.privacyAllowInviteInput?.addEventListener("change", (event) => updatePrivacySetting("allowInviteRequests", event.target.checked));

    els.tripInviteAcceptCloseButton?.addEventListener("click", closeInviteAcceptModal);
    els.tripInviteAcceptModal?.addEventListener("click", (event) => {
      if (event.target === els.tripInviteAcceptModal) closeInviteAcceptModal();
    });
    els.tripInviteAcceptForm?.addEventListener("submit", acceptPendingInvite);

    syncSupabaseSession();
    checkInitialInviteParam();
    renderTripCollaboration();
  }

  window.TripLog.register("features.collaboration.tripCollaboration", {
    setupTripCollaboration,
    renderTripCollaboration,
    getTripMembers,
    createTripInvite,
    syncSupabaseSession,
  });
})();
