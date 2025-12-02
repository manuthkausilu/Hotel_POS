// OrdersScreen: displays menu items, cart UI and order submission modal.
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Dimensions, Alert, Modal, TextInput, Switch, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchMenuData, fetchMenuItemByIdEndpoint } from '../../../services/menuService';
import { orderService } from '../../../services/orderService';
import type { MenuItem, MenuResponse } from '../../../types/menu';

const { width, height } = Dimensions.get('window');
const imageBase = 'https://app.trackerstay.com/storage/';

export default function OrdersScreen() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  // replace simple cart with entryId-based cart supporting combos
  const [cart, setCart] = useState<{ entryId: string, item: MenuItem, quantity: number, combos?: { comboId: number, menuId: number, menu?: any }[] }[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState<{
    tableId: string;
    orderType?: string;
    customer?: { id: string; name: string };
    room?: { id: string; name: string };
    stewardId?: string | null;
  }>({ tableId: '' });
  const [enableServiceCharge, setEnableServiceCharge] = useState(true);
  const [menuData, setMenuData] = useState<MenuResponse | null>(null);
  const [categories, setCategories] = useState<{id: number | string, name?: string, label?: string}[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string | null>(null);

  // add search state
  const [searchQuery, setSearchQuery] = useState<string>(
    ''
  );

  // combo modal state
  const [comboModalVisible, setComboModalVisible] = useState(false);
  const [comboContext, setComboContext] = useState<{ baseItem: MenuItem | null, combos: any[] } | null>(null);
  const [selectedComboChoices, setSelectedComboChoices] = useState<Record<string | number, number>>({});

  // steward list intentionally empty to reflect "steward list danata null thiyanna"
  const [stewardList, setStewardList] = useState<{ id: string; name: string }[]>([]);

  // selection modal (reused for customer/room/steward)
  const [selectionModalVisible, setSelectionModalVisible] = useState(false);
  const [selectionModalContext, setSelectionModalContext] = useState<'customer' | 'room' | 'steward' | 'table' | null>(null);
  const [selectionModalOptions, setSelectionModalOptions] = useState<{ id: string; label: string }[]>([]);

  // placed order modal
  const [orderPlacedModalVisible, setOrderPlacedModalVisible] = useState(false);
  const [placedOrderSummary, setPlacedOrderSummary] = useState<any | null>(null);

  const router = useRouter();

  // default simple options (walk-in)
  const orderTypeOptions = [{ id: 'dine_in', label: 'Dine In' }, { id: 'takeaway', label: 'Takeaway' }];
  const customerOptions = [{ id: 'walk_in', label: 'Walk In Customer' }];
  const roomOptions = [{ id: 'walk_in', label: 'Walk In Customer' }];
  const tableOptions = [
    { id: '', label: 'None' },           // default
    { id: '1', label: 'Table 1' },
    { id: '2', label: 'Table 2' },
    { id: '3', label: 'Table 3' },
  ];

  // helper to open selection modal for customers/rooms/stewards
  const openSelectionModal = (ctx: 'customer' | 'room' | 'steward' | 'table') => {
    setSelectionModalContext(ctx);
    if (ctx === 'customer') setSelectionModalOptions(customerOptions);
    else if (ctx === 'room') setSelectionModalOptions(roomOptions);
    else if (ctx === 'table') setSelectionModalOptions(tableOptions);
    else {
      const opts = stewardList.length > 0 ? stewardList.map(s => ({ id: s.id, label: s.name })) : [{ id: 'none', label: 'None' }];
      setSelectionModalOptions(opts);
    }
    setSelectionModalVisible(true);
  };

  const chooseSelectionOption = (option: { id: string; label: string }) => {
    if (!selectionModalContext) return;
    if (selectionModalContext === 'customer') {
      setOrderDetails(prev => ({ ...prev, customer: { id: option.id, name: option.label } }));
    } else if (selectionModalContext === 'room') {
      setOrderDetails(prev => ({ ...prev, room: { id: option.id, name: option.label } }));
    } else if (selectionModalContext === 'steward') {
      setOrderDetails(prev => ({ ...prev, stewardId: option.id === 'none' ? null : option.id }));
    } else if (selectionModalContext === 'table') {
      // option.id '' means None
      setOrderDetails(prev => ({ ...prev, tableId: option.id }));
    }
    setSelectionModalVisible(false);
    setSelectionModalContext(null);
  };

  // ensure defaults are present when resetting or new order
  useEffect(() => {
    setOrderDetails(prev => ({
      tableId: prev.tableId ?? '',
      orderType: prev.orderType ?? 'Dine In',
      customer: prev.customer ?? { id: 'walk_in', name: 'Walk In Customer' },
      room: prev.room ?? { id: 'walk_in', name: 'Walk In Customer' },
      stewardId: prev.stewardId ?? null,
    }));
  }, []);

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

  // helper: prefer plain (no combos) entry for a menu id, else return first entryId
  const findPreferredEntryId = (menuId: number | string) => {
    const plain = cart.find(c => String(c.item.id) === String(menuId) && (!c.combos || c.combos.length === 0));
    if (plain) return plain.entryId;
    const anyEntry = cart.find(c => String(c.item.id) === String(menuId));
    return anyEntry?.entryId;
  };

  const addToCart = async (item: MenuItem) => {
    // fetch full item details from endpoint (may include combo structure)
    let detailed: any = null;
    try {
      detailed = await fetchMenuItemByIdEndpoint(Number(item.id));
    } catch (e) {
      detailed = null;
    }

    // fallback to provided item when endpoint doesn't return details
    const menuDetail = detailed ?? item;

    const rawCombos = (menuDetail as any).combo ?? (menuDetail as any).combo_items ?? null;
    if (rawCombos && Array.isArray(rawCombos) && rawCombos.length > 0) {
      const combos = rawCombos.map((c: any, idx: number) => {
        const comboItems = Array.isArray(c.combo_item) ? c.combo_item : (c.combo_item ? [c.combo_item] : []);
        return { ...c, combo_item: comboItems };
      });

      // defaults: select first option for each combo
      const defaults: Record<string | number, number> = {};
      combos.forEach((c: any, idx: number) => {
        const firstCi = (c.combo_item && c.combo_item[0]) || null;
        const firstMenuId =
          firstCi?.menu?.id ??
          firstCi?.menu_id ??
          firstCi?.id ??
          c.menu_id ??
          c.id ??
          idx;
        const key = c.id ?? idx;
        defaults[key] = firstMenuId;
      });

      setComboContext({ baseItem: menuDetail, combos });
      setSelectedComboChoices(defaults);
      setComboModalVisible(true);
      return;
    }

    // no combos — add plain entry (aggregate plain entries by merging)
    const qty = 1;
    setCart(prev => {
      const existingIndex = prev.findIndex(c => !c.combos && c.item.id === menuDetail.id);
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = { ...copy[existingIndex], quantity: copy[existingIndex].quantity + qty };
        return copy;
      } else {
        const entryId = `${menuDetail.id}-${Date.now()}`;
        return [...prev, { entryId, item: menuDetail, quantity: qty }];
      }
    });
  };

  const confirmAddWithCombos = () => {
    if (!comboContext || !comboContext.baseItem) return;
    const base = comboContext.baseItem;
    const selectedCombos = comboContext.combos.map((c: any, idx: number) => {
      const key = c.id ?? idx;
      const chosenMenuId = selectedComboChoices[key];
      const chosenMenu = (c.combo_item || []).find((ci: any) => {
        const m = ci.menu ?? ci;
        return String(m?.id ?? ci.menu_id ?? ci.id) === String(chosenMenuId);
      })?.menu ?? (c.combo_item || []).find((ci:any)=>String(ci?.menu_id ?? ci?.id)===String(chosenMenuId)) ?? null;
      return { comboId: c.id ?? idx, menuId: chosenMenuId, menu: chosenMenu ?? null };
    });

    setCart(prev => {
      // try to find identical entry (same base id and same combo selections)
      const matchIndex = prev.findIndex(p => {
        if (p.item.id !== base.id) return false;
        const a = p.combos ?? [];
        const b = selectedCombos.map(sc => ({ comboId: sc.comboId, menuId: sc.menuId }));
        return JSON.stringify(a.map(x => ({ comboId: x.comboId, menuId: x.menuId }))) === JSON.stringify(b);
      });
      if (matchIndex >= 0) {
        const copy = [...prev];
        copy[matchIndex] = { ...copy[matchIndex], quantity: copy[matchIndex].quantity + 1 };
        return copy;
      }
      const entryId = `${base.id}-combo-${Date.now()}`;
      return [...prev, { entryId, item: base, quantity: 1, combos: selectedCombos }];
    });

    setComboModalVisible(false);
    setComboContext(null);
    setSelectedComboChoices({});
  };

  // updateQuantity and removeFromCart operate on entryId
  const updateQuantity = (entryId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.entryId === entryId) {
        const newQty = c.quantity + delta;
        return newQty > 0 ? { ...c, quantity: newQty } : c;
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const removeFromCart = (entryId: string) => {
    setCart(prev => prev.filter(c => c.entryId !== entryId));
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

      // Prepare placed order summary to show in a modal
      const subtotal = cart.reduce((sum, c) => sum + Number(c.item.price) * c.quantity, 0);
      const serviceCharge = enableServiceCharge ? subtotal * 0.1 : 0;
      const total = subtotal + serviceCharge;
      const tableLabel = tableOptions.find(t => String(t.id) === String(orderDetails.tableId))?.label ?? (orderDetails.tableId || 'None');

      setPlacedOrderSummary({
        orderId,
        tableId: orderDetails.tableId,
        tableLabel,
        orderType: orderDetails.orderType ?? 'Dine In',
        customer: orderDetails.customer ?? { id: 'walk_in', name: 'Walk In Customer' },
        room: orderDetails.room ?? { id: 'walk_in', name: 'Walk In Customer' },
        stewardId: orderDetails.stewardId ?? null,
        items: cart.map(c => ({ name: c.item.name, qty: c.quantity, price: Number(c.item.price) })),
        subtotal,
        serviceCharge,
        total,
      });

      setCart([]);
      setShowCart(false);
      setShowOrderModal(false);
      setOrderPlacedModalVisible(true);

      // reset order details to defaults
      setOrderDetails({
        tableId: '',
        orderType: 'Dine In',
        customer: { id: 'walk_in', name: 'Walk In Customer' },
        room: { id: 'walk_in', name: 'Walk In Customer' },
        stewardId: null,
      });
      setEnableServiceCharge(true);
      // we no longer use alert here; show placed modal instead
    } catch (err) {
      Alert.alert('Error', 'Failed to place order');
      // Close order modal and any selection/combo overlays; dismiss keyboard.
      setShowOrderModal(false);
      setSelectionModalVisible(false);
      setComboModalVisible(false);
      Keyboard.dismiss();
      // Re-open cart after a short delay so touch handlers are active.
      setTimeout(() => setShowCart(true), 50);
    }
  };

  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text>{error}</Text>;

  // replace filteredMenuItems to respect category + search
  const filteredMenuItems = menuItems.filter(item => {
    // category filter
    if (selectedCategoryId) {
      const catList = menuData?.recipeCategoriesWithMenus?.[String(selectedCategoryId)];
      if (!catList || !catList.includes(item.id)) return false;
    }
    // search filter (case-insensitive, matches name, item_code, special_note)
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      const name = (item.name ?? '').toString().toLowerCase();
      const code = (item.item_code ?? '').toString().toLowerCase();
      const note = (item.special_note ?? '').toString().toLowerCase();
      if (!name.includes(q) && !code.includes(q) && !note.includes(q)) return false;
    }
    return true;
  });

  const renderMenuItems = () => {
    // cart total includes combo item prices (if provided)
    const cartTotal = cart.reduce((sum, c) => {
      const base = Number(c.item.price) || 0;
      const combosPrice = (c.combos || []).reduce((s, sc) => s + (Number(sc.menu?.price) || 0), 0);
      return sum + (base + combosPrice) * c.quantity;
    }, 0);

    return (
      <>
        {/* Replace the inline search/header block with a modern search bar */}
        <View style={styles.searchBar}>
          <View style={styles.searchInputWrapper}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search items..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              underlineColorAndroid="transparent"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{filteredMenuItems.length} items</Text>
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
            // aggregated quantity for this menu id
            const aggregatedQty = cart.filter(c => String(c.item.id) === String(item.id)).reduce((s, c) => s + c.quantity, 0);
            const cartEntryPreferredId = findPreferredEntryId(item.id);
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
                    {aggregatedQty > 0 ? (
                      <View style={styles.qtyPill}>
                        <TouchableOpacity onPress={() => cartEntryPreferredId && updateQuantity(cartEntryPreferredId, -1)}>
                          <Text style={styles.qtyPillButton}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyPillValue}>{aggregatedQty}</Text>
                        <TouchableOpacity onPress={() => cartEntryPreferredId && updateQuantity(cartEntryPreferredId, 1)}>
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
              keyExtractor={(c) => c.entryId}
              ItemSeparatorComponent={() => <View style={styles.cartDivider} />}
              renderItem={({ item: cartItem }) => (
                <View style={styles.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName} numberOfLines={1} ellipsizeMode="tail">{cartItem.item.name}</Text>
                    <Text style={styles.cartItemMeta}>Rs {Number(cartItem.item.price).toFixed(2)}</Text>
                    {cartItem.combos && cartItem.combos.length > 0 && (
                      <View style={{ marginTop: 6 }}>
                        {cartItem.combos.map((sc) => (
                          <Text key={String(sc.comboId)} style={{ color: '#666', fontSize: 13 }}>
                            + {sc.menu?.name ?? 'Option'} {sc.menu?.price ? `• Rs ${Number(sc.menu.price).toFixed(2)}` : ''}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={[styles.qtyPill, styles.cartQtyPill]}>
                    <TouchableOpacity onPress={() => updateQuantity(cartItem.entryId, -1)}>
                      <Text style={styles.qtyPillButton}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyPillValue}>{cartItem.quantity}</Text>
                    <TouchableOpacity onPress={() => updateQuantity(cartItem.entryId, 1)}>
                      <Text style={styles.qtyPillButton}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => removeFromCart(cartItem.entryId)}>
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

  return (
    <View style={styles.container}>
      {/* <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orders</Text>
        <View style={styles.spacer} />
      </View>*/}
      {renderMenuItems()}
      <Modal visible={showOrderModal} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}>
              <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Order Details</Text>

                  <TouchableOpacity style={[styles.input, styles.selectRow]} onPress={() => openSelectionModal('table')}>
                    <Text style={{ color: '#6B7280' }}>Table</Text>
                    <Text style={styles.selectValue}>
                      {(() => {
                        const sel = tableOptions.find(t => String(t.id) === String(orderDetails.tableId));
                        return sel ? sel.label : (orderDetails.tableId ? String(orderDetails.tableId) : 'None');
                      })()}
                    </Text>
                  </TouchableOpacity>

                  {/* order type segmented control */}
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ marginBottom: 6 }}>Order Type</Text>
                    <View style={styles.segmentedControl}>
                      {orderTypeOptions.map(opt => {
                        const active = ((opt.id === 'dine_in' && orderDetails.orderType === 'Dine In') || (opt.id === 'takeaway' && orderDetails.orderType === 'Takeaway'));
                        return (
                          <TouchableOpacity
                            key={opt.id}
                            activeOpacity={0.9}
                            onPress={() => setOrderDetails(prev => ({ ...prev, orderType: opt.id === 'dine_in' ? 'Dine In' : 'Takeaway' }))}
                            style={[styles.segmentButton, active && styles.segmentButtonActive]}
                          >
                            <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{opt.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* customer select */}
                  <TouchableOpacity style={[styles.input, styles.selectRow]} onPress={() => openSelectionModal('customer')}>
                    <Text style={{ color: '#6B7280' }}>Customer</Text>
                    <Text style={styles.selectValue}>{orderDetails.customer?.name ?? 'Walk In Customer'}</Text>
                  </TouchableOpacity>

                  {/* room select */}
                  <TouchableOpacity style={[styles.input, styles.selectRow]} onPress={() => openSelectionModal('room')}>
                    <Text style={{ color: '#6B7280' }}>Room</Text>
                    <Text style={styles.selectValue}>{orderDetails.room?.name ?? 'Walk In Customer'}</Text>
                  </TouchableOpacity>

                  {/* steward select */}
                  <TouchableOpacity style={[styles.input, styles.selectRow]} onPress={() => openSelectionModal('steward')}>
                    <Text style={{ color: '#6B7280' }}>Steward</Text>
                    <Text style={styles.selectValue}>{orderDetails.stewardId ? (stewardList.find(s => s.id === orderDetails.stewardId)?.name ?? orderDetails.stewardId) : 'None'}</Text>
                  </TouchableOpacity>

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
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        // Close order modal and make sure all overlays / keyboards are closed
                        setShowOrderModal(false);
                        setSelectionModalVisible(false);
                        setComboModalVisible(false);
                        Keyboard.dismiss();
                        // Slight delay to avoid touch overlay issues while modal animates out
                        setTimeout(() => setShowCart(true), 50);
                      }}
                    >
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

      {/* selection modal (customer/room/steward) */}
      {selectionModalVisible && (
        <Modal visible={selectionModalVisible} animationType="slide" transparent>
          <TouchableWithoutFeedback onPress={() => setSelectionModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: '60%' }]}>
                <Text style={[styles.modalTitle, { color: '#111827' }]}>{selectionModalContext === 'customer' ? 'Choose Customer' : selectionModalContext === 'room' ? 'Choose Room' : selectionModalContext === 'table' ? 'Choose Table' : 'Choose Steward'}</Text>
                <ScrollView style={{ marginTop: 12 }}>
                  {selectionModalOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.id}
                      activeOpacity={0.85}
                      onPress={() => chooseSelectionOption(opt)}
                      style={styles.selectionOption}
                    >
                      <Text style={{ fontWeight: '700' }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={{ marginTop: 12 }}>
                  <TouchableOpacity style={[styles.cancelButton, { alignItems: 'center' }]} onPress={() => setSelectionModalVisible(false)}>
                    <Text style={styles.cancelText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* placed order summary modal shown after successful submit */}
      <Modal visible={orderPlacedModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={() => setOrderPlacedModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <Text style={[styles.modalTitle, { color: '#111827' }]}>Order Placed</Text>
              {placedOrderSummary ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontWeight: '700', marginBottom: 6 }}>Order ID: {placedOrderSummary.orderId}</Text>
                  <Text>Table: {placedOrderSummary.tableLabel ?? (placedOrderSummary.tableId || '-')}</Text>
                  <Text>Type: {placedOrderSummary.orderType}</Text>
                  <Text>Customer: {placedOrderSummary.customer?.name ?? '-'}</Text>
                  <Text>Room: {placedOrderSummary.room?.name ?? '-'}</Text>
                  <Text>Steward: {placedOrderSummary.stewardId ? (stewardList.find(s => s.id === placedOrderSummary.stewardId)?.name ?? placedOrderSummary.stewardId) : 'None'}</Text>

                  <View style={{ marginTop: 10 }}>
                    <Text style={{ fontWeight: '700' }}>Items</Text>
                    {placedOrderSummary.items.map((it: any, idx: number) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                        <Text>{it.name} x{it.qty}</Text>
                        <Text>Rs {Number(it.price * it.qty).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ marginTop: 12 }}>
                    <Text>Subtotal: Rs {placedOrderSummary.subtotal.toFixed(2)}</Text>
                    <Text>Service Charge: Rs {placedOrderSummary.serviceCharge.toFixed(2)}</Text>
                    <Text style={styles.totalText}>Total: Rs {placedOrderSummary.total.toFixed(2)}</Text>
                  </View>

                  <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={[styles.cancelButton, { flex: 1, marginRight: 8 }]} onPress={() => setOrderPlacedModalVisible(false)}>
                      <Text style={styles.cancelText}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.submitButton, { flex: 1, marginLeft: 8 }]} onPress={() => setOrderPlacedModalVisible(false)}>
                      <Text style={styles.submitText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text>No summary available</Text>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* combo selection modal */}
      {comboModalVisible && comboContext && (
        <Modal visible={comboModalVisible} animationType="slide" transparent>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choose Options</Text>
                </View>
                 <ScrollView>
                   {comboContext.combos.map((c: any, idx: number) => {
                     const key = c.id ?? idx;
                     const items = Array.isArray(c.combo_item) ? c.combo_item : (c.combo_item ? [c.combo_item] : []);
                     return (
                       <View key={String(key)} style={{ marginBottom: 16 }}>
                         <Text style={{ fontWeight: '700', marginBottom: 8 }}>{c.combo_title ?? c.title ?? c.name ?? `Choice ${idx + 1}`}</Text>
                         {items.length === 0 ? (
                           <Text style={{ color: '#666' }}>No options available</Text>
                         ) : (
                           items.map((ci: any) => {
                             const menu = ci.menu ?? ci;
                             const menuId = menu?.id ?? ci.menu_id ?? ci.id;
                             const selected = String(selectedComboChoices[key]) === String(menuId);
                             const imgUri = menu?.image ? imageBase + menu.image.replace(/^\/+/, '') : null;
                             return (
                              <TouchableOpacity
                                key={String(menuId)}
                                onPress={() => setSelectedComboChoices(prev => ({ ...prev, [key]: menuId }))}
                                style={[styles.comboOptionRow, selected && styles.comboOptionSelected]}
                                activeOpacity={0.85}
                              >
                                 {imgUri ? (
                                   <Image source={{ uri: imgUri }} style={styles.comboOptionImage} />
                                 ) : (
                                   <View style={[styles.comboOptionImage, styles.placeholder]}>
                                     <Text style={styles.placeholderText}>No image</Text>
                                   </View>
                                 )}
                                 <View style={styles.comboOptionInfo}>
                                   <Text style={styles.comboOptionName}>{menu?.name ?? menu?.title ?? 'Option'}</Text>
                                   {menu?.price ? <Text style={{ color: '#666' }}>Rs {Number(menu.price).toFixed(2)}</Text> : null}
                                 </View>
                               </TouchableOpacity>
                             );
                           })
                         )}
                       </View>
                     );
                   })}
                 </ScrollView>
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity style={styles.cancelButtonAlt} onPress={() => { setComboModalVisible(false); setComboContext(null); setSelectedComboChoices({}); }}>
                    <Text style={styles.cancelTextAlt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.submitButtonAlt} onPress={confirmAddWithCombos}>
                    <Text style={styles.submitTextAlt}>Add to cart</Text>
                  </TouchableOpacity>
                </View>
               </View>
             </View>
           </TouchableWithoutFeedback>
         </Modal>
       )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#FFFFFF' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#111827' },
  list: { paddingBottom: 24 },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  sectionSubtitle: { color: '#6B7280', marginTop: 4 },
  sectionBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: { color: '#FFFFFF', fontWeight: '600', textAlign: 'center' },
  categoryList: { marginBottom: 10 },
  categoryListContent: { paddingHorizontal: 14, alignItems: 'center', paddingVertical: 6 },
  categoryArea: {
    minHeight: 64,
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: 'transparent',
  },
  clearButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearText: {
    color: '#FF6B6B',
    fontWeight: '700',
    fontSize: 13,
  },
  countBadge: {
    marginLeft: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.08)',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  countBadgeText: {
    color: '#FF6B6B',
    fontWeight: '700',
    fontSize: 13,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  categoryPillActive: {
    backgroundColor: '#FF6B6B',
    borderColor: 'rgba(255,107,107,0.12)',
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  categoryLabelActive: { color: '#FFFFFF' },
  menuList: { paddingBottom: 160 },
  menuCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB', // light neutral border that follows the radius
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  menuImageWrapper: { marginRight: 14 },
  availabilityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#27AE60',
    position: 'absolute',
    top: -4,
    right: -4,
    zIndex: 2,
  },
  availabilityDotOff: { backgroundColor: '#D1D5DB' },
  menuImage: { width: 90, height: 90, borderRadius: 14, backgroundColor: '#F3F4F6', resizeMode: 'cover' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#6B7280', fontSize: 12 },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  menuMeta: { marginTop: 4, color: '#6B7280', fontSize: 13 },
  menuFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  menuPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FF6B6B',
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    backgroundColor: '#FFFFFF',
  },
  cartQtyPill: { marginHorizontal: 12 },
  qtyPillButton: { paddingHorizontal: 12, paddingVertical: 4, fontSize: 18, fontWeight: '700', color: '#FF6B6B' },
  qtyPillValue: { minWidth: 26, textAlign: 'center', fontWeight: '700', color: '#111827' },
  addBadge: {
    backgroundColor: 'transparent',
    borderRadius: 10, // match menuCard radius
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBadgeText: {
    color: '#FF6B6B',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
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
    backgroundColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cartSummaryItems: { color: '#FFFFFF', fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
  cartSummaryTotal: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  cartSummaryCta: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  cartContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cartTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  cartSubtitle: { color: '#6B7280', marginTop: 4 },
  hideCartText: { color: '#FF6B6B', fontWeight: '700' },
  cartDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  cartItemName: { fontWeight: '600', color: '#111827' },
  cartItemMeta: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  removeText: { color: '#FF6B6B', marginLeft: 12, fontWeight: '600' },
  placeOrderButton: {
    backgroundColor: '#FF6B6B',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 18,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  placeOrderText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  keyboardAvoid: { flex: 1, justifyContent: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 14,
    width: '95%',
    maxWidth: 700,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FF6B6B',
    alignItems: 'flex-start',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', padding: 10, marginBottom: 10, borderRadius: 5, color: '#111827', backgroundColor: '#FFFFFF' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelButton: { backgroundColor: '#F3F4F6', padding: 10, borderRadius: 5 },
  cancelText: { color: '#111827' },
  submitButton: { backgroundColor: '#FF6B6B', padding: 10, borderRadius: 5 },
  submitText: { color: '#FFFFFF' },
  serviceChargeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  billSummary: { marginBottom: 20 },
  totalText: { fontWeight: 'bold', fontSize: 18, color: '#111827' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: height > 600 && width > 300 ? 30 : 18,
    paddingHorizontal: width > 400 ? 12 : 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: { padding: 5 },
  backText: { fontSize: width > 400 ? 16 : 14, color: '#FF6B6B' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: width > 400 ? 26 : 22, fontWeight: '700', marginHorizontal: 10, color: '#111827' },
  spacer: { width: 50 },
  comboOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  comboOptionSelected: {
    borderWidth: 2,
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF1F1',
  },
  comboOptionImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
    resizeMode: 'cover',
  },
  comboOptionInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  comboOptionName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  modalActionsRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 12 },
  cancelButtonAlt: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelTextAlt: { color: '#111827', fontWeight: '700' },
  submitButtonAlt: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  submitTextAlt: { color: '#FFFFFF', fontWeight: '800' },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  segmentButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  segmentButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: {
    fontWeight: '700',
    color: '#111827',
    marginLeft: 12,
  },
  selectionOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
});
