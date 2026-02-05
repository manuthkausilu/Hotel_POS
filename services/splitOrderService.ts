import type { AxiosRequestConfig } from 'axios';
import { apiClient } from './apiClient';

export type SplitPayerItem = {
  id: string; // must be "cart-item-{order_list_detail_id}"
  name?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type SplitPayer = {
  name: string;
  itemsSubtotal: number;
  serviceCharge: number;
  totalAmount: number;
  items: SplitPayerItem[];
  email?: string;
  phone?: string;
  paymentMethod?: string;
  givenAmount?: number;
  changeAmount?: number;
};

type ProcessSplitPaymentsRequest = {
  order_id: number | string;
  payers: string; // JSON-stringified array of SplitPayer
  total_amount: number;
  service_charge: number;
};

type CreatedOrderSummary = {
  order_id: number;
  payer_name: string;
  items_subtotal: number;
  service_charge: number;
  total_amount: number;
  items_count: number;
};

type ProcessSplitPaymentsResponse = {
  success: boolean;
  message: string;
  original_order_id?: number;
  total_orders?: number;
  created_orders?: CreatedOrderSummary[];
};

/**
 * SplitOrderService
 * - processSplitPayments: sends payload to /pos/process_split_payments
 * - by default sends JSON; pass { formUrlEncoded: true } in config to send as application/x-www-form-urlencoded
 */
export class SplitOrderService {
  constructor(private client = apiClient) { }

  private ensureValidPayers(payers: SplitPayer[]) {
    if (!Array.isArray(payers) || payers.length === 0) {
      throw new Error('payers array is required and cannot be empty');
    }
    for (const p of payers) {
      if (!p.name || typeof p.itemsSubtotal !== 'number' || typeof p.serviceCharge !== 'number' || typeof p.totalAmount !== 'number' || !Array.isArray(p.items)) {
        throw new Error('each payer must have name, itemsSubtotal, serviceCharge, totalAmount and items array');
      }
      for (const it of p.items) {
        if (!it.id || !String(it.id).startsWith('cart-item-')) {
          // warn but do not strictly fail — backend requires real ids; caller should ensure correct ids
          console.warn('[SplitOrderService] payer item id should be in format "cart-item-{id}":', it.id);
        }
      }
    }
  }

  async processSplitPayments(
    orderId: number | string,
    payers: SplitPayer[],
    totalAmount: number,
    serviceCharge: number,
    config?: AxiosRequestConfig & { formUrlEncoded?: boolean }
  ): Promise<ProcessSplitPaymentsResponse> {
    this.ensureValidPayers(payers);

    const payload: ProcessSplitPaymentsRequest = {
      order_id: orderId,
      payers: JSON.stringify(payers),
      total_amount: Number(totalAmount),
      service_charge: Number(serviceCharge),
    };

    try {
      console.log('[SplitOrderService] Sending split payload for order:', orderId);
      console.log(JSON.stringify({ ...payload, payers: JSON.parse(payload.payers) }, null, 2));

      if (config?.formUrlEncoded) {
        // send as application/x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append('order_id', String(payload.order_id));
        params.append('payers', payload.payers);
        params.append('total_amount', String(payload.total_amount));
        params.append('service_charge', String(payload.service_charge));

        const res = await this.client.post<ProcessSplitPaymentsResponse>(
          '/pos/process_split_payments',
          params.toString(),
          {
            ...config,
            headers: { ...(config.headers ?? {}), 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        );
        return res.data;
      }

      // default: JSON
      const res = await this.client.post<ProcessSplitPaymentsResponse>('/pos/process_split_payments', payload, config);
      return res.data;
    } catch (err: any) {
      console.error('[SplitOrderService] processSplitPayments error:', err?.response?.data ?? err?.message ?? err);
      throw err;
    }
  }
}

export const splitOrderService = new SplitOrderService();

export const processSplitPayments = (
  orderId: number | string,
  payers: SplitPayer[],
  totalAmount: number,
  serviceCharge: number,
  config?: AxiosRequestConfig & { formUrlEncoded?: boolean }
) => splitOrderService.processSplitPayments(orderId, payers, totalAmount, serviceCharge, config);
