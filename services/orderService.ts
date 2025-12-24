import type { AxiosRequestConfig } from 'axios';
import type { Order, CreateOrderRequest, CreateOrderResponse, CartItem } from '../types/Order';
import type { MenuItem } from '../types/menu';
import { apiClient } from './apiClient';

// Add types for the running orders endpoint
type RunningOrder = {
  id: number;
  total: number;
  created_at: string;
  customer_name: string;
  // New (optional): if backend provides split names
  customer_first_name?: string;
  customer_last_name?: string;
  room_number: string | null;
  table_id: string | null;
  steward_name: string | null;
  item_count: number;
  is_ready: boolean;
};

type GetRunningOrdersResponse = {
  success: boolean;
  orders: RunningOrder[];
};

// New: types for finalize and cancel endpoints
type FinalizeOrderRequest = {
  order_id: number | string;
  payment_method: string;
  paid_amount: number;
  given_amount?: number;
  change_amount?: number;
  order_date?: string;
};

type FinalizeOrderResponse = {
  success: boolean;
  message: string;
  data: {
    order_id: number;
    total_amount: number;
    paid_amount: number;
    payment_method: string;
    finalize_date: string;
  };
};

type CancelOrderRequest = {
  order_id: number | string;
  reason?: string;
};

type CancelOrderResponse = {
  success: boolean;
  message: string;
  data: {
    order_id: number;
    order_status: string;
    cancellation_reason?: string;
  };
};

// New: type for single order response
type SingleOrder = {
  id: number;
  order_id: string;
  customer_name: string;
  status: string;
  type: string;
  created_at: string;
  order_list_detail?: any[];
  kot_lists?: any[];
  [key: string]: any;
};

type GetSingleOrderResponse = SingleOrder;

export class OrderService {
  private orders: Map<string, Order> = new Map();
  private restaurantId: number = 2;

  constructor(private client = apiClient) {}

  createOrder(tableId?: string): string {
    const orderId = "new";
    const order: Order = {
      id: orderId,
      tableId,
      items: [],
      total: 0,
      status: 'Processing',
      createdAt: new Date(),
      orderType: '',
      customer: { id: '', name: '' },
      room: { id: '', name: '' },
      stewardId: null
    };
    this.orders.set(orderId, order);
    return orderId;
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  addItemToOrder(orderId: string, menuItem: MenuItem & { modifiers?: Array<{ menu_id: number; name: string }> }, quantity: number = 1, notes?: string): void {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    const existingItem = order.items.find(item => 
      item.menuItemId === menuItem.id && 
      JSON.stringify(item.modifiers) === JSON.stringify(menuItem.modifiers)
    );
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      order.items.push({
        id: Date.now(),
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        notes,
        modifiers: menuItem.modifiers,
      });
    }
    this.updateTotal(orderId);
  }

  removeItemFromOrder(orderId: string, itemId: number): void {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');
    order.items = order.items.filter(item => item.id !== itemId);
    this.updateTotal(orderId);
  }

