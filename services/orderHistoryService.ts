import { apiClient } from './apiClient';

export type Order = {
  [x: string]: Order;
  id: number;
  order_id?: string;
  customer_name?: string;
  status?: string;
  type?: string;
  restaurant_id?: number;
  table_id?: number;
  hotel_id?: number;
  created_at?: string;
  order_list_detail?: any[];
  kot_lists?: any[];
  // ...other fields as needed
};

export type PaginatedOrders = {
  current_page: number;
  data: Order[];
  first_page_url?: string;
  from?: number;
  last_page: number;
  last_page_url?: string;
  links?: any[];
  next_page_url?: string | null;
  path?: string;
  per_page: number | string;
  prev_page_url?: string | null;
  to?: number;
  total: number;
};

export type OrdersResponse = PaginatedOrders | Order[];

// Fetch list of orders. params follow POS API query params (search, type, status, from_date, to_date, per_page, page, etc.)
export async function getOrders(params?: Record<string, any>): Promise<OrdersResponse> {
  try {
    const resp = await apiClient.get('/pos/orders', { params });
    return resp.data;
  } catch (err) {
    // Re-throw so callers can handle
    throw err;
  }
}

// Fetch single order by ID
export async function getOrder(id: number | string): Promise<Order> {
  try {
    const resp = await apiClient.get(`/pos/orders/${id}`);
    return resp.data;
  } catch (err) {
    throw err;
  }
}
