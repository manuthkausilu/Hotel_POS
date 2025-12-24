import { apiClient } from './apiClient';

export interface Order {
  // ...minimal order fields (extend as needed)...
  id?: number;
  // ...existing code...
  [key: string]: any;
}

export interface Table {
  id: number;
  table_name: string;
  nu_of_chairs: number;
  order_count: number;
  orders: Order[];
}

/**
 * Fetch tables
 */
export async function getTables(): Promise<Table[]> {
  try {
    const { data } = await apiClient.get<{ success: boolean; tables?: Table[] | null }>('/pos/tables');
    return data.tables ?? [];
  } catch (error) {
    console.error('getTables error:', error);
    throw error;
  }
}