  private updateTotal(orderId: string): void {
    const order = this.orders.get(orderId);
    if (!order) return;
    order.total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  async submitOrder(
    orderId: string,
    orderData: {
      orderType: string;
      customer?: { id: string; name: string };
      room?: { id: string; name: string };
      tableId?: string;
      stewardId?: string | null;
      serviceCharge: number;
    },
    config?: AxiosRequestConfig
  ): Promise<CreateOrderResponse> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    if (!orderData.orderType) throw new Error('Order type is required');
    if (!order.items || order.items.length === 0) throw new Error('Cart is empty');

    const cart: CartItem[] = order.items.map(item => ({
      recipe_id: item.menuItemId,
      name: item.name,
      qty: item.quantity,
      price: item.price,
      total: item.price * item.quantity,
      row_id: "new",
      modifiers: item.modifiers || [],
    }));

    const normalizedOrderType = orderData.orderType?.toLowerCase().includes('take') ? 'Take away' : 'Dine In';

    // Send empty strings for optional fields when no value provided
    const tableIdValue: string =
      normalizedOrderType === 'Take away'
        ? ''
        : (orderData.tableId && !isNaN(Number(orderData.tableId)) ? String(orderData.tableId) : "");

    const roomValue: string = orderData.room?.id && orderData.room.id !== 'walk_in' ? String(orderData.room.id) : "";
    const customerValue: string = orderData.customer?.id && orderData.customer.id !== 'walk_in' ? String(orderData.customer.id) : "Walk-in Customer";

    const headerStewardId =
      (this.client as any)?.defaults?.headers?.common?.['X-User-Id'] ??
      (this.client as any)?.defaults?.headers?.common?.['user-id'] ??
      (this.client as any)?.defaults?.headers?.['X-User-Id'] ??
      (this.client as any)?.defaults?.headers?.['user-id'] ??
      undefined;

    const stewardValue: string = (() => {
      if (orderData.stewardId && String(orderData.stewardId).trim().length > 0) {
        return String(orderData.stewardId);
      }
      if (headerStewardId && String(headerStewardId).trim().length > 0) {
        return String(headerStewardId);
      }
      return ""; // empty string when not available
    })();

    const requestBody: CreateOrderRequest = {
      order_id: "new",
      order_type: normalizedOrderType,
      customer: customerValue,
      room: roomValue,
      table_id: tableIdValue,
      steward_id: stewardValue,
      restaurant_id: this.restaurantId,
      service_charge: Number(orderData.serviceCharge) || 0,
      cart,
    };

    // Log complete request with formatting
    console.log('═══════════════════════════════════════');
    console.log('[POS/Service] ORDER SUBMISSION REQUEST');
    console.log('═══════════════════════════════════════');
    console.log('Order ID:', requestBody.order_id);
    console.log('Order Type:', requestBody.order_type);
    console.log('Customer:', requestBody.customer);
    console.log('Room:', requestBody.room);
    console.log('Table ID:', requestBody.table_id);
    console.log('Steward ID:', requestBody.steward_id);
    console.log('Restaurant ID:', requestBody.restaurant_id);
    console.log('Service Charge:', requestBody.service_charge);
    console.log('Items Count:', requestBody.cart.length);
    console.log('───────────────────────────────────────');
    console.log('[POS/Service] FULL REQUEST BODY:');
    console.log(JSON.stringify(requestBody, null, 2));
    console.log('═══════════════════════════════════════');

    const res = await this.client.post<CreateOrderResponse>('/pos/orders', requestBody, config);

    console.log('[POS/Service] CreateOrderResponse:', JSON.stringify(res.data, null, 2));

    if (res.data.success) {
      order.status = 'Processing';
      order.id = res.data.data.order_id.toString();
    }

    return res.data;
  }

  // New: fetch current running orders from API
  async getRunningOrders(config?: AxiosRequestConfig): Promise<GetRunningOrdersResponse> {
    try {
      const res = await this.client.get<GetRunningOrdersResponse>('/pos/running_orders', config);
      console.log('[POS/Service] GetRunningOrders response:', JSON.stringify(res.data, null, 2));
      return res.data;
    } catch (error) {
      console.error('[POS/Service] GetRunningOrders error:', error);
      throw error;
    }
  }

  // New: finalize an order
  async finalizeOrder(payload: FinalizeOrderRequest, config?: AxiosRequestConfig): Promise<FinalizeOrderResponse> {
    try {
      // Log finalize request payload for debugging
      console.log('═══════════════════════════════════════');
      console.log('[POS/Service] FINALIZE ORDER REQUEST');
      console.log('═══════════════════════════════════════');
      console.log(JSON.stringify(payload, null, 2));
      console.log('═══════════════════════════════════════');
      const res = await this.client.post<FinalizeOrderResponse>('/pos/orders/finalize', payload, config);
      console.log('[POS/Service] FinalizeOrder response:', JSON.stringify(res.data, null, 2));
      return res.data;
    } catch (error) {
      console.error('[POS/Service] FinalizeOrder error:', error);
      throw error;
    }
  }

