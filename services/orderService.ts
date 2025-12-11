import type { AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import type { Order, CreateOrderRequest, CreateOrderResponse, CartItem } from '../types/Order';
import type { MenuItem } from '../types/menu';
import { apiClient } from './apiClient';

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
    const tableIdValue: string = orderData.tableId && !isNaN(Number(orderData.tableId)) ? String(orderData.tableId) : "";
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
export const getAllOrders = () => orderService.getAllOrders();
