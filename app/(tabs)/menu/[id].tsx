import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { fetchAllMenuItems, fetchMenuItemById } from '../../../services/menuService'
import type { MenuItem } from '../../../types/menu'

export default function MenuItemDetail() {
	const params = useLocalSearchParams() as { id?: string }
	const router = useRouter()
	const id = params.id ? Number(params.id) : NaN

	const [item, setItem] = useState<MenuItem | null>(null)
	const [comboItems, setComboItems] = useState<MenuItem[] | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let mounted = true
		if (!id || Number.isNaN(id)) {
			setError('Invalid item id')
			setLoading(false)
			return
		}
		async function load() {
			try {
				setLoading(true)
				const fetched = await fetchMenuItemById(id)
				if (!mounted) return
				if (!fetched) {
					setError('Item not found')
					return
				}
				setItem(fetched)

				// If endpoint returned embedded menus/combo items in some shape, render them:
				// try common keys: 'menus', 'menu_items', 'combo_items', 'items'
				const anyJson = fetched as any
				if (Array.isArray(anyJson.menus)) {
					setComboItems(anyJson.menus as MenuItem[])
					return
				}
				if (Array.isArray(anyJson.combo_items)) {
					setComboItems(anyJson.combo_items as MenuItem[])
					return
				}
				if (Array.isArray(anyJson.items)) {
					setComboItems(anyJson.items as MenuItem[])
					return
				}

				// Best-effort: when combo_level indicates a combo (not "1"), show other items with same combo_level
				if (fetched.combo_level && fetched.combo_level !== '1') {
					const all = await fetchAllMenuItems()
					if (!mounted) return
					const related = all.filter((it) => it.combo_level === fetched.combo_level && it.id !== fetched.id)
					if (related.length > 0) setComboItems(related)
				}
			} catch (err: any) {
				if (!mounted) return
				setError(err?.message ?? 'Failed to load item')
			} finally {
				if (mounted) setLoading(false)
			}
		}
		load()
		return () => {
			mounted = false
		}
	}, [id])

	if (loading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator size="large" />
			</View>
		)
	}
	if (error) {
		return (
			<View style={styles.center}>
				<Text style={styles.errorText}>{error}</Text>
				<Pressable onPress={() => router.back()} style={styles.backButton}>
					<Text style={styles.backText}>Go back</Text>
				</Pressable>
			</View>
		)
	}
	if (!item) {
		return (
			<View style={styles.center}>
				<Text>Item not available.</Text>
				<Pressable onPress={() => router.back()} style={styles.backButton}>
					<Text style={styles.backText}>Go back</Text>
				</Pressable>
			</View>
		)
	}

	const imageBase = 'https://app.trackerstay.com/storage/'
	const imgUri = item.image ? imageBase + item.image.replace(/^\/+/, '') : null

	return (
		<ScrollView contentContainerStyle={styles.container}>
			<Pressable onPress={() => router.back()} style={styles.backButton}>
				<Text style={styles.backText}>← Back</Text>
			</Pressable>

			{imgUri ? <Image source={{ uri: imgUri }} style={styles.hero} /> : <View style={[styles.hero, styles.placeholder]}><Text>No image</Text></View>}

			<Text style={styles.title}>{item.name}</Text>
			{item.special_note ? <Text style={styles.note}>{item.special_note}</Text> : null}
			<Text style={styles.price}>Rs {item.price}</Text>
			<Text style={styles.meta}>Item code: {item.item_code} • Available: {item.is_available ? 'Yes' : 'No'}</Text>
			<Text style={styles.meta}>Combo level: {item.combo_level ?? '-'}</Text>

			{comboItems && comboItems.length > 0 ? (
				<View style={styles.comboSection}>
					<Text style={styles.comboTitle}>Combo items</Text>
					{comboItems.map((c) => {
						const cImg = c.image ? imageBase + c.image.replace(/^\/+/, '') : null
						return (
							<View key={c.id} style={styles.comboRow}>
								{cImg ? <Image source={{ uri: cImg }} style={styles.comboImage} /> : <View style={[styles.comboImage, styles.placeholder]}><Text>No image</Text></View>}
								<View style={{ flex: 1, marginLeft: 10 }}>
									<Text style={{ fontWeight: '600' }}>{c.name}</Text>
									<Text style={{ color: '#666' }}>Rs {c.price}</Text>
								</View>
							</View>
						)
					})}
				</View>
			) : (
				// optionally show a hint when item is a combo but no items found
				item.combo_level && item.combo_level !== '1' ? <Text style={styles.hint}>This is a combo (level {item.combo_level}). Components not available.</Text> : null
			)}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: { padding: 12, marginTop: 20, paddingTop: 20, marginBottom: 20, paddingBottom: 40, backgroundColor: '#fff' },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
	hero: { width: '100%', height: 220, borderRadius: 8, backgroundColor: '#f2f2f2', marginBottom: 12, resizeMode: 'cover' as any },
	title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
	note: { color: '#444', marginBottom: 8 },
	price: { fontWeight: '700', marginBottom: 8 },
	meta: { color: '#666', marginBottom: 6 },
	comboSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 },
	comboTitle: { fontWeight: '700', marginBottom: 8 },
	comboRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
	comboImage: { width: 60, height: 60, borderRadius: 6, backgroundColor: '#f2f2f2' },
	backButton: { marginTop: 8, marginBottom: 12 },
	backText: { color: '#007aff' },
	errorText: { color: 'red' },
	placeholder: { alignItems: 'center', justifyContent: 'center' },
	hint: { marginTop: 10, color: '#666' },
})
