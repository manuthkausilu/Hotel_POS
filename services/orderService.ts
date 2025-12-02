import type { AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid'; // Assuming uuid is installed; if not, use a simple ID generator
import type { CheckoutRequest, Order } from '../types/Order';
import type { MenuItem } from '../types/menu';
import { apiClient } from './apiClient';

export class OrderService {
  private orders: Map<string, Order> = new Map(); // In-memory storage for multiple orders

  constructor(private client = apiClient) {}

  // Create a new order
  createOrder(tableId?: string): string {
    const orderId = uuidv4();
    const order: Order = {
      id: orderId,
      tableId,
      items: [],
      total: 0,
      status: 'pending',
      createdAt: new Date(),
      orderType: '',
      customer: {
        id: '',
        name: ''
      },
      room: {
        id: '',
        name: ''
      },
      stewardId: null
    };
    this.orders.set(orderId, order);
    return orderId;
  }

  // Get an order by ID
  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  // Add item to order
  addItemToOrder(orderId: string, menuItem: MenuItem, quantity: number = 1, notes?: string): void {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    const existingItem = order.items.find(item => item.menuItemId === menuItem.id);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      order.items.push({
        id: Date.now(), // Simple ID
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        notes,
      });
    }
    this.updateTotal(orderId);
  }

  // Remove item from order
  removeItemFromOrder(orderId: string, itemId: number): void {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    order.items = order.items.filter(item => item.id !== itemId);
    this.updateTotal(orderId);
  }

  // Update total for an order
  private updateTotal(orderId: string): void {
    const order = this.orders.get(orderId);
    if (!order) return;
    order.total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  // Submit order to API
  async submitOrder(orderId: string, config?: AxiosRequestConfig): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    const res = await this.client.post('/pos/orders', order, config);
    order.status = 'submitted';
    // Optionally, remove from memory or persist
  }

  // Checkout (process payment)
  async checkout(checkoutData: CheckoutRequest, config?: AxiosRequestConfig): Promise<void> {
    const res = await this.client.post('/pos/checkout', checkoutData, config);
    const order = this.orders.get(checkoutData.orderId);
    if (order) order.status = 'completed';
  }

  // Get all active orders
  getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }
}

// Singleton instance
export const orderService = new OrderService();

// Backward-compatible exports
export const createOrder = (tableId?: string) => orderService.createOrder(tableId);
export const getOrder = (orderId: string) => orderService.getOrder(orderId);
export const addItemToOrder = (orderId: string, menuItem: MenuItem, quantity?: number, notes?: string) => orderService.addItemToOrder(orderId, menuItem, quantity, notes);
export const removeItemFromOrder = (orderId: string, itemId: number) => orderService.removeItemFromOrder(orderId, itemId);
export const submitOrder = (orderId: string, config?: AxiosRequestConfig) => orderService.submitOrder(orderId, config);
export const checkout = (checkoutData: CheckoutRequest, config?: AxiosRequestConfig) => orderService.checkout(checkoutData, config);
export const getAllOrders = () => orderService.getAllOrders();
