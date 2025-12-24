import { apiClient } from './apiClient';

export interface Steward {
	id: number;
	name: string;
	lname: string;
	role: string;
}

// New: helper for UI display
export function formatStewardName(s?: Partial<Steward> | null): string {
	if (!s) return '';
	const first = (s.name ?? '').toString().trim();
	const last = (s.lname ?? '').toString().trim();
	return `${first}${last ? ' ' + last : ''}`.trim();
}

/**
 * Fetch stewards (staff)
 */
export async function getStewards(): Promise<Steward[]> {
	try {
		const { data } = await apiClient.get<{ success: boolean; stewards: Steward[] }>('/pos/stewards');
		return data.stewards;
	} catch (error) {
		console.error('getStewards error:', error);
		throw error;
	}
}
