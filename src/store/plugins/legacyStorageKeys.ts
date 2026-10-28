// One-time copy of localStorage keys from the app's old name
// ("habitica-streak:*") to its current one ("streak-slayer:*"), so an
// existing save, theme and high scores carry over. Runs before any store
// reads its key (main.ts), and only while nothing is stored under the new
// name yet: after that, a key missing under the new name was removed on
// purpose (e.g. by an import) and must not be brought back. The old keys
// are left in place for any still-cached copy of the old app.

const LEGACY_PREFIX = 'habitica-streak:';
const PREFIX = 'streak-slayer:';

export function migrateLegacyStorageKeys(storage: Storage = localStorage) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null) keys.push(key);
  }
  if (keys.some((key) => key.startsWith(PREFIX))) return;
  for (const key of keys) {
    if (!key.startsWith(LEGACY_PREFIX)) continue;
    const value = storage.getItem(key);
    if (value !== null) storage.setItem(PREFIX + key.slice(LEGACY_PREFIX.length), value);
  }
}
