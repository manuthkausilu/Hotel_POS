import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Dimensions, Alert, Modal, TextInput, Switch, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchMenuData } from '../../../services/menuService';
import { orderService } from '../../../services/orderService';
import type { MenuItem, MenuResponse } from '../../../types/menu';

const { width, height } = Dimensions.get('window');
const imageBase = 'https://app.trackerstay.com/storage/';

export default function OrdersScreen() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [cart, setCart] = useState<{item: MenuItem, quantity: number}[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState({ tableId: '' });
  const [enableServiceCharge, setEnableServiceCharge] = useState(true);
  const [viewMode, setViewMode] = useState<'menu' | 'running'>('menu');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuData, setMenuData] = useState<MenuResponse | null>(null);
  const [categories, setCategories] = useState<{id: number | string, name?: string, label?: string}[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string | null>(null);

  const runningOrdersDemo = [
    {
      id: 'ORD-1001',
      tableId: 'T12',
      status: 'preparing',
      placedAt: '10:24 AM',
      staff: 'Nimal',
      total: 3450,
      items: [
        { name: 'Chicken Fried Rice', quantity: 2 },
        { name: 'Lemon Iced Tea', quantity: 2 },
      ],
    },
    {
      id: 'ORD-1002',
      tableId: 'T04',
      status: 'ready',
      placedAt: '10:32 AM',
      staff: 'Dilshi',
      total: 1880,
      items: [
        { name: 'Cheese Kottu', quantity: 1 },
        { name: 'Fresh Juice', quantity: 1 },
      ],
    },
    {
      id: 'ORD-1003',
      tableId: 'T19',
      status: 'served',
      placedAt: '10:40 AM',
      staff: 'Sahan',
      total: 4120,
      items: [
        { name: 'BBQ Platter', quantity: 1 },
        { name: 'Mocktail', quantity: 2 },
      ],
    },
  ];
  const router = useRouter();
  const statusStyleFor = (status: string) => {
    switch (status) {
      case 'ready':
        return styles.status_ready;
      case 'served':
        return styles.status_served;
      default:
        return styles.status_preparing;
    }
  };

  useEffect(() => {
    const loadMenuData = async () => {
      try {
        const data = await fetchMenuData();
        setMenuData(data);
        const normalizedCategories = (data.categories || []).map((cat: any, index: number) => {
          if (cat && typeof cat === 'object') {
            const idValue = cat.id ?? cat.category_id ?? index;
            const label =
              cat.label ??
              cat.name ??
              cat.category_name ??
              cat.title ??
              `Category ${idValue ?? index + 1}`;
            return { ...cat, id: idValue, label };
          }
          if (typeof cat === 'string') {
            return { id: cat, label: cat };
          }
          if (typeof cat === 'number') {
            return { id: cat, label: `Category ${cat}` };
          }
          return { id: index, label: `Category ${index + 1}` };
        });
        setCategories(normalizedCategories);
        setMenuItems(data.menus);
      } catch (err) {
        setError('Failed to load menu data');
      } finally {
        setLoading(false);
      }
    };
    loadMenuData();
  }, []);

  const addToCart = (item: MenuItem) => {
    const qty = 1;
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) {
        return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + qty } : c);
      } else {
        return [...prev, { item, quantity: qty }];
      }
    });
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

  const filteredMenuItems = selectedCategoryId
    ? menuItems.filter(item => menuData?.recipeCategoriesWithMenus?.[String(selectedCategoryId)]?.includes(item.id))
    : menuItems;

  const renderMenuItems = () => {
    const cartTotal = cart.reduce((sum, c) => sum + Number(c.item.price) * c.quantity, 0);

    return (
      <>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Trackerstay</Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{filteredMenuItems.length} items</Text>
          </View>
        </View>

        {/* Category area: fixed min height so layout doesn't jump when count/rows change */}
        <View style={styles.categoryArea}>
        {categories.length > 0 && (() => {
           // build a categories data array that always includes "All" as first item
           const flatCats = [{ id: '__all__', label: 'All' }, ...categories.map((c) => ({ id: c.id ?? String(c), label: c.label ?? c.name ?? String(c) }))];
 
           return (
             <FlatList
               horizontal
               data={flatCats}
               keyExtractor={(item) => String(item.id)}
               showsHorizontalScrollIndicator={false}
               contentContainerStyle={styles.categoryListContent}
               style={styles.categoryList}
               extraData={selectedCategoryId}
               removeClippedSubviews={false} // avoid Android clipping issues
               initialNumToRender={Math.min(10, flatCats.length)}
               maxToRenderPerBatch={10}
               windowSize={11}               // larger window to avoid virtualization hiding items while scrolling
               nestedScrollEnabled={true}    // helps nested scroll behaviors on Android
               scrollEnabled={true}
               keyboardShouldPersistTaps="handled"
               renderItem={({ item }) => {
                 const isAll = item.id === '__all__';
                 const catId = isAll ? null : item.id;
                 const isActive = (isAll && selectedCategoryId === null) || (!isAll && String(selectedCategoryId) === String(item.id));
                 return (
                   <TouchableOpacity
                     activeOpacity={0.85}
                     onPress={() => setSelectedCategoryId(catId)}
                     style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                   >
                     <Text
                       style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}
                       numberOfLines={1}
                       allowFontScaling={false}
                     >
                       {item.label}
                     </Text>
                   </TouchableOpacity>
                 );
               }}
             />
           );
        })()}
        </View>

        <FlatList
          data={filteredMenuItems}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.menuList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const imgUri = item.image ? imageBase + item.image.replace(/^\/+/, '') : null;
            const cartEntry = cart.find(c => c.item.id === item.id);
            const quantity = cartEntry?.quantity ?? 0;
            const isAvailable = item.is_available !== 0;

            return (
              <View style={styles.menuCard}>
                <View style={styles.menuImageWrapper}>
                  <View style={[styles.availabilityDot, !isAvailable && styles.availabilityDotOff]} />
                  {imgUri && !imageErrors[item.id] ? (
                    <Image
                      source={{ uri: imgUri }}
                      style={styles.menuImage}
                      onError={() => setImageErrors(prev => ({ ...prev, [item.id]: true }))}
                    />
                  ) : (
                    <View style={[styles.menuImage, styles.placeholder]}>
                      <Text style={styles.placeholderText}>No image</Text>
                    </View>
                  )}
                </View>
                <View style={styles.menuInfo}>
                  <Text style={styles.menuTitle}>{item.name}</Text>
                  {item.special_note ? (
                    <Text style={styles.menuMeta}>{item.special_note}</Text>
                  ) : item.item_code ? (
                    <Text style={styles.menuMeta}>Item code • {item.item_code}</Text>
                  ) : null}
                  <View style={styles.menuFooter}>
                    <Text style={styles.menuPrice}>Rs {Number(item.price).toFixed(2)}</Text>
                    {quantity > 0 ? (
                      <View style={styles.qtyPill}>
                        <TouchableOpacity onPress={() => updateQuantity(item.id, -1)}>
                          <Text style={styles.qtyPillButton}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyPillValue}>{quantity}</Text>
                        <TouchableOpacity onPress={() => updateQuantity(item.id, 1)}>
                          <Text style={styles.qtyPillButton}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.addBadge} onPress={() => addToCart(item)}>
                        <Text style={styles.addBadgeText}>+ ADD</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 80 }} />}
        />
        {cart.length > 0 && !showCart && (
          <TouchableOpacity style={styles.cartSummaryBar} onPress={() => setShowCart(true)} activeOpacity={0.9}>
            <View>
              <Text style={styles.cartSummaryItems}>{cart.length} {cart.length === 1 ? 'Item' : 'Items'}</Text>
              <Text style={styles.cartSummaryTotal}>Rs {cartTotal.toFixed(2)}</Text>
            </View>
            <Text style={styles.cartSummaryCta}>View Cart</Text>
          </TouchableOpacity>
        )}
        {showCart && (
          <View style={styles.cartContainer}>
            <View style={styles.cartHeader}>
              <View>
                <Text style={styles.cartTitle}>Cart</Text>
                <Text style={styles.cartSubtitle}>{cart.length} {cart.length === 1 ? 'item' : 'items'} • Rs {cartTotal.toFixed(2)}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCart(false)}>
                <Text style={styles.hideCartText}>Hide</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={cart}
              keyExtractor={(c) => c.item.id.toString()}
              ItemSeparatorComponent={() => <View style={styles.cartDivider} />}
              renderItem={({ item: cartItem }) => (
                <View style={styles.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName} numberOfLines={1} ellipsizeMode="tail">{cartItem.item.name}</Text>
                    <Text style={styles.cartItemMeta}>Rs {Number(cartItem.item.price).toFixed(2)}</Text>
                  </View>
                  <View style={[styles.qtyPill, styles.cartQtyPill]}>
                    <TouchableOpacity onPress={() => updateQuantity(cartItem.item.id, -1)}>
                      <Text style={styles.qtyPillButton}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyPillValue}>{cartItem.quantity}</Text>
                    <TouchableOpacity onPress={() => updateQuantity(cartItem.item.id, 1)}>
                      <Text style={styles.qtyPillButton}>+</Text>
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
      </>
    );
  };

  const renderRunningOrders = () => (
    <>
      <Text style={styles.title}>Running Orders</Text>
      <FlatList
        data={runningOrdersDemo}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No running orders right now.</Text>}
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderId}>{item.id}</Text>
              <Text style={[styles.statusBadge, statusStyleFor(item.status)]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.orderMeta}>Table {item.tableId} • Placed {item.placedAt}</Text>
            <Text style={styles.orderMeta}>Handled by {item.staff}</Text>
            <View style={styles.orderItems}>
              {item.items.map((orderItem, idx) => (
                <View key={`${item.id}-${orderItem.name}-${idx}`} style={styles.orderItemRow}>
                  <Text style={styles.orderItemName}>{orderItem.name}</Text>
                  <Text style={styles.orderItemQty}>x{orderItem.quantity}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.orderTotal}>Total: Rs {item.total.toFixed(2)}</Text>
            <View style={styles.orderActions}>
              <TouchableOpacity style={styles.primaryAction}>
                <Text style={styles.primaryActionText}>Mark as Done</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>View Ticket</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orders</Text>
        <View style={styles.spacer} />
      </View>
      <View style={styles.dropdownWrapper}>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setDropdownOpen(prev => !prev)}
          activeOpacity={0.8}
        >
          <Text style={styles.dropdownText}>
            {viewMode === 'menu' ? 'Menu Items' : 'Running Orders'}
          </Text>
          <Text style={styles.dropdownCaret}>{dropdownOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {dropdownOpen && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity
              style={styles.dropdownOption}
              onPress={() => {
                setViewMode('menu');
                setDropdownOpen(false);
              }}
            >
              <Text style={[styles.dropdownOptionText, viewMode === 'menu' && styles.dropdownOptionActive]}>
                Menu Items
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownOption}
              onPress={() => {
                setViewMode('running');
                setDropdownOpen(false);
              }}
            >
              <Text style={[styles.dropdownOptionText, viewMode === 'running' && styles.dropdownOptionActive]}>
                Running Orders
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {viewMode === 'menu' ? renderMenuItems() : renderRunningOrders()}
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
                    const subtotal = cart.reduce((sum, c) => sum + Number(c.item.price) * c.quantity, 0);
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
  container: { flex: 1, padding: 10, backgroundColor: '#f8f8f8' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#111' },
  list: { paddingBottom: 24 },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: '#111' },
  sectionSubtitle: { color: '#777', marginTop: 4 },
  sectionBadge: {
    backgroundColor: '#ffe6e6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 72,          // make badge width stable even when number length changes
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: { color: '#ff4d4f', fontWeight: '600', textAlign: 'center' },
  categoryList: { marginBottom: 10 }, // keep spacing consistent; container manages height
  categoryListContent: { paddingHorizontal: 14, alignItems: 'center', paddingVertical: 6 },
  categoryArea: {
    minHeight: 64,        // fixed area so layout doesn't jump when items change
    justifyContent: 'center',
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 10, // enough vertical padding for touch target & to prevent clipping
    minHeight: 40,
    borderRadius: 24,
    backgroundColor: '#f1f1f1',
    marginRight: 10,
    minWidth: 72, // give pills room so text doesn't collapse
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    alignSelf: 'center',
  },
  categoryPillActive: { backgroundColor: '#ff6b6b' },
  categoryLabel: { fontSize: 14, fontWeight: '600', color: '#555', includeFontPadding: false, lineHeight: 18 },
  categoryLabelActive: { color: '#fff' },
  menuList: { paddingBottom: 160 },
  menuCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#fff',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  menuImageWrapper: { marginRight: 14 },
  availabilityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#27ae60',
    position: 'absolute',
    top: -4,
    right: -4,
    zIndex: 2,
  },
  availabilityDotOff: { backgroundColor: '#b0b0b0' },
  menuImage: { width: 90, height: 90, borderRadius: 14, backgroundColor: '#f2f2f2', resizeMode: 'cover' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#888', fontSize: 12 },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  menuMeta: { marginTop: 4, color: '#777', fontSize: 13 },
  menuFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  menuPrice: { fontSize: 18, fontWeight: '700', color: '#ff4d4f' },
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ffd6d1',
    backgroundColor: '#fff4f1',
  },
  cartQtyPill: { marginHorizontal: 12 },
  qtyPillButton: { paddingHorizontal: 12, paddingVertical: 4, fontSize: 18, fontWeight: '700', color: '#ff6b6b' },
  qtyPillValue: { minWidth: 26, textAlign: 'center', fontWeight: '700', color: '#ff6b6b' },
  addBadge: { backgroundColor: '#fff3e0', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 18 },
  addBadgeText: { color: '#ff6b00', fontWeight: '700', letterSpacing: 0.4 },
  cartSummaryBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: '#ff6b6b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  cartSummaryItems: { color: '#ffecec', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  cartSummaryTotal: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cartSummaryCta: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cartContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cartTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  cartSubtitle: { color: '#777', marginTop: 4 },
  hideCartText: { color: '#ff6b6b', fontWeight: '700' },
  cartDivider: { height: 1, backgroundColor: '#f1f1f1', marginVertical: 12 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  cartItemName: { fontWeight: '600', color: '#111' },
  cartItemMeta: { color: '#999', fontSize: 12, marginTop: 2 },
  removeText: { color: '#ff4d4f', marginLeft: 12, fontWeight: '600' },
  placeOrderButton: { backgroundColor: '#111827', padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 18 },
  placeOrderText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  keyboardAvoid: { flex: 1, justifyContent: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: height > 600 && width > 300 ? 30 : 18,
    paddingHorizontal: width > 400 ? 12 : 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { padding: 5 },
  backText: { fontSize: width > 400 ? 16 : 14,	color: '#007AFF' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: width > 400 ? 26 : 22, fontWeight: '700', marginHorizontal: 10 },
  spacer: { width: 50 },
  dropdownWrapper: { marginVertical: 10, zIndex: 2 },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  dropdownText: { fontSize: 16, fontWeight: '600' },
  dropdownCaret: { fontSize: 16, color: '#666' },
  dropdownMenu: {
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownOption: { paddingHorizontal: 14, paddingVertical: 12 },
  dropdownOptionText: { fontSize: 16, color: '#333' },
  dropdownOptionActive: { color: '#007AFF', fontWeight: '600' },
  orderCard: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 14,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 16, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  status_preparing: { backgroundColor: '#ff9800' },
  status_ready: { backgroundColor: '#28a745' },
  status_served: { backgroundColor: '#6366F1' },
  orderMeta: { color: '#666', marginTop: 4 },
  orderItems: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#f1f1f1', paddingTop: 10 },
  orderItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orderItemName: { fontWeight: '500', color: '#333', flex: 1, marginRight: 12 },
  orderItemQty: { fontWeight: '600', color: '#111' },
  orderTotal: { fontWeight: '700', fontSize: 16, marginTop: 8 },
  orderActions: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  primaryAction: {
    flex: 1,
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 8,
  },
  primaryActionText: { color: '#fff', fontWeight: '600' },
  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginLeft: 8,
  },
  secondaryActionText: { color: '#333', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 30 },
});
