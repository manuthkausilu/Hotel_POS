import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import type { MenuItem } from '../../types/menu';

const { height } = Dimensions.get('window');

interface CartItem {
  entryId: string;
  item: MenuItem;
  quantity: number;
  combos?: { comboId: number; menuId: number; menu?: any }[];
  rowId?: string | number;
}

interface CartPanelProps {
  cart: CartItem[];
  visible: boolean;
  onToggle: () => void;
  onUpdateQuantity: (entryId: string, delta: number) => void;
  onRemoveItem: (entryId: string) => void;
  onPlaceOrder: () => void;
  onClearCart: () => void;
  editingRunningOrderId: number | null;
  isTabletMode?: boolean;
}

export default function CartPanel({
  cart,
  visible,
  onToggle,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
  onClearCart,
  editingRunningOrderId,
  isTabletMode = false,
}: CartPanelProps) {
  const cartTotal = cart.reduce((sum, c) => {
    const base = Number(c.item.price) || 0;
    const combosPrice = (c.combos || []).reduce((s, sc) => s + (Number(sc.menu?.price) || 0), 0);
    return sum + (base + combosPrice) * c.quantity;
  }, 0);

  if (!visible) return null;

  return (
    <View style={[styles.cartContainer, isTabletMode && styles.tabletCartContainer]}>
      <View style={styles.cartHeader}>
        <View>
          <Text style={[styles.cartTitle, isTabletMode && styles.tabletCartTitle]}>Cart</Text>
          <Text style={[styles.cartSubtitle, isTabletMode && styles.tabletCartSubtitle]}>
            {cart.length} {cart.length === 1 ? 'item' : 'items'} • Rs {cartTotal.toFixed(2)}
          </Text>
        </View>
        {!isTabletMode && (
          <TouchableOpacity onPress={onToggle} style={styles.hideCartButton}>
            <Text style={styles.hideCartText}>Hide</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.cartItemsWrapper, isTabletMode && styles.tabletCartItemsWrapper]}>
        <FlatList
          data={cart}
          keyExtractor={(c) => c.entryId}
          ItemSeparatorComponent={() => <View style={styles.cartDivider} />}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          renderItem={({ item: cartItem }) => (
            <View style={[styles.cartItem, isTabletMode && styles.tabletCartItem]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cartItemName, isTabletMode && styles.tabletCartItemName]} numberOfLines={2} ellipsizeMode="tail">
                  {cartItem.item.name}
                </Text>
                <Text style={[styles.cartItemMeta, isTabletMode && styles.tabletCartItemMeta]}>Rs {Number(cartItem.item.price).toFixed(2)}</Text>
                {cartItem.combos && cartItem.combos.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    {cartItem.combos.map((sc) => (
                      <Text key={String(sc.comboId)} style={[styles.comboText, isTabletMode && styles.tabletComboText]}>
                        + {sc.menu?.name ?? 'Option'}{' '}
                        {sc.menu?.price ? `• Rs ${Number(sc.menu.price).toFixed(2)}` : ''}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              <View style={[styles.qtyPill, styles.cartQtyPill, isTabletMode && styles.tabletCartQtyPill]}>
                <TouchableOpacity onPress={() => onUpdateQuantity(cartItem.entryId, -1)}>
                  <Text style={[styles.qtyPillButton, isTabletMode && styles.tabletCartQtyPillButton]}>-</Text>
                </TouchableOpacity>
                <Text style={[styles.qtyPillValue, isTabletMode && styles.tabletCartQtyPillValue]}>{cartItem.quantity}</Text>
                <TouchableOpacity onPress={() => onUpdateQuantity(cartItem.entryId, 1)}>
                  <Text style={[styles.qtyPillButton, isTabletMode && styles.tabletCartQtyPillButton]}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => onRemoveItem(cartItem.entryId)}>
                <Text style={[styles.removeText, isTabletMode && styles.tabletRemoveText]}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>

      <View style={[styles.cartActions, isTabletMode && styles.tabletCartActions]}>
        <TouchableOpacity style={[styles.placeOrderButton, isTabletMode && styles.tabletPlaceOrderButton]} onPress={onPlaceOrder}>
          <Text style={[styles.placeOrderText, isTabletMode && styles.tabletPlaceOrderText]}>
            {editingRunningOrderId ? 'Update Order' : 'Place Order'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.clearCartButton,
            editingRunningOrderId ? styles.clearCartButtonDanger : undefined,
            isTabletMode && styles.tabletClearCartButton,
          ]}
          onPress={onClearCart}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.clearCartButtonText,
              editingRunningOrderId ? styles.clearCartButtonTextDanger : undefined,
              isTabletMode && styles.tabletClearCartButtonText,
            ]}
          >
            {editingRunningOrderId ? 'Cancel Update' : 'Clear Cart'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cartContainer: { 
    position: 'absolute', 
    left: 16, 
    right: 16, 
    bottom: 100, 
    padding: 16, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 18, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 12, 
    elevation: 12, 
    borderWidth: 1, 
    borderColor: '#F3F4F6', 
    zIndex: 1000,
  },
  tabletCartContainer: {
    position: 'relative',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    zIndex: 1,
    height: '100%',
    maxHeight: height - 100,
  },
  cartHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12,
  },
  cartTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  cartSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  tabletCartTitle: { fontSize: 22, fontWeight: '800' },
  tabletCartSubtitle: { fontSize: 16, marginTop: 6 },
  hideCartButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' },
  hideCartText: { fontSize: 14, fontWeight: '600', color: '#FF6B6B' },
  cartItemsWrapper: { 
    height: height * 0.35,
    marginBottom: 12,
  },
  tabletCartItemsWrapper: {
    flex: 1,
    height: undefined,
    marginBottom: 16,
  },
  cartDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 },
  cartItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  tabletCartItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginBottom: 14,
  },
  cartItemName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cartItemMeta: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  tabletCartItemName: { fontSize: 17, fontWeight: '800' },
  tabletCartItemMeta: { fontSize: 15, marginTop: 6 },
  comboText: { color: '#666', fontSize: 13 },
  tabletComboText: { fontSize: 14, color: '#6B7280' },
  qtyPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#FF6B6B', backgroundColor: '#FFFFFF' },
  cartQtyPill: { marginHorizontal: 12 },
  tabletCartQtyPill: { marginHorizontal: 16 },
  qtyPillButton: { paddingHorizontal: 12, paddingVertical: 4, fontSize: 18, fontWeight: '700', color: '#FF6B6B' },
  tabletCartQtyPillButton: { paddingHorizontal: 16, paddingVertical: 6, fontSize: 20 },
  qtyPillValue: { minWidth: 26, textAlign: 'center', fontWeight: '700', color: '#111827' },
  tabletCartQtyPillValue: { minWidth: 32, fontSize: 16 },
  removeText: { fontSize: 14, fontWeight: '600', color: '#FF6B6B' },
  tabletRemoveText: { fontSize: 15, fontWeight: '700' },
  cartActions: {
    // actions container doesn't need special styling now
  },
  placeOrderButton: { backgroundColor: '#FF6B6B', paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF6B6B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  placeOrderText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  tabletPlaceOrderButton: { paddingVertical: 18, borderRadius: 12, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  tabletPlaceOrderText: { fontSize: 18, fontWeight: '900' },
  clearCartButton: { marginTop: 10, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  clearCartButtonDanger: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', shadowColor: '#DC2626', shadowOpacity: 0.1 },
  tabletClearCartButton: { marginTop: 12, paddingVertical: 16, borderRadius: 12 },
  clearCartButtonText: { color: '#374151', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },
  clearCartButtonTextDanger: { color: '#DC2626' },
  tabletClearCartButtonText: { fontSize: 16, fontWeight: '900' },
  tabletCartActions: {
    paddingTop: 8,
  },
});
