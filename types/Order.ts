export interface CartItem {
  recipe_id: number;
  name: string;
  qty: number;
  price: number;
  total: number;
  row_id: string; // "new" or existing detail ID
  modifiers?: Array<{ menu_id: number; name: string }>;
  note?: string; // Internal use only - not sent to API
}

export interface CreateOrderRequest {
  order_id: string; // "new" for new order, or existing order ID
  order_type: string; // "Take away" or "Dine In"
  customer: string; // Reservation ID or "Walk-in Customer"
  room: string; // Room ID or empty string ""
  table_id: string; // Table ID or empty string ""
  steward_id: string; // Steward ID or empty string ""
  restaurant_id: number; // Restaurant ID (restaurants.id)
  service_charge: number; // Service charge for order
  cart: CartItem[]; // Array of items in order
}

export interface CreateOrderResponse {
  success: boolean;
  message?: string;
  data: {
    order_id: number | string;
    order_number?: any;
    status?: any;
    kot_generated?: any;
  };
}

export interface OrderItem {
  id: number;
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  modifiers?: Array<{ menu_id: number; name: string }>;
}

export interface Order {
  id?: string;
  tableId?: string;
  items: OrderItem[];
  total: number;
  status: 'Processing' | 'Complete' | 'Cancel';
  createdAt: Date;
  orderType: string;
  customer: { id: string; name: string };
  room: { id: string; name: string };
  stewardId: string | null;
}
