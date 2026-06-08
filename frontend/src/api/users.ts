import client from './client';
import { type UserStats, type UserPreferences } from '../types/api';

export const getMe = () => client.post('/auth/me').then((r) => r.data);

export const getUserStats = (): Promise<UserStats> =>
  client.get('/users/me/stats').then((r) => r.data);

export const getUserPreferences = (): Promise<UserPreferences> =>
  client.get('/users/me/preferences').then((r) => r.data);

export const updateUserPreferences = (prefs: UserPreferences): Promise<UserPreferences> =>
  client.patch('/users/me/preferences', prefs).then((r) => r.data);
