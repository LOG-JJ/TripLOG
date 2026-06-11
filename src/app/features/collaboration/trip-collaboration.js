(function createTripCollaborationModule() {
  const ACCOUNT_STORAGE_KEY = "domesticTravelExpensePlanner.account.v1";
  const INVITES_STORAGE_KEY = "domesticTravelExpensePlanner.invites.v1";
  const SUPABASE_CONFIG_STORAGE_KEY = "domesticTravelExpensePlanner.supabaseConfig.v1";
  const AUTH_PENDING_EMAIL_KEY = "domesticTravelExpensePlanner.authPendingEmail.v1";
  const SUPABASE_CDN_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.107.0/dist/umd/supabase.min.js";
  const DEFAULT_SUPABASE_CONFIG = {
    url: "https://iehdziiplzgvxcrbizgv.supabase.co",
    publishableKey: "sb_publishable_b5CwF1zyb5bzNHUT50xNsg_pSon5Glc",
  };
  const INVITE_PARAM = "invite";
  const INVITE_EXPIRES_DAYS = 14;
  const AUTH_PASSWORD_MIN_LENGTH = 8;
  const MEMBER_SYNC_INTERVAL_MS = 15000;

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
  let memberSyncIntervalId = null;
  let memberSyncInFlight = false;
  let tripStateSyncInFlight = false;
  let tripStateUploadInFlight = false;
  let tripStateUploadPromise = null;
  let applyingRemoteTripState = false;
  let tripStateHasLocalChanges = false;
  let tripListSyncInFlight = false;
  let initialTripListSyncComplete = false;
  let lastTripStateUpdatedAt = "";
  let lastTripStateSignature = "";
  let headerSyncStatusTimer = null;
  let manualSyncInFlight = false;

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
    initialTripListSyncComplete = false;
    supabaseStatusOverride = null;
    stopSupabaseMembersSync();
    stopSupabaseTripStateSync();
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
        flowType: "implicit",
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

  function getEmailDisplayFallback(email) {
    return String(email || "").split("@")[0] || "나";
  }

  function isCustomDisplayName(name, email) {
    const normalizedName = String(name || "").trim();
    if (!normalizedName) return false;
    return normalizedName.toLowerCase() !== getEmailDisplayFallback(email).toLowerCase();
  }

  function getSessionAccount() {
    const user = currentSession?.user;
    if (!user) return null;
    const metadata = user.user_metadata || {};
    const email = user.email || "";
    const storedAccount = getStoredAccount();
    const storedName = storedAccount?.email === email && isCustomDisplayName(storedAccount.displayName, email)
      ? storedAccount.displayName
      : "";
    const metadataName = metadata.full_name || metadata.display_name || metadata.name || "";
    return {
      id: user.id,
      email,
      displayName: storedName || metadataName || getEmailDisplayFallback(email),
      provider: "supabase",
    };
  }

  function getCurrentAccount() {
    return getSessionAccount() || getStoredAccount();
  }

  function saveStoredAccount(account) {
    const normalizedEmail = String(account?.email || "").trim();
    const normalizedName = String(account?.displayName || "").trim() || getEmailDisplayFallback(normalizedEmail);
    const previous = getStoredAccount();
    const savedAccount = {
      id: account?.id || previous?.id || `local_${Date.now()}`,
      email: normalizedEmail,
      displayName: normalizedName,
      provider: account?.provider || "local",
    };
    writeJsonStorage(ACCOUNT_STORAGE_KEY, savedAccount);
    applyOwnerAccount(savedAccount);
    return savedAccount;
  }

  function saveLocalAccount({ email, displayName }) {
    const normalizedEmail = String(email || "").trim();
    const normalizedName = String(displayName || "").trim() || getEmailDisplayFallback(normalizedEmail);
    return saveStoredAccount({
      email: normalizedEmail,
      displayName: normalizedName,
      provider: "local",
    });
  }

  function clearLocalAccount() {
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
  }

  function getPendingAuthEmail() {
    return String(localStorage.getItem(AUTH_PENDING_EMAIL_KEY) || "").trim();
  }

  function setPendingAuthEmail(email) {
    const normalizedEmail = String(email || "").trim();
    if (normalizedEmail) localStorage.setItem(AUTH_PENDING_EMAIL_KEY, normalizedEmail);
  }

  function clearPendingAuthEmail() {
    localStorage.removeItem(AUTH_PENDING_EMAIL_KEY);
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
      stopSupabaseMembersSync();
      stopSupabaseTripStateSync();
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
            initialTripListSyncComplete = false;
            stopSupabaseMembersSync();
            stopSupabaseTripStateSync();
          }
          const account = getSessionAccount();
          if (account) {
            applyOwnerAccount(account);
            syncSupabaseTripList({ render: true, quiet: true })
              .then(() => syncSupabaseTripMembers({ render: true, quiet: true }))
              .finally(() => {
                startSupabaseMembersSync();
                updateHeaderSyncButton();
              });
          }
          renderTripCollaboration();
          if (event === "SIGNED_IN") refreshInviteAfterAuth();
        });
        authListenerAttached = true;
      }

      await consumeAuthCallback(client);

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
      if (sessionAccount) {
        applyOwnerAccount(sessionAccount);
        await syncSupabaseTripList({ render: true, quiet: true });
        await syncSupabaseTripMembers({ quiet: true });
        startSupabaseMembersSync();
        updateHeaderSyncButton();
      } else {
        initialTripListSyncComplete = false;
        stopSupabaseMembersSync();
        stopSupabaseTripStateSync();
      }
    } catch (error) {
      currentSession = null;
      stopSupabaseMembersSync();
      stopSupabaseTripStateSync();
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
      refreshInviteAfterAuth();
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

  function normalizeSupabaseMember(row) {
    return {
      id: row.user_id,
      name: row.display_name || getEmailDisplayFallback(row.email),
      email: row.email || "",
      role: row.role || "member",
      status: row.status || "accepted",
      joinedAt: row.joined_at || "",
      source: "supabase",
    };
  }

  function mergeSupabaseMembers(rows) {
    const collaboration = getCollaboration();
    const previousSnapshot = JSON.stringify({
      ownerId: collaboration.ownerId,
      ownerName: collaboration.ownerName,
      ownerEmail: collaboration.ownerEmail,
      members: collaboration.members || [],
    });

    const acceptedRows = (rows || []).filter((row) => row.status === "accepted");
    const ownerRow = acceptedRows.find((row) => row.role === "owner");
    if (ownerRow) {
      collaboration.ownerId = ownerRow.user_id || collaboration.ownerId;
      collaboration.ownerName = ownerRow.display_name || collaboration.ownerName || "나";
      collaboration.ownerEmail = ownerRow.email || collaboration.ownerEmail || "";
    }

    const remoteMembers = acceptedRows
      .filter((row) => row.role !== "owner")
      .map(normalizeSupabaseMember);
    const remoteKeys = new Set(remoteMembers.map((member) => getMemberKey(member)));
    const localMembers = Array.isArray(collaboration.members) ? collaboration.members : [];
    const preservedMembers = localMembers.filter((member) => {
      const key = getMemberKey(member);
      return member.source !== "supabase" && !remoteKeys.has(key);
    });
    collaboration.members = [...preservedMembers, ...remoteMembers];

    const nextSnapshot = JSON.stringify({
      ownerId: collaboration.ownerId,
      ownerName: collaboration.ownerName,
      ownerEmail: collaboration.ownerEmail,
      members: collaboration.members || [],
    });
    return previousSnapshot !== nextSnapshot;
  }

  async function syncSupabaseTripMembers({ render = false, quiet = true } = {}) {
    if (!hasSupabaseConfig() || !isSignedIn() || memberSyncInFlight) return false;
    memberSyncInFlight = true;
    try {
      const client = await getSupabaseClient();
      const { data: tripRow, error: tripError } = await client
        .from("triplog_trips")
        .select("id")
        .eq("app_trip_id", state.id)
        .maybeSingle();
      if (tripError) throw tripError;
      if (!tripRow?.id) return false;

      const { data: memberRows, error: membersError } = await client
        .from("triplog_trip_members")
        .select("user_id, email, display_name, role, status, joined_at")
        .eq("trip_id", tripRow.id)
        .order("joined_at", { ascending: true });
      if (membersError) throw membersError;

      const changed = mergeSupabaseMembers(memberRows || []);
      if (changed) {
        const wasApplyingRemoteTripState = applyingRemoteTripState;
        applyingRemoteTripState = true;
        saveStateSilently();
        applyingRemoteTripState = wasApplyingRemoteTripState;
      }
      if (render && changed) renderTripCollaboration();
      return changed;
    } catch (error) {
      if (!quiet) {
        supabaseStatusOverride = {
          message: `멤버 동기화 실패: ${error.message}`,
          tone: "warning",
        };
        if (render) renderTripCollaboration();
      }
      return false;
    } finally {
      memberSyncInFlight = false;
    }
  }

  function startSupabaseMembersSync() {
    if (memberSyncIntervalId || !isSignedIn()) return;
    memberSyncIntervalId = window.setInterval(() => {
      syncSupabaseTripMembers({ render: true, quiet: true });
    }, MEMBER_SYNC_INTERVAL_MS);
  }

  function stopSupabaseMembersSync() {
    if (!memberSyncIntervalId) return;
    window.clearInterval(memberSyncIntervalId);
    memberSyncIntervalId = null;
  }

  function getTripStateSignature(snapshot) {
    try {
      return JSON.stringify(snapshot || {});
    } catch {
      return "";
    }
  }

  function delay(ms = 0) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function getRemoteSafeSnapshot(remoteSnapshot = {}) {
    const snapshot = remoteSnapshot && typeof remoteSnapshot === "object" ? { ...remoteSnapshot } : {};
    const privacy = snapshot.collaboration?.privacy || getCollaboration().privacy || {};
    if (privacy.shareExpenses === false) snapshot.entries = state.entries;
    if (privacy.shareItinerary === false) snapshot.itineraryItems = state.itineraryItems;
    return snapshot;
  }

  function getRemoteTripSnapshot(row = {}) {
    const remoteState = row.travel_state && typeof row.travel_state === "object" ? row.travel_state : {};
    const fallbackId = typeof row.app_trip_id === "string" && row.app_trip_id ? row.app_trip_id : `trip_remote_${row.id || Date.now()}`;
    return {
      ...remoteState,
      id: typeof remoteState.id === "string" && remoteState.id ? remoteState.id : fallbackId,
      tripName: remoteState.tripName || row.trip_name || "현재 여행",
      startDate: remoteState.startDate || row.start_date || "",
      endDate: remoteState.endDate || row.end_date || "",
    };
  }

  function getRemoteTripSnapshotId(row = {}) {
    return getRemoteTripSnapshot(row).id;
  }

  async function syncSupabaseTripList({ render: shouldRender = false, quiet = true } = {}) {
    if (!hasSupabaseConfig() || !isSignedIn() || tripListSyncInFlight) return false;
    tripListSyncInFlight = true;
    try {
      const client = await getSupabaseClient();
      const { data: rows, error } = await client
        .from("triplog_trips")
        .select("id, app_trip_id, trip_name, start_date, end_date, travel_state, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const remoteRows = Array.isArray(rows) ? rows : [];
      initialTripListSyncComplete = true;
      if (!remoteRows.length) return false;

      const remoteSnapshots = remoteRows.map(getRemoteTripSnapshot);
      const preserveActiveLocalChanges = Boolean(lastTripStateSignature)
        && tripStateHasLocalChanges
        && remoteSnapshots.some((snapshot) => snapshot.id === state.id);
      const mergedSnapshots = preserveActiveLocalChanges
        ? remoteSnapshots.map((snapshot) => snapshot.id === state.id ? getStateSnapshot() : snapshot)
        : remoteSnapshots;
      const hasCurrentTrip = remoteSnapshots.some((snapshot) => snapshot.id === state.id);
      const preferredActiveId = hasCurrentTrip ? state.id : remoteSnapshots[0]?.id || state.id;
      const previousApplyingRemoteTripState = applyingRemoteTripState;
      applyingRemoteTripState = true;
      let result;
      try {
        result = window.TripLog.persistence.stateStorage.syncTripsFromSnapshots(mergedSnapshots, {
          preferredActiveId,
          removeEmptyDefault: true,
        });
      } finally {
        applyingRemoteTripState = previousApplyingRemoteTripState;
      }

      const activeRemoteRow = remoteRows.find((row) => getRemoteTripSnapshotId(row) === state.id);
      if (!preserveActiveLocalChanges && activeRemoteRow?.travel_state && typeof activeRemoteRow.travel_state === "object") {
        lastTripStateUpdatedAt = activeRemoteRow.updated_at || lastTripStateUpdatedAt;
        lastTripStateSignature = getTripStateSignature(getRemoteSafeSnapshot(activeRemoteRow.travel_state));
        tripStateHasLocalChanges = false;
      }
      if (shouldRender && result?.changed) render();
      updateHeaderSyncButton();
      return result?.changed || false;
    } catch (error) {
      initialTripListSyncComplete = false;
      if (!quiet) {
        supabaseStatusOverride = {
          message: `여행 목록 동기화 실패: ${error.message}`,
          tone: "warning",
        };
        if (shouldRender) renderTripCollaboration();
        throw error;
      }
      return false;
    } finally {
      tripListSyncInFlight = false;
    }
  }

  async function upsertSupabaseOwnerMember(client, tripId, account) {
    if (!tripId || !account?.id) return;
    const { error } = await client.from("triplog_trip_members").upsert({
      trip_id: tripId,
      user_id: account.id,
      email: account.email,
      display_name: account.displayName || getEmailDisplayFallback(account.email),
      role: "owner",
      status: "accepted",
      joined_at: new Date().toISOString(),
    }, { onConflict: "trip_id,user_id" });
    if (error) throw error;
  }

  function isSupabaseTripOwner(tripRow, account) {
    return Boolean(tripRow?.owner_id && account?.id && tripRow.owner_id === account.id);
  }

  function canCreateSupabaseTripRow(account) {
    const collaboration = getCollaboration();
    return !collaboration.ownerId
      || collaboration.ownerId === account?.id
      || collaboration.ownerId.startsWith("local_")
      || (collaboration.ownerEmail && collaboration.ownerEmail === account?.email);
  }

  async function ensureSupabaseTripRow(client, account) {
    const { data: tripRow, error: tripError } = await client
      .from("triplog_trips")
      .select("id, owner_id, updated_at, travel_state")
      .eq("app_trip_id", state.id)
      .maybeSingle();
    if (tripError) throw tripError;
    if (tripRow?.id) {
      if (isSupabaseTripOwner(tripRow, account)) {
        await upsertSupabaseOwnerMember(client, tripRow.id, account);
      }
      return tripRow;
    }

    if (!canCreateSupabaseTripRow(account)) {
      throw new Error("공유 여행의 서버 기록을 찾지 못했습니다. 초대 링크를 다시 수락하거나 새로고침 후 동기화해 주세요.");
    }

    const snapshot = buildSharedTripSnapshot();
    const { data: createdTrip, error: createError } = await client
      .from("triplog_trips")
      .insert({
        app_trip_id: state.id,
        owner_id: account.id,
        trip_name: state.tripName || "현재 여행",
        start_date: state.startDate || null,
        end_date: state.endDate || null,
        travel_state: snapshot,
        privacy: getCollaboration().privacy,
        updated_at: new Date().toISOString(),
      })
      .select("id, owner_id, updated_at, travel_state")
      .single();
    if (createError) throw createError;
    await upsertSupabaseOwnerMember(client, createdTrip.id, account);
    return createdTrip;
  }

  async function uploadSupabaseTripState({ quiet = true, force = false } = {}) {
    if (!hasSupabaseConfig() || !isSignedIn() || applyingRemoteTripState) return false;
    if (tripStateUploadInFlight) return tripStateUploadPromise || false;
    const account = getSessionAccount();
    if (!account) return false;

    const snapshot = buildSharedTripSnapshot();
    const signature = getTripStateSignature(snapshot);
    if (signature && signature === lastTripStateSignature) {
      tripStateHasLocalChanges = false;
      return false;
    }

    tripStateUploadInFlight = true;
    tripStateUploadPromise = (async () => {
      const client = await getSupabaseClient();
      const tripRow = await ensureSupabaseTripRow(client, account);
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("triplog_trips")
        .update({
          trip_name: state.tripName || "현재 여행",
          start_date: state.startDate || null,
          end_date: state.endDate || null,
          travel_state: snapshot,
          privacy: getCollaboration().privacy,
          updated_at: now,
        })
        .eq("id", tripRow.id)
        .select("updated_at, travel_state")
        .single();
      if (error) throw error;

      lastTripStateUpdatedAt = data?.updated_at || now;
      lastTripStateSignature = signature;
      tripStateHasLocalChanges = false;
      return true;
    })();

    try {
      return await tripStateUploadPromise;
    } catch (error) {
      if (!quiet) {
        supabaseStatusOverride = {
          message: `여행 동기화 업로드 실패: ${error.message}`,
          tone: "warning",
        };
        renderTripCollaboration();
        throw error;
      }
      return false;
    } finally {
      tripStateUploadInFlight = false;
      tripStateUploadPromise = null;
    }
  }

  async function syncSupabaseTripState({ render: shouldRender = false, quiet = true, force = false } = {}) {
    if (!hasSupabaseConfig() || !isSignedIn() || applyingRemoteTripState || tripStateSyncInFlight) return false;
    tripStateSyncInFlight = true;
    try {
      const client = await getSupabaseClient();
      const { data: tripRow, error } = await client
        .from("triplog_trips")
        .select("id, app_trip_id, travel_state, updated_at")
        .eq("app_trip_id", state.id)
        .maybeSingle();
      if (error) throw error;
      if (!tripRow?.travel_state || typeof tripRow.travel_state !== "object") return false;

      const remoteSnapshot = getRemoteSafeSnapshot(tripRow.travel_state);
      const remoteSignature = getTripStateSignature(remoteSnapshot);
      const localSignature = getTripStateSignature(getStateSnapshot());
      if (!remoteSignature || remoteSignature === localSignature) {
        lastTripStateUpdatedAt = tripRow.updated_at || lastTripStateUpdatedAt;
        lastTripStateSignature = remoteSignature || lastTripStateSignature;
        if (remoteSignature === localSignature) tripStateHasLocalChanges = false;
        return false;
      }
      if (!force && remoteSignature === lastTripStateSignature) {
        lastTripStateUpdatedAt = tripRow.updated_at || lastTripStateUpdatedAt;
        lastTripStateSignature = remoteSignature || lastTripStateSignature;
        return false;
      }

      if (!force && tripStateHasLocalChanges) return false;

      applyingRemoteTripState = true;
      const selectedDate = state.selectedDate;
      const selectedItineraryDate = state.selectedItineraryDate;
      const lastActiveItineraryDate = state.lastActiveItineraryDate;
      window.TripLog.persistence.stateStorage.importSharedTripSnapshot(remoteSnapshot, { makeActive: true });
      state.selectedDate = selectedDate || state.startDate;
      state.selectedItineraryDate = selectedItineraryDate || state.startDate;
      state.lastActiveItineraryDate = lastActiveItineraryDate || state.startDate;
      await syncSupabaseTripMembers({ quiet: true });
      saveStateSilently();
      if (shouldRender) render();

      lastTripStateUpdatedAt = tripRow.updated_at || "";
      lastTripStateSignature = remoteSignature;
      tripStateHasLocalChanges = false;
      return true;
    } catch (error) {
      if (!quiet) {
        supabaseStatusOverride = {
          message: `여행 동기화 다운로드 실패: ${error.message}`,
          tone: "warning",
        };
        if (shouldRender) renderTripCollaboration();
        throw error;
      }
      return false;
    } finally {
      applyingRemoteTripState = false;
      tripStateSyncInFlight = false;
    }
  }

  function stopSupabaseTripStateSync() {
    tripStateSyncInFlight = false;
    tripStateUploadInFlight = false;
    tripStateHasLocalChanges = false;
    updateHeaderSyncButton();
  }

  function updateHeaderSyncButton({ message = "", tone = "", transient = false } = {}) {
    const button = els.itineraryPageButton;
    if (!button) return;
    if (manualSyncInFlight && !message && !tone && !transient) return;

    window.clearTimeout(headerSyncStatusTimer);
    headerSyncStatusTimer = null;

    const nextTone = tone || (tripStateHasLocalChanges ? "dirty" : "idle");
    const nextMessage = message || (tripStateHasLocalChanges ? "변경사항 동기화" : "여행 동기화");
    button.classList.remove("is-dirty", "is-syncing", "is-synced", "is-warning");
    if (nextTone === "dirty") button.classList.add("is-dirty");
    if (nextTone === "syncing") button.classList.add("is-syncing");
    if (nextTone === "success") button.classList.add("is-synced");
    if (nextTone === "warning") button.classList.add("is-warning");
    button.title = nextMessage;
    button.setAttribute("aria-label", nextMessage);

    if (transient) {
      headerSyncStatusTimer = window.setTimeout(() => updateHeaderSyncButton(), 1800);
    }
  }

  function showSyncToast(message, tone = "success") {
    let toast = document.querySelector(".trip-sync-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "trip-sync-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");

    if (toast.timeoutId) window.clearTimeout(toast.timeoutId);
    toast.timeoutId = window.setTimeout(() => {
      toast.classList.remove("show");
    }, tone === "warning" ? 3200 : 2400);
  }

  async function manualSyncSupabaseTripState() {
    if (!hasSupabaseConfig() || !isSignedIn()) {
      updateHeaderSyncButton({
        message: "로그인 후 동기화 가능",
        tone: "warning",
        transient: true,
      });
      showSyncToast("로그인 후 여행 동기화를 사용할 수 있습니다.", "warning");
      setAuthGateMode("login");
      renderAuthGate();
      return false;
    }

    updateHeaderSyncButton({
      message: "여행 동기화 중",
      tone: "syncing",
    });

    const syncStartedAt = Date.now();
    manualSyncInFlight = true;

    try {
      let uploaded = false;
      let downloaded = false;
      if (tripStateHasLocalChanges) {
        uploaded = await uploadSupabaseTripState({ quiet: false, force: true });
        if (tripStateHasLocalChanges && !uploaded) {
          throw new Error("변경사항 업로드가 완료되지 않았습니다.");
        }
        await syncSupabaseTripList({ render: true, quiet: false });
      } else {
        downloaded = await syncSupabaseTripState({ render: true, quiet: false, force: true });
        const listChanged = await syncSupabaseTripList({ render: true, quiet: false });
        downloaded = downloaded || listChanged;
      }
      await syncSupabaseTripMembers({ render: true, quiet: true });
      if (uploaded || downloaded) tripStateHasLocalChanges = false;

      const elapsed = Date.now() - syncStartedAt;
      if (elapsed < 650) await delay(650 - elapsed);

      const message = downloaded
        ? "서버 최신 여행을 불러왔습니다"
        : uploaded
          ? "내 변경사항을 저장했습니다"
          : "이미 최신 상태입니다";
      manualSyncInFlight = false;
      updateHeaderSyncButton({ message, tone: "success", transient: true });
      showSyncToast("동기화 완료", "success");
      return uploaded || downloaded;
    } catch (error) {
      manualSyncInFlight = false;
      updateHeaderSyncButton({
        message: "동기화 실패",
        tone: "warning",
        transient: true,
      });
      showSyncToast(`동기화 실패 · ${error.message}`, "warning");
      return false;
    }
  }

  function handleTripStateSaved() {
    if (applyingRemoteTripState) return;
    tripStateHasLocalChanges = true;
    updateHeaderSyncButton();
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

  function getAuthCallbackParams() {
    const hashParams = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const read = (name) => queryParams.get(name) || hashParams.get(name) || "";
    const params = {
      accessToken: read("access_token"),
      code: read("code"),
      error: read("error"),
      errorCode: read("error_code"),
      errorDescription: read("error_description"),
      refreshToken: read("refresh_token"),
      tokenHash: read("token_hash"),
      type: read("type"),
    };
    params.hasCallback = Boolean(
      params.accessToken
      || params.code
      || params.error
      || params.errorCode
      || params.errorDescription
      || params.tokenHash
    );
    return params;
  }

  function cleanAuthCallbackUrl() {
    const url = new URL(window.location.href);
    [
      "access_token",
      "code",
      "error",
      "error_code",
      "error_description",
      "expires_at",
      "expires_in",
      "next",
      "refresh_token",
      "token_hash",
      "token_type",
      "type",
    ].forEach((key) => url.searchParams.delete(key));
    if (url.pathname.startsWith("/auth/")) url.pathname = "/Travel.html";
    if (!url.searchParams.has("page") && !url.searchParams.has(INVITE_PARAM)) {
      url.searchParams.set("page", "settings");
    }
    url.hash = "";
    window.history.replaceState({}, document.title, url.toString());
  }

  async function consumeAuthCallback(client) {
    const params = getAuthCallbackParams();
    if (!params.hasCallback) return false;

    try {
      setAuthGateBusy(true);
      if (params.error || params.errorDescription || params.errorCode) {
        throw new Error(params.errorDescription || params.error || params.errorCode);
      }

      let session = null;
      if (params.accessToken && params.refreshToken) {
        const { data, error } = await client.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
        });
        if (error) throw error;
        session = data.session || null;
      } else if (params.code) {
        const { data, error } = await client.auth.exchangeCodeForSession(params.code);
        if (error) throw error;
        session = data.session || null;
      } else if (params.tokenHash && params.type) {
        const { data, error } = await client.auth.verifyOtp({
          token_hash: params.tokenHash,
          type: params.type,
        });
        if (error) throw error;
        session = data.session || null;
      }

      if (session) currentSession = session;
      if (params.type === "recovery" || params.type === "password_recovery") {
        passwordRecoveryRequested = true;
        authGateMode = "recovery";
        authStatusOverride = {
          message: "복구 링크가 확인되었습니다. 새 비밀번호를 입력해 주세요.",
          tone: "success",
        };
      } else if (session) {
        passwordRecoveryRequested = false;
        authGateMode = "login";
        authStatusOverride = null;
        clearPendingAuthEmail();
        const account = getSessionAccount();
        if (account) applyOwnerAccount(account);
      } else {
        authGateMode = "login";
        authStatusOverride = {
          message: "이메일 확인은 완료되었습니다. 같은 이메일과 비밀번호로 로그인해 주세요.",
          tone: "success",
        };
      }
      return true;
    } catch (error) {
      currentSession = null;
      authGateMode = "login";
      authStatusOverride = {
        message: `인증 링크 처리 실패: ${getFriendlyAuthError(error)} 다시 로그인해 주세요.`,
        tone: "warning",
      };
      return false;
    } finally {
      cleanAuthCallbackUrl();
      setAuthGateBusy(false);
    }
  }

  function isSignedIn() {
    return Boolean(currentSession?.user);
  }

  function getInviteTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get(INVITE_PARAM) || params.get("tripInvite") || "";
  }

  function shouldRefreshInviteAfterAuth(token) {
    if (!token || !isSignedIn()) return false;
    if (!pendingInviteRecord) return true;
    if (pendingInviteRecord.token !== token) return true;
    return ["login_required", "missing", "error", "loading"].includes(pendingInviteRecord.source);
  }

  function refreshInviteAfterAuth() {
    const token = getInviteTokenFromUrl();
    if (shouldRefreshInviteAfterAuth(token)) openInviteAcceptModal(token);
  }

  function setAuthStatus(message, tone = "neutral") {
    setStatus(els.authGateStatus, message, tone);
  }

  function getFriendlyAuthError(error) {
    const message = String(error?.message || "인증에 실패했습니다.");
    const normalized = message.toLowerCase();
    if (normalized.includes("email rate limit exceeded") || normalized.includes("over_email_send_rate_limit")) {
      return "확인 이메일 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요. 이미 가입했다면 회원가입이 아니라 로그인으로 들어가 주세요.";
    }
    if (normalized.includes("email link is invalid or has expired") || normalized.includes("one-time token")) {
      return "확인 링크가 만료되었거나 이미 사용되었습니다.";
    }
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
    if (account) {
      setInputValue(els.authGateNameInput, account.displayName);
      setInputValue(els.authGateEmailInput, account.email);
      return;
    }
    const pendingEmail = getPendingAuthEmail();
    if (pendingEmail) setInputValue(els.authGateEmailInput, pendingEmail);
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
        setPendingAuthEmail(email);
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
          clearPendingAuthEmail();
          applyOwnerAccount(getSessionAccount());
          await syncSupabaseTripList({ render: true, quiet: true });
          await syncSupabaseTripMembers({ quiet: true });
          startSupabaseMembersSync();
          updateHeaderSyncButton();
          authStatusOverride = null;
          renderTripCollaboration();
        } else {
          authStatusOverride = {
            message: "가입 확인 이메일을 보냈습니다. 확인 후 자동으로 돌아오지 않으면 같은 이메일과 비밀번호로 로그인해 주세요.",
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
      clearPendingAuthEmail();
      const account = getSessionAccount();
      if (account) applyOwnerAccount(account);
      await syncSupabaseTripList({ render: true, quiet: true });
      await syncSupabaseTripMembers({ quiet: true });
      startSupabaseMembersSync();
      updateHeaderSyncButton();
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
    const cleanPath = window.location.pathname.endsWith(".html") ? window.location.pathname : "/Travel";
    const url = new URL(cleanPath, window.location.origin);
    url.searchParams.set(INVITE_PARAM, token);
    url.searchParams.set("trip", state.id || "");
    url.searchParams.set("page", "start");
    return url.toString();
  }

  function buildAuthRedirectUrl() {
    const url = new URL(window.location.href);
    [
      "access_token",
      "code",
      "error",
      "error_code",
      "error_description",
      "expires_at",
      "expires_in",
      "next",
      "refresh_token",
      "token_hash",
      "token_type",
      "type",
    ].forEach((key) => url.searchParams.delete(key));
    if (url.pathname.startsWith("/auth/")) url.pathname = "/Travel.html";
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

  function buildSharedTripSnapshot(sourceState = state) {
    const snapshot = JSON.parse(JSON.stringify(sourceState || state));
    const privacy = window.TripLog.persistence.stateStorage
      .normalizeCollaborationSettings(snapshot.collaboration)
      .privacy;
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
    const tripRow = await ensureSupabaseTripRow(client, sessionAccount);
    const { error: tripUpdateError } = await client
      .from("triplog_trips")
      .update({
        trip_name: state.tripName || "현재 여행",
        start_date: state.startDate || null,
        end_date: state.endDate || null,
        travel_state: snapshot,
        privacy: collaboration.privacy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripRow.id);

    if (tripUpdateError) throw tripUpdateError;

    const { error: memberError } = await client.from("triplog_trip_members").upsert({
      trip_id: tripRow.id,
      user_id: sessionAccount.id,
      email: sessionAccount.email,
      display_name: sessionAccount.displayName,
      role: "owner",
      status: "accepted",
      joined_at: new Date().toISOString(),
    }, { onConflict: "trip_id,user_id" });
    if (memberError) throw memberError;

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

  async function updateCurrentSupabaseMemberProfile(account) {
    if (!account?.id || !hasSupabaseConfig()) return;
    const client = await getSupabaseClient();
    const { data: tripRow, error: tripError } = await client
      .from("triplog_trips")
      .select("id")
      .eq("app_trip_id", state.id)
      .maybeSingle();
    if (tripError) throw tripError;
    if (!tripRow?.id) return;

    const { error: memberError } = await client
      .from("triplog_trip_members")
      .update({
        email: account.email,
        display_name: account.displayName,
      })
      .eq("trip_id", tripRow.id)
      .eq("user_id", account.id);
    if (memberError) throw memberError;
  }

  async function saveProfileFromSettings() {
    const email = els.settingsAccountEmailInput?.value.trim();
    const displayName = els.settingsAccountNameInput?.value.trim();
    if (!displayName && !email) {
      setText(els.settingsAccountStatus, "표시 이름 또는 이메일을 입력해 주세요.");
      return;
    }

    try {
      const sessionAccount = getSessionAccount();
      if (sessionAccount && hasSupabaseConfig()) {
        const nextName = displayName || sessionAccount.displayName || getEmailDisplayFallback(sessionAccount.email);
        const client = await getSupabaseClient();
        const { data, error } = await client.auth.updateUser({
          data: {
            display_name: nextName,
            full_name: nextName,
            name: nextName,
          },
        });
        if (error) throw error;
        if (data?.user) currentSession = { ...currentSession, user: data.user };

        const nextAccount = getSessionAccount();
        saveStoredAccount(nextAccount);
        await updateCurrentSupabaseMemberProfile(nextAccount);
        await syncSupabaseTripMembers({ quiet: true });
        renderTripCollaboration();
        setText(els.settingsAccountStatus, "Supabase 프로필을 저장했습니다.");
        return;
      }

      saveLocalAccount({ email, displayName });
      renderTripCollaboration();
      setText(els.settingsAccountStatus, "이 기기 프로필을 저장했습니다.");
    } catch (error) {
      setText(els.settingsAccountStatus, `프로필 저장 실패: ${error.message}`);
    }
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
    initialTripListSyncComplete = false;
    stopSupabaseMembersSync();
    stopSupabaseTripStateSync();
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

    if (!isSignedIn()) {
      return { token, tripName: "로그인 후 초대 확인", source: "login_required" };
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
    saveStoredAccount(account);
    addAcceptedMemberToState(account);
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

    const sessionAccount = getSessionAccount();
    const account = sessionAccount
      ? {
        ...sessionAccount,
        displayName: displayName || sessionAccount.displayName,
        email: sessionAccount.email || email,
      }
      : saveLocalAccount({ email, displayName });
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
        await syncSupabaseTripMembers({ quiet: true });
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
    const token = getInviteTokenFromUrl();
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
    els.itineraryPageButton?.addEventListener("click", manualSyncSupabaseTripState);

    els.privacyShareItineraryInput?.addEventListener("change", (event) => updatePrivacySetting("shareItinerary", event.target.checked));
    els.privacyShareExpensesInput?.addEventListener("change", (event) => updatePrivacySetting("shareExpenses", event.target.checked));
    els.privacyShowEmailInput?.addEventListener("change", (event) => updatePrivacySetting("showMemberEmail", event.target.checked));
    els.privacyAllowInviteInput?.addEventListener("change", (event) => updatePrivacySetting("allowInviteRequests", event.target.checked));

    els.tripInviteAcceptCloseButton?.addEventListener("click", closeInviteAcceptModal);
    els.tripInviteAcceptModal?.addEventListener("click", (event) => {
      if (event.target === els.tripInviteAcceptModal) closeInviteAcceptModal();
    });
    els.tripInviteAcceptForm?.addEventListener("submit", acceptPendingInvite);

    window.addEventListener("triplog:state-saved", handleTripStateSaved);
    updateHeaderSyncButton();

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
    syncSupabaseTripList,
    syncSupabaseTripState,
    uploadSupabaseTripState,
    manualSyncSupabaseTripState,
    showSyncToast,
  });
})();
