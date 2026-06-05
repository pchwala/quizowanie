import client from './client';
import { type Category } from '../types/api';

export const getCategories = (): Promise<Category[]> =>
  client.get('/categories').then((r) => r.data);
