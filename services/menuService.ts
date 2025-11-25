import type { AxiosRequestConfig } from 'axios'
import type { MenuItem, MenuResponse } from '../types/menu'
import { apiClient } from './apiClient'

/*
Summary:
- Recreate the menu service as a class that uses the axios apiClient.
- Export a singleton instance and keep named helper exports for backward compatibility.
*/

export class MenuService {
	constructor(private client = apiClient) {}

	// Generic fetch that accepts full URL or relative path
	async fetchMenu(url: string, config?: AxiosRequestConfig): Promise<MenuResponse> {
		const res = await this.client.get(url, config)
		return res.data as MenuResponse
	}

	async fetchMenuData(config?: AxiosRequestConfig): Promise<MenuResponse> {
		return this.fetchMenu('/pos/menu_items', config)
	}

	findMenuItemById(data: MenuResponse, id: number): MenuItem | undefined {
		return data.menus.find((m) => m.id === id)
	}

	// Relative endpoint paths (baseURL set in apiClient)
	async fetchAllMenuItems(config?: AxiosRequestConfig): Promise<MenuItem[]> {
		const data = await this.fetchMenuData(config)
		return data.menus
	}

	async fetchMenuItemByIdEndpoint(id: number, config?: AxiosRequestConfig): Promise<MenuItem | undefined> {
		try {
			const res = await this.client.get(`/pos/menu_item/${encodeURIComponent(String(id))}`, config)
			const json = res.data
			if (json == null) return undefined

			// Shape: { menu: { ... , combo: [...] } }
			if (json.menu && typeof json.menu === 'object') {
				const menu = json.menu as any

				// If server provided combo array, normalize nested combo_item.menu into combo_items[]
				if (Array.isArray(menu.combo)) {
					const comboItems: MenuItem[] = menu.combo.flatMap((c: any) => {
						if (!Array.isArray(c.combo_item)) return []
						return c.combo_item.map((ci: any) => {
							// prefer the nested menu object if present
							return ci.menu ?? (ci as any)
						}).filter(Boolean)
					})
					// Attach normalized combo_items for consumers
					menu.combo_items = comboItems
				}

				return menu as MenuItem
			}

			// If server returned a full MenuResponse-like object
			if (Array.isArray((json as any).menus)) {
				return ((json as any).menus as MenuItem[]).find((m) => m.id === id)
			}

			// If server returned an object with `menu` key handled above, or item directly
			if ((json as any).menu && typeof (json as any).menu === 'object' && 'id' in (json as any).menu) {
				return (json as any).menu as MenuItem
			}

			// If server returned the item directly
			if ('id' in json) {
				return json as MenuItem
			}

			return undefined
		} catch (err: any) {
			if (err?.response?.status === 404) return undefined
			throw err
		}
	}

	// fallback that fetches all items and finds the id
	async fetchMenuItemByIdNetwork(id: number, config?: AxiosRequestConfig): Promise<MenuItem | undefined> {
		const items = await this.fetchAllMenuItems(config)
		return items.find((m) => m.id === id)
	}

	// prefer endpoint, fallback to network full-list
	async fetchMenuItemById(id: number, config?: AxiosRequestConfig): Promise<MenuItem | undefined> {
		const fromEndpoint = await this.fetchMenuItemByIdEndpoint(id, config).catch(() => undefined)
		if (fromEndpoint) return fromEndpoint
		return this.fetchMenuItemByIdNetwork(id, config)
	}
}

// singleton instance
export const menuService = new MenuService()

// backward-compatible named exports
export const fetchMenu = (url: string, init?: AxiosRequestConfig) => menuService.fetchMenu(url, init)
export const findMenuItemById = (data: MenuResponse, id: number) => menuService.findMenuItemById(data, id)
export const MENU_API_URL = '/pos/menu_items'
export const MENU_ITEM_API_URL = '/pos/menu_item'
export const fetchAllMenuItems = (init?: AxiosRequestConfig) => menuService.fetchAllMenuItems(init)
export const fetchMenuItemByIdEndpoint = (id: number, init?: AxiosRequestConfig) => menuService.fetchMenuItemByIdEndpoint(id, init)
export const fetchMenuItemByIdNetwork = (id: number, init?: AxiosRequestConfig) => menuService.fetchMenuItemByIdNetwork(id, init)
export const fetchMenuItemById = (id: number, init?: AxiosRequestConfig) => menuService.fetchMenuItemById(id, init)
export const fetchMenuData = (init?: AxiosRequestConfig) => menuService.fetchMenuData(init)