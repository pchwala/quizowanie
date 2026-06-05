import client from './client';
import { UserStats } from '../types/api';

export const getMe = () => client.post('/auth/me').then((r) => r.data);

export const getUserStats = (): Promise<UserStats> =>
  client.get('/users/me/stats').then((r) => r.data);
