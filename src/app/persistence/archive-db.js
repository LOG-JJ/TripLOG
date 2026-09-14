const ARCHIVE_DB_NAME = "triplog-local-archive";
const ARCHIVE_DB_VERSION = 1;
const ARCHIVE_STORE_NAME = "travelSnapshots";
const ARCHIVE_SCHEMA_VERSION = 2;

let archiveDbPromise = null;

function isArchiveDbSupported() {
  return typeof indexedDB !== "undefined";
}

function openArchiveDb() {
  if (!isArchiveDbSupported()) return Promise.reject(new Error("IndexedDB를 사용할 수 없습니다."));
  if (archiveDbPromise) return archiveDbPromise;

  archiveDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(ARCHIVE_DB_NAME, ARCHIVE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ARCHIVE_STORE_NAME)) {
        const store = db.createObjectStore(ARCHIVE_STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("tripName", "tripName", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB 열기에 실패했습니다."));
  });

  return archiveDbPromise;
}

async function withArchiveStore(mode, callback) {
  const db = await openArchiveDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARCHIVE_STORE_NAME, mode);
    const store = tx.objectStore(ARCHIVE_STORE_NAME);
    const result = callback(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB 작업에 실패했습니다."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB 작업이 중단되었습니다."));
  });
}

function createArchiveId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `archive_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function cloneForArchive(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function createArchiveRecord(snapshot = getStateSnapshot(), source = "manual") {
  const archivedState = cloneForArchive(snapshot);
  const entries = Array.isArray(archivedState.entries) ? archivedState.entries : [];
  const itineraryItems = Array.isArray(archivedState.itineraryItems) ? archivedState.itineraryItems : [];
  const companions = Array.isArray(archivedState.companions) ? archivedState.companions : [];
  return {
    id: createArchiveId(),
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    source,
    timestamp: new Date().toISOString(),
    tripName: archivedState.tripName || getSnapshotDefaultTripName(archivedState),
    travelMode: archivedState.travelMode === "overseas" ? "overseas" : "domestic",
    country: archivedState.country || "",
    countryCode: archivedState.countryCode || "",
    city: archivedState.city || "",
    startDate: archivedState.startDate || "",
    endDate: archivedState.endDate || "",
    entryCount: entries.length,
    itineraryCount: itineraryItems.length,
    companionCount: companions.length,
    totalAmount: calculateSnapshotTotal(archivedState),
    state: archivedState,
  };
}

function normalizeArchiveRecord(record) {
  const stateSnapshot = record?.state && typeof record.state === "object" ? record.state : record;
  if (!stateSnapshot || typeof stateSnapshot !== "object") return null;
  const base = record?.state ? record : createArchiveRecord(stateSnapshot, "import");
  const normalizedState = cloneForArchive(stateSnapshot);
  return {
    ...base,
    id: String(base.id || createArchiveId()),
    schemaVersion: Number(base.schemaVersion || ARCHIVE_SCHEMA_VERSION),
    timestamp: base.timestamp || new Date().toISOString(),
    tripName: base.tripName || normalizedState.tripName || getSnapshotDefaultTripName(normalizedState),
    travelMode: normalizedState.travelMode === "overseas" ? "overseas" : "domestic",
    country: normalizedState.country || base.country || "",
    countryCode: normalizedState.countryCode || base.countryCode || "",
    city: normalizedState.city || base.city || "",
    startDate: normalizedState.startDate || base.startDate || "",
    endDate: normalizedState.endDate || base.endDate || "",
    entryCount: Array.isArray(normalizedState.entries) ? normalizedState.entries.length : 0,
    itineraryCount: Array.isArray(normalizedState.itineraryItems) ? normalizedState.itineraryItems.length : 0,
    companionCount: Array.isArray(normalizedState.companions) ? normalizedState.companions.length : 0,
    totalAmount: calculateSnapshotTotal(normalizedState),
    state: normalizedState,
  };
}

function sortArchiveRecords(records = []) {
  return [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function readLegacyArchiveMirror() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    return sortArchiveRecords(saved.map(normalizeArchiveRecord).filter(Boolean));
  } catch {
    return [];
  }
}

function writeLegacyArchiveMirror(records = []) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sortArchiveRecords(records)));
}

async function saveArchiveRecord(record) {
  const normalized = normalizeArchiveRecord(record);
  if (!normalized) throw new Error("저장할 기록이 올바르지 않습니다.");
  await withArchiveStore("readwrite", (store) => store.put(normalized));
  return normalized;
}

async function loadArchiveRecords() {
  if (!isArchiveDbSupported()) return readLegacyArchiveMirror();

  const records = await withArchiveStore("readonly", (store) => {
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("저장 기록을 읽지 못했습니다."));
    });
  });

  const normalized = sortArchiveRecords(records.map(normalizeArchiveRecord).filter(Boolean));
  if (normalized.length) return normalized;

  const legacyRecords = readLegacyArchiveMirror();
  if (legacyRecords.length) {
    await Promise.all(legacyRecords.map(saveArchiveRecord));
    return legacyRecords;
  }
  return [];
}

async function deleteArchiveRecord(id) {
  if (!id || !isArchiveDbSupported()) return;
  await withArchiveStore("readwrite", (store) => store.delete(id));
}

async function clearArchiveRecords() {
  if (isArchiveDbSupported()) {
    await withArchiveStore("readwrite", (store) => store.clear());
  }
  writeLegacyArchiveMirror([]);
}

function buildArchiveExportPayload(records = historyRecords) {
  return {
    app: "TripLOG",
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    storage: "IndexedDB + JSON backup",
    exportedAt: new Date().toISOString(),
    activeTripId: getActiveTripId(),
    trips: getTrips(),
    records: sortArchiveRecords(records.map(normalizeArchiveRecord).filter(Boolean)),
  };
}

function downloadArchiveJson(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  anchor.href = url;
  anchor.download = `triplog-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function extractArchiveRecordsFromPayload(payload) {
  if (!payload || typeof payload !== "object") return [];
  const records = Array.isArray(payload.records) ? [...payload.records]
    : Array.isArray(payload.historyRecords) ? [...payload.historyRecords]
    : payload.state && typeof payload.state === "object" ? [payload] : [];
  // A full backup also includes trips that have never been saved as snapshots.
  // Import them as reviewable records; loading a record explicitly restores it.
  if (Array.isArray(payload.trips)) {
    payload.trips.filter(trip => trip && typeof trip === "object" && typeof trip.id === "string" && trip.id).forEach(trip => {
      if (records.some(record => record?.state?.id === trip.id && JSON.stringify(record.state) === JSON.stringify(trip))) return;
      const record = createArchiveRecord(trip, "import-trip");
      record.id = `backup-trip:${trip.id}:${payload.exportedAt || "undated"}`;
      if (payload.exportedAt && Number.isFinite(Date.parse(payload.exportedAt))) record.timestamp = payload.exportedAt;
      records.push(record);
    });
  }
  return records;
}

async function importArchiveJsonFile(file) {
  if (!file) return [];
  const text = await file.text();
  const payload = JSON.parse(text);
  const records = extractArchiveRecordsFromPayload(payload).map(normalizeArchiveRecord).filter(Boolean);
  if (!records.length) throw new Error("가져올 여행 기록이 없습니다.");
  await Promise.all(records.map(saveArchiveRecord));
  return sortArchiveRecords(records);
}

window.TripLog.register("persistence.archiveDb", {
  ARCHIVE_DB_NAME,
  ARCHIVE_SCHEMA_VERSION,
  isArchiveDbSupported,
  createArchiveRecord,
  normalizeArchiveRecord,
  loadArchiveRecords,
  saveArchiveRecord,
  deleteArchiveRecord,
  clearArchiveRecords,
  buildArchiveExportPayload,
  downloadArchiveJson,
  importArchiveJsonFile,
});
