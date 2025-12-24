import { apiClient } from './apiClient';

export interface Customer {
	id: number;
	first_name: string;
	last_name: string;
	check_in_date: string;
	check_out_date: string;
	room_numbers: string[];
}

// New: helper for UI display
export function formatCustomerName(c?: Partial<Customer> | null): string {
	if (!c) return '';
	const first = (c.first_name ?? '').toString().trim();
	const last = (c.last_name ?? '').toString().trim();
	return `${first}${last ? ' ' + last : ''}`.trim();
}

export interface RoomItem {
	room: {
		id: number;
		room_number: string;
	};
}

/**
 * Fetch current reservations (customers)
 */
export async function getCustomers(): Promise<Customer[]> {
	try {
		const { data } = await apiClient.get<{ success: boolean; customers: Customer[] }>('/pos/customers');
		return data.customers;
	} catch (error) {
		console.error('getCustomers error:', error);
		throw error;
	}
}

/**
 * Fetch rooms for a specific reservation
 * (reservationId can be a numeric string as well)
 */
export async function getCustomerRooms(reservationId: number | string): Promise<RoomItem[]> {
	try {
		const ridNum = typeof reservationId === 'string' ? Number(reservationId) : reservationId;
		if (!Number.isFinite(ridNum) || ridNum <= 0) return [];

		const { data } = await apiClient.post<{ success: boolean; room?: RoomItem[] }>(
			'/pos/customer_rooms',
			{ reservation_id: ridNum }
		);

		if (!data?.success) return [];
		return Array.isArray(data.room) ? data.room : [];
	} catch (error) {
		console.error('getCustomerRooms error:', error);
		throw error;
	}
}
