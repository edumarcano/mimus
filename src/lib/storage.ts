export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function browserStorage(
  kind: "localStorage" | "sessionStorage",
): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window[kind];
  } catch {
    return null;
  }
}

export function safeGetItem(
  storage: StorageLike | null,
  key: string,
): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeSetItem(
  storage: StorageLike | null,
  key: string,
  value: string,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveItem(
  storage: StorageLike | null,
  key: string,
): boolean {
  try {
    if (!storage) return false;
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
  storage: StorageLike | null,
  pairs: readonly StorageMigrationPair[],
): boolean {
  if (!storage) return false;
  let complete = true;
  for (const { legacy, current } of pairs) {
    try {
      const legacyValue = storage.getItem(legacy);
      if (legacyValue === null) continue;
      if (storage.getItem(current) === null) {
        storage.setItem(current, legacyValue);
      }
      storage.removeItem(legacy);
    } catch {
      complete = false;
    }
  }
  return complete;
}

let legacyStorageMigrated = false;

const LOCAL_STORAGE_MIGRATIONS: readonly StorageMigrationPair[] = [
  { legacy: "parlance:prefs:v1", current: "mimus:prefs:v1" },
  { legacy: "parlance:history:v1", current: "mimus:history:v1" },
];

const SESSION_STORAGE_MIGRATIONS: readonly StorageMigrationPair[] = [
  { legacy: "parlance:ack", current: "mimus:ack" },
];

export function migrateLegacyStorage(): boolean {
  if (legacyStorageMigrated || typeof window === "undefined") {
    return true;
  }
  const localComplete = migrateStorageKeys(
    browserStorage("localStorage"),
    LOCAL_STORAGE_MIGRATIONS,
  );
  const sessionComplete = migrateStorageKeys(
    browserStorage("sessionStorage"),
    SESSION_STORAGE_MIGRATIONS,
  );
  legacyStorageMigrated = localComplete && sessionComplete;
  return legacyStorageMigrated;
}

/** @internal Resets one-time migration guard for tests. */
export function resetLegacyStorageMigrationForTests(): void {
  legacyStorageMigrated = false;
}