  // New: cancel an order
  async cancelOrder(payload: CancelOrderRequest, config?: AxiosRequestConfig): Promise<CancelOrderResponse> {
    try {
      const res = await this.client.post<CancelOrderResponse>('/pos/orders/cancel', payload, config);
      console.log('[POS/Service] CancelOrder response:', JSON.stringify(res.data, null, 2));
      return res.data;
    } catch (error) {
      console.error('[POS/Service] CancelOrder error:', error);
      throw error;
    }
  }

  // New: fetch a single order by ID
  async fetchOrderById(id: number | string, config?: AxiosRequestConfig): Promise<GetSingleOrderResponse> {
    try {
      const res = await this.client.get<GetSingleOrderResponse>(`/pos/orders/${id}`, config);
      console.log('[POS/Service] FetchOrderById response:', JSON.stringify(res.data, null, 2));
      return res.data;
    } catch (error) {
      console.error('[POS/Service] FetchOrderById error:', error);
      throw error;
    }
  }

  // New: create or update order using same endpoint (/pos/orders)
  async upsertOrder(payload: CreateOrderRequest & { order_id: number | string }, config?: AxiosRequestConfig): Promise<CreateOrderResponse> {
    try {
      console.log('[POS/Service] UPSERT ORDER REQUEST:', JSON.stringify(payload, null, 2));

      // If we have a numeric internal id, try a direct PUT first (less chance of being treated as a create)
      const numericId = Number(payload.order_id);
      if (Number.isFinite(numericId) && numericId > 0) {
        try {
          console.log(`[POS/Service] Attempting PUT /pos/orders/${numericId}`);
          const putRes = await this.client.put<CreateOrderResponse>(`/pos/orders/${numericId}`, payload, config);
          console.log('[POS/Service] Upsert (PUT) response:', JSON.stringify(putRes.data, null, 2));
          return putRes.data;
        } catch (putErr) {
          // fallback to POST if PUT is not supported or fails
          console.warn('[POS/Service] PUT failed, falling back to POST:', putErr);
        }
      }

      // fallback: POST to /pos/orders
      const res = await this.client.post<CreateOrderResponse>('/pos/orders', payload, config);
      console.log('[POS/Service] Upsert (POST) response:', JSON.stringify(res.data, null, 2));
      return res.data;
    } catch (error) {
      console.error('[POS/Service] UpsertOrder error:', error);
      throw error;
    }
  }

  getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }
}

export const orderService = new OrderService();

export const createOrder = (tableId?: string) => orderService.createOrder(tableId);
export const getOrder = (orderId: string) => orderService.getOrder(orderId);
export const addItemToOrder = (orderId: string, menuItem: MenuItem, quantity?: number, notes?: string) => orderService.addItemToOrder(orderId, menuItem, quantity, notes);
export const removeItemFromOrder = (orderId: string, itemId: number) => orderService.removeItemFromOrder(orderId, itemId);
export const submitOrder = (orderId: string, orderData: any, config?: AxiosRequestConfig) => orderService.submitOrder(orderId, orderData, config);
export const getRunningOrders = (config?: AxiosRequestConfig) => orderService.getRunningOrders(config);
export const finalizeOrder = (payload: FinalizeOrderRequest, config?: AxiosRequestConfig) => orderService.finalizeOrder(payload, config);
export const cancelOrder = (payload: CancelOrderRequest, config?: AxiosRequestConfig) => orderService.cancelOrder(payload, config);
export const getAllOrders = () => orderService.getAllOrders();
// New export wrapper
export const fetchOrderById = (id: number | string, config?: AxiosRequestConfig) => orderService.fetchOrderById(id, config);
// New export wrapper for upsert
export const upsertOrder = (payload: any, config?: AxiosRequestConfig) => orderService.upsertOrder(payload, config);
