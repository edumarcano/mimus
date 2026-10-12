export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function safeGetItem(
  storage: StorageLike,
  key: string,
): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(
  storage: StorageLike,
  key: string,
  value: string,
): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveItem(storage: StorageLike, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function safeParseJson<T>(
  raw: string | null,
  validate: (value: unknown) => value is T,
): T | null {
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export type StorageMigrationPair = {
  legacy: string;
  current: string;
};

export function migrateStorageKeys(
  storage: StorageLike,
  pairs: readonly StorageMigrationPair[],
): void {
  for (const { legacy, current } of pairs) {
    const legacyValue = safeGetItem(storage, legacy);
    if (legacyValue === null) {
      continue;
    }
    if (safeGetItem(storage, current) === null) {
      safeSetItem(storage, current, legacyValue);
    }
    safeRemoveItem(storage, legacy);
  }
}

let legacyStorageMigrated = false;

const LOCAL_STORAGE_MIGRATIONS: readonly StorageMigrationPair[] = [
  { legacy: "parlance:prefs:v1", current: "mimus:prefs:v1" },
  { legacy: "parlance:history:v1", current: "mimus:history:v1" },
];

const SESSION_STORAGE_MIGRATIONS: readonly StorageMigrationPair[] = [
  { legacy: "parlance:ack", current: "mimus:ack" },
];

export function migrateLegacyStorage(): void {
  if (legacyStorageMigrated || typeof window === "undefined") {
    return;
  }
  legacyStorageMigrated = true;
  try {
    migrateStorageKeys(localStorage, LOCAL_STORAGE_MIGRATIONS);
  } catch {
    // localStorage unavailable
  }
  try {
    migrateStorageKeys(sessionStorage, SESSION_STORAGE_MIGRATIONS);
  } catch {
    // sessionStorage unavailable
  }
}

/** @internal Resets one-time migration guard for tests. */
export function resetLegacyStorageMigrationForTests(): void {
  legacyStorageMigrated = false;
}
