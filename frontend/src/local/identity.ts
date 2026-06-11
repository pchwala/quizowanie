import { type UserPreferences } from '../types/api';
import { getMeta, persistWebStore, setMeta } from './db';

/**
 * Local anonymous identity + on-device preferences. The device id is created
 * offline (no network, no Firebase) — study works from the first launch after
 * the bundle is cached. The Firebase anon uid is only needed for server sync
 * and attaches lazily (see contexts/AuthContext.tsx).
 */

export async function getDeviceId(): Promise<string> {
  let id = await getMeta('device_id');
  if (!id) {
    id = crypto.randomUUID();
    await setMeta('device_id', id);
    await persistWebStore();
  }
  return id;
}

export const DEFAULT_PREFERENCES: UserPreferences = { show_options: true, daily_limit: 15 };

export async function getLocalPreferences(): Promise<UserPreferences> {
  const raw = await getMeta('preferences');
  return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
}

export async function setLocalPreferences(prefs: UserPreferences): Promise<void> {
  await setMeta('preferences', JSON.stringify(prefs));
  await persistWebStore();
}
