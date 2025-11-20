import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Dimensions, ActivityIndicator, Alert, Modal, TextInput, Switch, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchAllMenuItems, fetchMenuItemById } from '../../../services/menuService';
import { orderService } from '../../../services/orderService';
import type { MenuItem } from '../../../types/menu';

const { width, height } = Dimensions.get('window');
const imageBase = 'https://app.trackerstay.com/storage/';

export default function OrdersScreen() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<number>>(new Set());
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [detailedItems, setDetailedItems] = useState<Record<number, MenuItem>>({});
  const [detailLoading, setDetailLoading] = useState<Record<number, boolean>>({});
  const [cart, setCart] = useState<{item: MenuItem, quantity: number}[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [addQty, setAddQty] = useState<Record<number, number>>({});
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState({ tableId: '' });
  const [enableServiceCharge, setEnableServiceCharge] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        const items = await fetchAllMenuItems();
        setMenuItems(items);
      } catch (err) {
        setError('Failed to load menu items');
      } finally {
        setLoading(false);
      }
    };
    loadMenuItems();
  }, []);

  const toggleDetails = async (id: number) => {
    setExpandedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
        // Fetch details if not already fetched
        if (!detailedItems[id] && !detailLoading[id]) {
          setDetailLoading(prev => ({ ...prev, [id]: true }));
          fetchMenuItemById(id)
            .then(item => {
              if (item) {
                setDetailedItems(prev => ({ ...prev, [id]: item }));
              }
            })
            .catch(() => {})
            .finally(() => {
              setDetailLoading(prev => ({ ...prev, [id]: false }));
            });
        }
      }
      return newSet;
    });
  };

  const updateAddQty = (id: number, delta: number) => {
    setAddQty(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta)
    }));
  };

  const addToCart = (item: MenuItem) => {
    const qty = addQty[item.id] || 1;
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) {
        return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + qty } : c);
      } else {
        return [...prev, { item, quantity: qty }];
      }
    });
    // Reset qty after adding
    setAddQty(prev => ({ ...prev, [item.id]: 1 }));
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.item.id === id) {
        const newQty = c.quantity + delta;
        return newQty > 0 ? { ...c, quantity: newQty } : c;
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(c => c.item.id !== id));
  };

  const placeOrder = () => {
    setShowOrderModal(true);
  };

  const submitOrder = async () => {
    try {
      const orderId = orderService.createOrder(orderDetails.tableId);
      cart.forEach(c => {
        orderService.addItemToOrder(orderId, c.item, c.quantity);
      });
      // Update total with service charge if enabled
      const order = orderService.getOrder(orderId);
      if (order) {
        const serviceCharge = enableServiceCharge ? order.total * 0.1 : 0;
        order.total += serviceCharge;
      }
      await orderService.submitOrder(orderId);
      setCart([]);
      setShowCart(false);
      setShowOrderModal(false);
      setOrderDetails({ tableId: '' });
      setEnableServiceCharge(true);
      Alert.alert('Success', 'Order placed successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to place order');
    }
  };

  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text>{error}</Text>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orders</Text>
        <View style={styles.spacer} />
      </View>
      <Text style={styles.title}>All Menu Items</Text>
      <FlatList
        data={menuItems}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const imgUri = item.image ? imageBase + item.image.replace(/^\/+/, '') : null;
          return (
            <View>
              {expandedItemIds.has(item.id) && (
                <>
                  <View style={styles.detailsCard}>
                    {detailLoading[item.id] ? (
                      <ActivityIndicator size="small" />
                    ) : detailedItems[item.id] ? (
                      (() => {
                        const detail = detailedItems[item.id];
                        const detailImgUri = detail.image ? imageBase + detail.image.replace(/^\/+/, '') : null;
                        return (
                          <View>
                            {detailImgUri ? (
                              <Image source={{ uri: detailImgUri }} style={styles.detailHero} />
                            ) : (
                              <View style={[styles.detailHero, styles.placeholder]}>
                                <Text>No image</Text>
                              </View>
                            )}
                            <Text style={styles.detailTitle}>{detail.name}</Text>
                            {detail.special_note ? <Text style={styles.detailNote}>{detail.special_note}</Text> : null}
                            <Text style={styles.detailPrice}>Rs {detail.price}</Text>
                            <Text style={styles.detailMeta}>Item code: {detail.item_code} • Available: {detail.is_available ? 'Yes' : 'No'}</Text>
                            <Text style={styles.detailMeta}>Combo level: {detail.combo_level ?? '-'}</Text>
                            {detail.combo_items && detail.combo_items.length > 0 && (
                              <View style={styles.comboSection}>
                                <Text style={styles.comboTitle}>Combo items</Text>
                                {detail.combo_items.map((c) => {
                                  const cImg = c.image ? imageBase + c.image.replace(/^\/+/, '') : null;
                                  return (
                                    <View key={c.id} style={styles.comboRow}>
                                      {cImg ? <Image source={{ uri: cImg }} style={styles.comboImage} /> : <View style={[styles.comboImage, styles.placeholder]}><Text>No image</Text></View>}
                                      <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={{ fontWeight: '600' }}>{c.name}</Text>
                                        <Text style={{ color: '#666' }}>Rs {c.price}</Text>
                                      </View>
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })()
                    ) : (
                      <Text>Failed to load details</Text>
                    )}
                  </View>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.button} onPress={() => toggleDetails(item.id)}>
                      <Text style={styles.buttonText}>Hide Details</Text>
                    </TouchableOpacity>
                    <View style={styles.addControls}>
                      <TouchableOpacity onPress={() => updateAddQty(item.id, -1)}>
                        <Text style={styles.qtyButton}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{addQty[item.id] || 1}</Text>
                      <TouchableOpacity onPress={() => updateAddQty(item.id, 1)}>
                        <Text style={styles.qtyButton}>+</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addButton} onPress={() => addToCart(detailedItems[item.id] || item)}>
                        <Text style={styles.addButtonText}>Add to Cart</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
              <View style={styles.card}>
                {imgUri && !imageErrors[item.id] ? (
                  <Image
                    source={{ uri: imgUri }}
                    style={styles.image}
                    onError={() => setImageErrors(prev => ({ ...prev, [item.id]: true }))}
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
                  {!expandedItemIds.has(item.id) && (
                    <TouchableOpacity style={styles.button} onPress={() => toggleDetails(item.id)}>
                      <Text style={styles.buttonText}>Show Details</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />
      {cart.length > 0 && !showCart && (
        <TouchableOpacity style={styles.viewCartButton} onPress={() => setShowCart(true)}>
          <Text style={styles.viewCartText}>View Cart ({cart.length})</Text>
        </TouchableOpacity>
      )}
      {showCart && (
        <View style={styles.cartContainer}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Cart</Text>
            <TouchableOpacity onPress={() => setShowCart(false)}>
              <Text style={styles.hideCartText}>Hide</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={cart}
            keyExtractor={(c) => c.item.id.toString()}
            renderItem={({ item: cartItem }) => (
              <View style={styles.cartItem}>
                <Text style={styles.cartItemText} numberOfLines={1} ellipsizeMode="tail">{cartItem.item.name} - Rs {cartItem.item.price}</Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity onPress={() => updateQuantity(cartItem.item.id, -1)}>
                    <Text style={styles.qtyButton}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{cartItem.quantity}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(cartItem.item.id, 1)}>
                    <Text style={styles.qtyButton}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeFromCart(cartItem.item.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          />
          <TouchableOpacity style={styles.placeOrderButton} onPress={placeOrder}>
            <Text style={styles.placeOrderText}>Place Order</Text>
          </TouchableOpacity>
        </View>
      )}
      <Modal visible={showOrderModal} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}>
              <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Order Details</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Table ID"
                    value={orderDetails.tableId}
                    onChangeText={(text) => setOrderDetails(prev => ({ ...prev, tableId: text }))}
                  />
                  <View style={styles.serviceChargeRow}>
                    <Text>Enable Service Charge (10%)</Text>
                    <Switch value={enableServiceCharge} onValueChange={setEnableServiceCharge} />
                  </View>
                  {(() => {
                    const subtotal = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);
                    const serviceCharge = enableServiceCharge ? subtotal * 0.1 : 0;
                    const total = subtotal + serviceCharge;
                    return (
                      <View style={styles.billSummary}>
                        <Text>Subtotal: Rs {subtotal.toFixed(2)}</Text>
                        <Text>Service Charge: Rs {serviceCharge.toFixed(2)}</Text>
                        <Text style={styles.totalText}>Total: Rs {total.toFixed(2)}</Text>
                      </View>
                    );
                  })()}
                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => setShowOrderModal(false)}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.submitButton} onPress={submitOrder}>
                      <Text style={styles.submitText}>Submit Order</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
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
  button: { backgroundColor: '#007bff', padding: 10, marginTop: 10, borderRadius: 5 },
  buttonText: { color: '#fff', textAlign: 'center' },
  detailsCard: { marginTop: 10, padding: 12, borderRadius: 8, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee' },
  detailHero: { width: '100%', height: 150, borderRadius: 8, backgroundColor: '#f2f2f2', marginBottom: 12, resizeMode: 'cover' },
  detailTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  detailNote: { color: '#444', marginBottom: 8 },
  detailPrice: { fontWeight: '700', marginBottom: 8 },
  detailMeta: { color: '#666', marginBottom: 6 },
  comboSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 },
  comboTitle: { fontWeight: '700', marginBottom: 8 },
  comboRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  comboImage: { width: 60, height: 60, borderRadius: 6, backgroundColor: '#f2f2f2' },
  addButton: { backgroundColor: '#28a745', padding: 8, marginTop: 10, borderRadius: 5 },
  addButtonText: { color: '#fff', textAlign: 'center' },
  cartContainer: { marginTop: 20, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8 },
  cartTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  cartItem: { flexDirection: 'row', alignItems: 'center', padding: 5, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  cartItemText: { flex: 1, marginRight: 10 },
  removeText: { color: 'red' },
  buttonRow: { flexDirection: 'column', marginTop: 10 },
  viewCartButton: { backgroundColor: '#ff9800', padding: 12, borderRadius: 5, alignItems: 'center', marginTop: 10 },
  viewCartText: { color: '#fff', fontWeight: 'bold' },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  hideCartText: { color: '#007bff', fontWeight: 'bold' },
  quantityControls: { flexDirection: 'row', alignItems: 'center' },
  qtyButton: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 10, color: '#007bff' },
  qtyText: { fontSize: 16, marginHorizontal: 10 },
  addControls: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  placeOrderButton: { backgroundColor: '#dc3545', padding: 12, borderRadius: 5, alignItems: 'center', marginTop: 10 },
  placeOrderText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', padding: 30, borderRadius: 10, width: '95%', maxWidth: 700 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelButton: { backgroundColor: '#6c757d', padding: 10, borderRadius: 5 },
  cancelText: { color: '#fff' },
  submitButton: { backgroundColor: '#28a745', padding: 10, borderRadius: 5 },
  submitText: { color: '#fff' },
  serviceChargeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  billSummary: { marginBottom: 20 },
  totalText: { fontWeight: 'bold', fontSize: 18 },
  keyboardAvoid: { flex: 1, justifyContent: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: height > 600 && width > 300 ? 30 : 18, paddingHorizontal: width > 400 ? 12 : 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backButton: { padding: 5 },
  backText: { fontSize: width > 400 ? 16 : 14, color: '#007AFF' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: width > 400 ? 26 : 22, fontWeight: '700', marginHorizontal: 10 },
  spacer: { width: 50 },
});
