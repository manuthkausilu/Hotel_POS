export interface OrderItem {
  id: number;
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface Order {
  orderType: string;
  customer: { id: string; name: string; };
  room: { id: string; name: string; };
  stewardId: string | null;
  id?: string; // Unique order ID (e.g., UUID or session-based)
  tableId?: string; // Optional, for associating with a table/session
  items: OrderItem[];
  total: number;
  status: 'pending' | 'submitted' | 'completed';
  createdAt: Date;
}

export interface Cart {
  [orderId: string]: Order; // Support multiple orders by ID
}

export interface CheckoutRequest {
  orderId: string;
  paymentMethod: string; // e.g., 'cash', 'card'
  total: number;
  userId?: string; // New: Optional user ID
  serviceCharge?: number; // New: Optional service charge
}
