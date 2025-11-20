'use client'
import { useRouter } from 'expo-router'; // <--- added
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { fetchAllMenuItems } from '../../../services/menuService';
import type { MenuItem } from '../../../types/menu';

const { width, height } = Dimensions.get('window');

export default function MenuPage() {
	const [items, setItems] = useState<MenuItem[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({}) // Add state for image errors per item
	const router = useRouter() // <--- added

	useEffect(() => {
		let mounted = true
		async function load() {
			try {
				setLoading(true)
				const result = await fetchAllMenuItems()
				if (!mounted) return
				setItems(result)
			} catch (err: any) {
				if (!mounted) return
				setError(err?.message ?? 'Failed to load menu')
			} finally {
				if (mounted) setLoading(false)
			}
		}
		load()
		return () => {
			mounted = false
		}
	}, [])

	if (loading) {
		return (
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.center}>
					<ActivityIndicator size="large" />
					<Text style={styles.loadingText}>Loading menu...</Text>
				</View>
			</SafeAreaView>
		)
	}
	if (error) {
		return (
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.center}>
					<Text style={styles.errorText}>Error: {error}</Text>
				</View>
			</SafeAreaView>
		)
	}
	if (!items || items.length === 0) {
		return (
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.center}>
					<Text>No menu items found.</Text>
				</View>
			</SafeAreaView>
		)
	}

	const imageBase = 'https://app.trackerstay.com/storage/'

	return (
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.header}>
				<Pressable onPress={() => router.push('/')} style={styles.backButton}>
					<Text style={styles.backText}>Back</Text>
				</Pressable>
				<Text style={styles.headerTitle}>Menu</Text>
				<View style={styles.spacer} />
			</View>
			<View style={styles.container}>
				<FlatList
					data={items}
					keyExtractor={(it) => String(it.id)}
					contentContainerStyle={styles.list}
					renderItem={({ item }) => {
						const imgUri = item.image ? imageBase + item.image.replace(/^\/+/, '') : null
						return (
							<Pressable
								onPress={() => router.push(`/menu/${item.id}`)} // <--- changed: navigate on press
								style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
							>
								<View style={styles.card}>
									{imgUri && !imageErrors[item.id] ? (
										<Image
											source={{ uri: imgUri }}
											style={styles.image}
											onError={() => setImageErrors(prev => ({ ...prev, [item.id]: true }))} // Update error state for this item
										/>
									) : (
										<View style={[styles.image, styles.placeholder]}>
											<Text style={styles.placeholderText}>No image</Text>
										</View>
									)}
									<View style={styles.info}>
										<Text style={styles.name}>{item.name}</Text>
										{item.special_note ? <Text style={styles.note}>{item.special_note}</Text> : null}
										<Text style={styles.price}>Rs {item.price}</Text>
									</View>
								</View>
							</Pressable>
						)
					}}
				/>
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: '#fff' },
	header: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: height > 600 && width > 300 ? 30 : 18, paddingHorizontal: width > 400 ? 12 : 10, backgroundColor: '#fff' },
	backButton: { padding: 5 },
	backText: { fontSize: width > 400 ? 16 : 14, color: '#007AFF' },
	headerTitle: { flex: 1, textAlign: 'center', fontSize: width > 400 ? 26 : 22, fontWeight: '700', marginHorizontal: 10 },
	spacer: { width: 50 },
	container: { flex: 1, paddingHorizontal: width > 400 ? 12 : 10, paddingBottom: 12 },
	list: { paddingBottom: 24 },
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		borderRadius: 8,
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#eee',
		marginBottom: 12,
	},
	image: { width: 80, height: 80, borderRadius: 6, resizeMode: 'cover', backgroundColor: '#f2f2f2' },
	placeholder: { alignItems: 'center', justifyContent: 'center' },
	placeholderText: { color: '#888' },
	info: { flex: 1, marginLeft: 12 },
	name: { fontWeight: '600', fontSize: 16 },
	note: { color: '#666', marginTop: 6 },
	price: { marginTop: 8, fontWeight: '700' },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	loadingText: { marginTop: 8 },
	errorText: { color: 'red' },
})
