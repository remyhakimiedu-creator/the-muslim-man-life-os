import { APP_ID, SCHEMA, createDefaultState, normalizeState } from './state';

export const STORAGE_KEY = 'mlos_state_v1';
const CORRUPT_KEY = 'mlos_state_corrupt';

/** Read saved state. Falls back to first-run defaults, never throws. */
export function loadState(now = Date.now(), storage = globalThis.localStorage) {
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {
    // Unreadable data: keep a copy so nothing is silently destroyed.
    try {
      if (raw) storage.setItem(CORRUPT_KEY, raw);
    } catch {
      /* storage unavailable */
    }
  }
  return createDefaultState(now);
}

export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // private mode or quota — the app keeps working in memory
  }
}

// ---- JSON backup ----------------------------------------------------------

export function serializeBackup(state, now = Date.now()) {
  const { timer: _timer, ...rest } = state; // a running countdown isn't worth restoring
  return JSON.stringify(
    { app: APP_ID, schema: SCHEMA, exportedAt: new Date(now).toISOString(), state: rest },
    null,
    2,
  );
}

/** Parse and validate a backup file. Throws an Error with a readable message. */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!data || data.app !== APP_ID || typeof data.state !== 'object') {
    throw new Error('That file is not a Life OS backup.');
  }
  if (Number(data.schema) > SCHEMA) {
    throw new Error('This backup was made by a newer version of the app.');
  }
  return normalizeState(data.state);
}

export const backupFileName = (dayKey) => `life-os-backup-${dayKey}.json`;
