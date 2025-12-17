// OrdersScreen: displays menu items and cart UI only.
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Dimensions, Alert, Modal, TextInput, ScrollView, TouchableWithoutFeedback, Keyboard, Switch } from 'react-native';
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
  const [cart, setCart] = useState<{ entryId: string, item: MenuItem, quantity: number, combos?: { comboId: number, menuId: number, menu?: any }[], rowId?: string | number }[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [menuData, setMenuData] = useState<MenuResponse | null>(null);
  const [categories, setCategories] = useState<{id: number | string, name?: string, label?: string}[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [comboModalVisible, setComboModalVisible] = useState(false);
  const [comboContext, setComboContext] = useState<{ baseItem: MenuItem | null, combos: any[] } | null>(null);
  const [selectedComboChoices, setSelectedComboChoices] = useState<Record<string | number, number>>({});
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState<{
    tableId: string;
    orderType: string;
    customer: string;
    room: string;
    stewardId: string;
  }>({
    tableId: '',
    orderType: 'Dine In',
    customer: '',
    room: '',
    stewardId: '',
  });
  const [enableServiceCharge, setEnableServiceCharge] = useState(true);
  const [orderPlacedModalVisible, setOrderPlacedModalVisible] = useState(false);
  const [placedOrderSummary, setPlacedOrderSummary] = useState<any | null>(null);

  // New: running orders drawer state
  const [ongoingOpen, setOngoingOpen] = useState(false);
  const [runningOrders, setRunningOrders] = useState<Array<any>>([]);
  const [runningLoading, setRunningLoading] = useState(false);
  const [runningError, setRunningError] = useState<string | null>(null);

  // New: cancel modal state
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelingOrderId, setCancelingOrderId] = useState<number | null>(null);
  const [cancelProcessing, setCancelProcessing] = useState(false);

  // New: finalize modal state
  const [finalizeModalVisible, setFinalizeModalVisible] = useState(false);
  const [finalizeOrderId, setFinalizeOrderId] = useState<number | null>(null);
  const [finalizeOrderTotal, setFinalizeOrderTotal] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [givenAmount, setGivenAmount] = useState<string>('');
  const [changeAmount, setChangeAmount] = useState<number | null>(null);
  const [finalizeProcessing, setFinalizeProcessing] = useState(false);

  // New: payment dropdown state
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);

  // New: editing state for running orders
  const [editingRunningOrderId, setEditingRunningOrderId] = useState<number | null>(null);
  const [editingRunningOrderExternalId, setEditingRunningOrderExternalId] = useState<string | null>(null);

  // Calculate cartTotal so it is available in the component
  const cartTotal = cart.reduce((sum, c) => {
    const base = Number(c.item.price) || 0;
    const combosPrice = (c.combos || []).reduce((s, sc) => s + (Number(sc.menu?.price) || 0), 0);
    return sum + (base + combosPrice) * c.quantity;
  }, 0);

  useEffect(() => {
    const loadMenuData = async () => {
      try {
        const data = await fetchMenuData();
        setMenuData(data);
        const normalizedCategories = (data.categories || []).map((cat: any, index: number) => {
          if (cat && typeof cat === 'object') {
            const idValue = cat.id ?? cat.category_id ?? index;
            const label = cat.label ?? cat.name ?? cat.category_name ?? cat.title ?? `Category ${idValue ?? index + 1}`;
            return { ...cat, id: idValue, label };
          }
          if (typeof cat === 'string') return { id: cat, label: cat };
          if (typeof cat === 'number') return { id: cat, label: `Category ${cat}` };
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
      })?.menu ?? null;
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
      if (!orderDetails.orderType || orderDetails.orderType.trim().length === 0) {
        Alert.alert('Error', 'Please select Order Type');
        return;
      }
      if (cart.length === 0) {
        Alert.alert('Error', 'Cart is empty');
        return;
      }

      const orderId = orderService.createOrder(orderDetails.tableId);

      cart.forEach(c => {
        const modifiers = (c.combos || []).map(combo => ({
          menu_id: combo.menuId,
          name: combo.menu?.name || 'Option'
        }));
        
        const menuItemWithModifiers = {
          ...c.item,
          modifiers: modifiers.length > 0 ? modifiers : undefined
        };
        
        orderService.addItemToOrder(orderId, menuItemWithModifiers, c.quantity, c.item.special_note ?? undefined);
      });

      const subtotal = cart.reduce((sum, c) => {
        const base = Number(c.item.price) || 0;
        const comboPrice = (c.combos || []).reduce((s, combo) => s + (Number(combo.menu?.price) || 0), 0);
        return sum + (base + comboPrice) * c.quantity;
      }, 0);

      const serviceCharge = enableServiceCharge ? subtotal * 0.1 : 0;
      const totalAmount = subtotal + serviceCharge;

      const response = await orderService.submitOrder(orderId, {
        orderType: orderDetails.orderType,
        customer: orderDetails.customer
          ? { id: orderDetails.customer, name: `Customer ${orderDetails.customer}` }
          : undefined,
        room: orderDetails.room
          ? { id: orderDetails.room, name: `Room ${orderDetails.room}` }
          : undefined,
        tableId: orderDetails.tableId || undefined,
        stewardId: orderDetails.stewardId || undefined,
        serviceCharge,
      });

      setPlacedOrderSummary({
        orderId: response.data.order_id,
        orderNumber: response.data.order_number,
        items: cart.map(c => ({ name: c.item.name, qty: c.quantity, price: Number(c.item.price) })),
        subtotal,
        serviceCharge,
        total: totalAmount,
      });

      setCart([]);
      setShowCart(false);
      setShowOrderModal(false);
      setOrderPlacedModalVisible(true);

      setOrderDetails({ tableId: '', orderType: 'Dine In', customer: '', room: '', stewardId: '' });
      setEnableServiceCharge(true);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Failed to place order';
      Alert.alert('Error', errorMessage);
    }
  };

  // New: fetch running orders
  const fetchRunningOrders = async (force = false) => {
    if (runningLoading && !force) return;
    setRunningLoading(true);
    setRunningError(null);
    try {
      const res = await orderService.getRunningOrders();
      if (res && res.success && Array.isArray(res.orders)) {
        setRunningOrders(res.orders);
      } else {
        setRunningOrders([]);
      }
    } catch (err: any) {
      setRunningError(err?.message ?? 'Failed to fetch running orders');
    } finally {
      setRunningLoading(false);
    }
  };

  // fetch when drawer opens and refresh every 20s while open
  useEffect(() => {
    let interval: any = null;
    if (ongoingOpen) {
      fetchRunningOrders(true); // initial fetch
      interval = setInterval(() => fetchRunningOrders(true), 20000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ongoingOpen]);

  // fetch running orders once when the screen mounts
  useEffect(() => {
    fetchRunningOrders(true);
  }, []);

  // Handler for cancel button in running orders
  const handleCancelPress = (orderId: number) => {
    setCancelingOrderId(orderId);
    setCancelReason('');
    setCancelModalVisible(true);
  };

  // helper to format date/time safely
  const formatDateTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  // compute change whenever paid/given change or payment method becomes Free
	useEffect(() => {
		const paid = parseFloat(paidAmount || '0') || 0;
		const given = parseFloat(givenAmount || '0') || 0;
		if (paymentMethod === 'Free') {
			// show zero change when Free (order will be finalized with full order total)
			setChangeAmount(0);
			return;
		}
		const diff = given - paid;
		// don't display negative change (customer hasn't given enough) — show nothing instead
		if (isNaN(diff) || diff < 0) {
			setChangeAmount(null);
		} else {
			setChangeAmount(Number(diff.toFixed(2)));
		}
	}, [paidAmount, givenAmount, paymentMethod, finalizeOrderTotal]);

	const formatForApiDate = (d = new Date()) => {
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	};

	const handleFinalizePress = (id: number, total?: number) => {
		setFinalizeOrderId(id);
		setFinalizeOrderTotal(total ?? 0);
		setPaymentMethod('Cash');
		setPaidAmount(total ? String(Number(total).toFixed(2)) : '');
		setGivenAmount('');
		setChangeAmount(null);
		setFinalizeModalVisible(true);
	};

	const confirmFinalize = async () => {
		if (!finalizeOrderId) return Alert.alert('Error', 'No order selected for finalize');

		const paid = parseFloat(paidAmount || '0');
		// If Free, ensure we have an order total to submit
		if (paymentMethod === 'Free') {
			if (!finalizeOrderTotal || finalizeOrderTotal <= 0) {
				return Alert.alert('Error', 'Order total missing for finalize');
			}
		} else {
			if (isNaN(paid) || paid <= 0) {
				return Alert.alert('Error', 'Please enter a valid paid amount');
			}
		}

		setFinalizeProcessing(true);
		try {
			const payload = {
				order_id: finalizeOrderId,
				payment_method: paymentMethod || 'Cash',
				// For 'Free' send the order's total as paid_amount so backend accepts finalization
				paid_amount: paymentMethod === 'Free' ? Number(finalizeOrderTotal.toFixed(2)) : Number(paid.toFixed(2)),
				given_amount: paymentMethod === 'Free' ? 0 : (givenAmount ? Number(parseFloat(givenAmount).toFixed(2)) : undefined),
				change_amount: paymentMethod === 'Free' ? 0 : (changeAmount ?? undefined),
				order_date: formatForApiDate(),
			};
			const res = await orderService.finalizeOrder(payload);
			if (res && res.success) {
				Alert.alert('Success', res.message ?? 'Order finalized');
				setFinalizeModalVisible(false);
				setFinalizeOrderId(null);
				await fetchRunningOrders(true);
			} else {
				Alert.alert('Error', res?.message ?? 'Finalize failed');
			}
		} catch (err: any) {
			Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to finalize order');
		} finally {
			setFinalizeProcessing(false);
		}
	};

  // helper: try to find the array of order items inside any nested arrays of the server response
  const extractItemsFromOrder = (order: any) => {
    const candidates: any[] = [];
    const visited = new Set();
    const recurse = (obj: any) => {
      if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
      visited.add(obj);
      if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
        candidates.push(obj);
        obj.forEach(recurse);
        return;
      }
      Object.values(obj).forEach(recurse);
    };
    recurse(order);
    // prefer arrays that look like line-items (qty/recipe_id/price present)
    for (const arr of candidates) {
      const sample = arr[0];
      if (sample && (sample.qty || sample.quantity || sample.recipe_id || sample.menu_id || sample.price)) return arr;
    }
    return candidates[0] ?? [];
  };

  // When user taps "Update" on a running order: load the order and populate local cart for editing
  const handleEditPress = async (id: number) => {
    setRunningLoading(true);
    try {
      const serverOrder = await orderService.fetchOrderById(id);
      const items = extractItemsFromOrder(serverOrder);
      if (!items || items.length === 0) {
        Alert.alert('Error', 'No items found in order');
        return;
      }

      const parsedCart = items.map((it: any, idx: number) => {
        const menuId = it.recipe_id ?? it.menu_id ?? it.id ?? it.menu?.id ?? `${id}-${idx}`;
        const name = it.name ?? it.menu?.name ?? it.recipe_name ?? it.item_name ?? 'Item';
        const price = Number(it.price ?? it.menu?.price ?? it.rate ?? 0) || 0;
        const qty = Number(it.qty ?? it.quantity ?? 1) || 1;
        const combos = (it.modifiers || it.options || []).map((m: any, ci: number) => {
          const mid = m.menu_id ?? m.id ?? m.menu?.id ?? `${menuId}-opt-${ci}`;
          return { comboId: mid, menuId: mid, menu: { id: mid, name: m.name ?? m.menu?.name ?? 'Option', price: Number(m.price ?? m.menu?.price ?? 0) } };
        });
        // preserve server's item row id when present so we can update rows instead of creating new ones
        const rowId = it.row_id ?? it.rowid ?? it.rowId ?? undefined;
        return { entryId: `${menuId}-${Date.now()}-${idx}`, item: { id: menuId, name, price }, quantity: qty, combos: combos.length ? combos : undefined, rowId };
      });

      // set basic order meta if present
      setOrderDetails(prev => ({
        ...prev,
        orderType: (serverOrder.type ?? serverOrder.order_type)?.toString().toLowerCase().includes('take') ? 'Take away' : prev.orderType,
        tableId: serverOrder.table_id ? String(serverOrder.table_id) : prev.tableId,
        customer: serverOrder.customer ?? serverOrder.customer_name ?? prev.customer,
        room: serverOrder.room ?? prev.room,
        stewardId: serverOrder.steward_id ? String(serverOrder.steward_id) : prev.stewardId,
      }));

      // preserve server-exposed order identifier (often a string like "ORD-1001")
      setEditingRunningOrderExternalId(serverOrder.order_id ? String(serverOrder.order_id) : String(id));

      setCart(parsedCart);
      setEditingRunningOrderExternalId(serverOrder.order_id ? String(serverOrder.order_id) : String(id));

      // prefer server-provided numeric internal id when available (avoids using the wrong id)
      const numericServerId = Number(serverOrder.id ?? serverOrder.order_internal_id ?? id);
      setEditingRunningOrderId(Number.isFinite(numericServerId) ? numericServerId : Number(id));
      setCart(parsedCart);

      setShowCart(true);
      // prefer server-provided flag for service charge when available
      setEnableServiceCharge(Boolean(serverOrder.service_charge && Number(serverOrder.service_charge) > 0));
      setOngoingOpen(false);

      // debug: log what we loaded
      console.log('[POS/UI] Loaded order for edit:', { requestedId: id, serverId: serverOrder.id, order_id: serverOrder.order_id });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to load order');
    } finally {
      setRunningLoading(false);
    }
  };

  const confirmUpdateOrder = async () => {
    if (!editingRunningOrderId) return Alert.alert('Error', 'No order selected for update');
    if (cart.length === 0) return Alert.alert('Error', 'Cart is empty');

    try {
      const payload: any = {
        // use numeric internal order id to avoid accidental "create" on the backend
        order_id: editingRunningOrderId,
        order_type: orderDetails.orderType || 'Dine In',
        customer: orderDetails.customer ?? '',
        room: orderDetails.room ?? '',
        table_id: orderDetails.tableId ?? '',
        steward_id: orderDetails.stewardId ?? '',
        restaurant_id: 2, // keep same default used elsewhere
        service_charge: enableServiceCharge ? Number((cartTotal * 0.1).toFixed(2)) : 0,
        cart: cart.map(c => ({
          recipe_id: c.item.id,
          name: c.item.name,
          qty: c.quantity,
          price: c.item.price,
          total: (Number(c.item.price) || 0) * c.quantity,
          // reuse existing row id when present; otherwise send "new" to create a new row
          row_id: c.rowId ?? "new",
          modifiers: c.combos ? c.combos.map((sc: any) => ({ menu_id: sc.menuId, name: sc.menu?.name || 'Option' })) : [],
        })),
      };

      // include external order identifier for trace/debug (backend will ignore unknown fields if unsupported)
      if (editingRunningOrderExternalId) payload.external_order_id = editingRunningOrderExternalId;

      // debug: inspect payload to ensure order_id is numeric and rows are correct
      console.log('[POS/UI] Upsert payload for update:', JSON.stringify(payload, null, 2));

      const res = await orderService.upsertOrder(payload);
      if (res && res.success) {
        Alert.alert('Success', res.message ?? 'Order updated');
        setEditingRunningOrderId(null);
        setEditingRunningOrderExternalId(null);
        setCart([]);
        setShowCart(false);
        setShowOrderModal(false);
        await fetchRunningOrders(true);
      } else {
        Alert.alert('Error', res?.message ?? 'Update failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to update order');
    }
  };

  // Compute filtered menu items once and make available to renderMenuItems
  const filteredMenuItems = menuItems.filter(item => {
    if (selectedCategoryId) {
      const catList = menuData?.recipeCategoriesWithMenus?.[String(selectedCategoryId)];
      if (!catList || !catList.includes(item.id)) return false;
    }
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      const name = (item.name ?? '').toString().toLowerCase();
      const code = (item.item_code ?? '').toString().toLowerCase();
      const note = (item.special_note ?? '').toString().toLowerCase();
      if (!name.includes(q) && !code.includes(q) && !note.includes(q)) return false;
    }
    return true;
  });
  
  // Show simple loading/error early guards to avoid rendering the main UI prematurely
  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text>{error}</Text>;

  const renderMenuItems = () => {
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
            <TouchableOpacity
              style={styles.ongoingToggle}
              onPress={() => { setOngoingOpen(true); fetchRunningOrders(true); }}
              activeOpacity={0.85}
            >
              <Text style={styles.ongoingToggleText}>Running</Text>
              <View style={styles.ongoingBadge}>
                <Text style={styles.ongoingBadgeText}>{runningOrders.length}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

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
      </>
    );
  };

  const toggleCart = () => setShowCart(prev => !prev);

  async function confirmCancel(): Promise<void> {
    if (!cancelingOrderId) {
      Alert.alert('Error', 'No order selected to cancel');
      return;
    }
    setCancelProcessing(true);
    try {
      const res = await orderService.cancelOrder({ order_id: cancelingOrderId, reason: cancelReason });
      if (res && res.success) {
        Alert.alert('Success', res.message ?? `Order ${cancelingOrderId} cancelled`);
      } else {
        Alert.alert('Error', res?.message ?? 'Failed to cancel order');
      }
      setCancelModalVisible(false);
      setCancelingOrderId(null);
      setCancelReason('');
      await fetchRunningOrders(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to cancel order');
    } finally {
      setCancelProcessing(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* header title/back removed per request */}

      {renderMenuItems()}

      {/* running orders overlay and drawer */}
      {ongoingOpen && (
        <>
          <TouchableOpacity style={styles.ongoingOverlay} activeOpacity={1} onPress={() => setOngoingOpen(false)} />
          <View style={[styles.ongoingDrawer, styles.ongoingDrawerOpen]}>
            <View style={styles.ongoingHeader}>
              <Text style={styles.ongoingTitle}>Running Orders</Text>
              
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {runningLoading && <Text>Loading...</Text>}
              {runningError && <Text style={{ color: 'red' }}>{runningError}</Text>}
              {!runningLoading && runningOrders.length === 0 && <Text style={{ color: '#6B7280' }}>No running orders</Text>}

              {runningOrders.map((o: any) => (
                <View key={String(o.id)} style={styles.ongoingOrderCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontWeight: '800' }}>#{o.id}</Text>
                    <Text style={{ color: '#FF6B6B', fontWeight: '800' }}>Rs {Number(o.total).toFixed(2)}</Text>
                  </View>

                  {/* created_at */}
                  {o.created_at ? <Text style={{ color: '#6B7280', marginBottom: 6 }}>{formatDateTime(o.created_at)}</Text> : null}

                  {/* only show attributes when present */}
                  {o.customer_name ? <Text style={{ marginBottom: 4 }}>Customer: {o.customer_name}</Text> : null}
                  {o.room_number ? <Text style={{ marginBottom: 4 }}>Room: {o.room_number}</Text> : null}
                  {o.table_id ? <Text style={{ marginBottom: 4 }}>Table: {o.table_id}</Text> : null}
                  {o.steward_name ? <Text style={{ marginBottom: 4 }}>Steward: {o.steward_name}</Text> : null}

                  {/* is_ready badge */}
                  {typeof o.is_ready !== 'undefined' && o.is_ready !== null ? (
                    <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                      <View style={[styles.ongoingStatusBadge, { backgroundColor: o.is_ready ? '#D1FAE5' : '#FEF3C7' }]}>
                        <Text style={{ color: o.is_ready ? '#065F46' : '#92400E', fontWeight: '700' }}>
                          {o.is_ready ? 'Ready' : 'Not Ready'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* UI-only action buttons (Cancel now opens modal and calls service) */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.ongoingActionBtn, { borderColor: '#FCA5A5', backgroundColor: '#FFF1F2' }]}
                      onPress={() => handleCancelPress(o.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.ongoingActionText, { color: '#B91C1C' }]}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.ongoingActionBtn, { borderColor: '#FBBF24', backgroundColor: '#FFFBEB' }]}
                      onPress={() => handleEditPress(o.id)} // NOW loads the order into cart for editing
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.ongoingActionText, { color: '#92400E' }]}>Update</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.ongoingActionBtn, { borderColor: '#86EFAC', backgroundColor: '#ECFDF5' }]}
                      onPress={() => handleFinalizePress(o.id, o.total)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.ongoingActionText, { color: '#065F46' }]}>Finalize</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* actions row: refresh */}
            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.ongoingActionBtn, styles.refreshBtn]}
                onPress={() => fetchRunningOrders(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Refresh running orders"
              >
                <Text style={[styles.ongoingActionText, styles.refreshBtnText]}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ongoingActionBtn, styles.closeBtn]}
                onPress={() => setOngoingOpen(false)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Close running orders"
              >
                <Text style={[styles.ongoingActionText, styles.closeBtnText]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Cart panel — restored previous inline cart with Place Order button */}
      {showCart && (
        <View style={styles.cartContainer}>
          <View style={styles.cartHeader}>
            <View>
              <Text style={styles.cartTitle}>Cart</Text>
              <Text style={styles.cartSubtitle}>{cart.length} {cart.length === 1 ? 'item' : 'items'} • Rs {cartTotal.toFixed(2)}</Text>
            </View>
            <TouchableOpacity onPress={toggleCart}>
              <Text style={styles.hideCartText}>Hide</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cartItemsWrapper}>
            <FlatList
              data={cart}
              keyExtractor={(c) => c.entryId}
              ItemSeparatorComponent={() => <View style={styles.cartDivider} />}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
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
          </View>

          <TouchableOpacity
            style={styles.placeOrderButton}
            // when editing a running order, open the Order Details modal (user will confirm with Update)
            onPress={editingRunningOrderId ? () => setShowOrderModal(true) : placeOrder}
          >
            <Text style={styles.placeOrderText}>{editingRunningOrderId ? 'Update Order' : 'Place Order'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Order Modal */}
      <Modal visible={showOrderModal} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{editingRunningOrderId ? 'Update Order' : 'Order Details'}</Text>

                <Text style={styles.label}>Order Type *</Text>
                <View style={styles.segmentedControl}>
                  {['Dine In', 'Take away'].map(type => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setOrderDetails(prev => ({ ...prev, orderType: type }))}
                      style={[styles.segmentButton, orderDetails.orderType === type && styles.segmentButtonActive]}
                    >
                      <Text style={[styles.segmentButtonText, orderDetails.orderType === type && styles.segmentButtonTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Customer ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 12"
                  value={orderDetails.customer}
                  onChangeText={(text) => setOrderDetails(prev => ({ ...prev, customer: text }))}
                  keyboardType="numeric"
                />

                <Text style={styles.label}>Room ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 3"
                  value={orderDetails.room}
                  onChangeText={(text) => setOrderDetails(prev => ({ ...prev, room: text }))}
                  keyboardType="numeric"
                />

                <Text style={styles.label}>Table ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 5"
                  value={orderDetails.tableId}
                  onChangeText={(text) => setOrderDetails(prev => ({ ...prev, tableId: text }))}
                  keyboardType="numeric"
                />

                <Text style={styles.label}>Steward ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 7"
                  value={orderDetails.stewardId}
                  onChangeText={(text) => setOrderDetails(prev => ({ ...prev, stewardId: text }))}
                  keyboardType="numeric"
                />

                <View style={styles.serviceChargeRow}>
                  <Text>Enable Service Charge (10%)</Text>
                  <Switch value={enableServiceCharge} onValueChange={setEnableServiceCharge} />
                </View>

                {/* Price Summary */}
                <View style={styles.priceSummaryContainer}>
                  <Text style={styles.priceSummaryTitle}>Order Summary</Text>
                  <View style={styles.priceSummaryRow}>
                    <Text style={styles.priceSummaryLabel}>Subtotal:</Text>
                    <Text style={styles.priceSummaryValue}>Rs {cartTotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.priceSummaryRow}>
                    <Text style={styles.priceSummaryLabel}>Service Charge (10%):</Text>
                    <Text style={styles.priceSummaryValue}>
                      Rs {enableServiceCharge ? (cartTotal * 0.1).toFixed(2) : '0.00'}
                    </Text>
                  </View>
                  <View style={[styles.priceSummaryRow, styles.priceSummaryTotal]}>
                    <Text style={styles.priceTotalLabel}>Total:</Text>
                    <Text style={styles.priceTotalValue}>
                      Rs {(cartTotal + (enableServiceCharge ? cartTotal * 0.1 : 0)).toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowOrderModal(false)}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={editingRunningOrderId ? confirmUpdateOrder : submitOrder}
                  >
                    <Text style={styles.submitText}>{editingRunningOrderId ? 'Update Order' : 'Submit Order'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Order Placed Modal */}
      <Modal visible={orderPlacedModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={() => setOrderPlacedModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>Order Placed</Text>
              {placedOrderSummary && (
                <ScrollView>
                  <Text style={styles.summaryText}>Order ID: {placedOrderSummary.orderId}</Text>
                  <Text style={styles.summaryText}>Order Number: {placedOrderSummary.orderNumber}</Text>
                  <Text style={styles.summarySubtitle}>Items:</Text>
                  {placedOrderSummary.items.map((item: any, idx: number) => (
                    <Text key={idx} style={styles.summaryText}>
                      {item.qty}x {item.name} - Rs {(item.qty * item.price).toFixed(2)}
                    </Text>
                  ))}
                  <Text style={styles.summaryText}>Subtotal: Rs {placedOrderSummary.subtotal.toFixed(2)}</Text>
                  <Text style={styles.summaryText}>Service Charge: Rs {placedOrderSummary.serviceCharge.toFixed(2)}</Text>
                  <Text style={styles.totalText}>Total: Rs {placedOrderSummary.total.toFixed(2)}</Text>
                </ScrollView>
              )}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => setOrderPlacedModalVisible(false)}
              >
                <Text style={styles.submitText}>Done</Text>
              </TouchableOpacity>
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

       {/* Cancel Reason Modal */}
       <Modal visible={cancelModalVisible} animationType="fade" transparent>
         <TouchableWithoutFeedback onPress={() => !cancelProcessing && setCancelModalVisible(false)}>
           <View style={styles.modalOverlay}>
             <TouchableWithoutFeedback>
               <View style={[styles.modalContent, { width: '90%', maxWidth: 520 }]}>
                 <Text style={{ fontSize: 16, fontWeight: '800', marginBottom: 8 }}>Cancel Order #{cancelingOrderId}</Text>
                 <TextInput
                   style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                   placeholder="Reason (optional)"
                   placeholderTextColor="#9CA3AF"
                   value={cancelReason}
                   onChangeText={setCancelReason}
                   editable={!cancelProcessing}
                   multiline
                 />
                 <View style={{ flexDirection: 'row', gap: 12 }}>
                   <TouchableOpacity
                     style={styles.cancelButtonAlt}
                     onPress={() => {
                       if (!cancelProcessing) {
                         setCancelModalVisible(false);
                         setCancelingOrderId(null);
                         setCancelReason('');
                       }
                     }}
                     disabled={cancelProcessing}
                   >
                     <Text style={styles.cancelTextAlt}>Close</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={styles.submitButtonAlt} onPress={confirmCancel} disabled={cancelProcessing}>
                     <Text style={styles.submitTextAlt}>{cancelProcessing ? 'Processing...' : 'Confirm Cancel'}</Text>
                   </TouchableOpacity>
                 </View>
               </View>
             </TouchableWithoutFeedback>
           </View>
         </TouchableWithoutFeedback>
       </Modal>

       {/* Finalize Modal */}
			<Modal visible={finalizeModalVisible} animationType="fade" transparent>
				<TouchableWithoutFeedback onPress={() => !finalizeProcessing && setFinalizeModalVisible(false)}>
					<View style={styles.modalOverlay}>
						<TouchableWithoutFeedback>
							<View style={[styles.modalContent, { width: '90%', maxWidth: 520 }]}>
								<Text style={{ fontSize: 16, fontWeight: '800', marginBottom: 8 }}>Finalize Order #{finalizeOrderId}</Text>

								<Text style={{ marginBottom: 6, fontWeight: '700' }}>Payment method</Text>
								{/* Dropdown control */}
								<View>
									<TouchableOpacity
										style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
										onPress={() => setPaymentDropdownOpen(p => !p)}
										activeOpacity={0.85}
									>
										<Text>{paymentMethod}</Text>
										<Text style={{ color: '#6B7280' }}>{paymentDropdownOpen ? '▲' : '▼'}</Text>
									</TouchableOpacity>

									{paymentDropdownOpen && (
										<View style={styles.paymentDropdown}>
											{['Cash', 'Card', 'Free'].map(pm => (
												<TouchableOpacity
													key={pm}
													style={styles.paymentDropdownOption}
													onPress={() => { setPaymentMethod(pm); setPaymentDropdownOpen(false); }}
													activeOpacity={0.85}
												>
													<Text style={paymentMethod === pm ? styles.paymentMethodTextActive : styles.paymentMethodText}>
														{pm}
													</Text>
												</TouchableOpacity>
											))}
										</View>
									)}
								</View>

								<Text style={{ marginBottom: 6, fontWeight: '700' }}>Paid amount</Text>
								<TextInput
									style={[styles.input, paymentMethod === 'Free' && { backgroundColor: '#F3F4F6' }]}
									value={paidAmount}
									onChangeText={setPaidAmount}
									placeholder="e.g., 1785.00"
									editable={paymentMethod !== 'Free'}
									keyboardType="numeric"
								/>

								<Text style={{ marginBottom: 6, fontWeight: '700' }}>Given amount (optional)</Text>
								<TextInput
									style={[styles.input, paymentMethod === 'Free' && { backgroundColor: '#F3F4F6' }]}
									value={givenAmount}
									onChangeText={setGivenAmount}
									placeholder=""
									editable={paymentMethod !== 'Free'}
									keyboardType="numeric"
								/>

								{changeAmount !== null && (
									<Text style={{ marginBottom: 8 }}>Change: Rs {changeAmount.toFixed(2)}</Text>
								)}

								<Text style={{ marginBottom: 8, color: '#6B7280' }}>Order date: {formatForApiDate()}</Text>

								<View style={{ flexDirection: 'row', gap: 12 }}>
									<TouchableOpacity
										style={styles.cancelButtonAlt}
										onPress={() => {
											if (!finalizeProcessing) {
												setFinalizeModalVisible(false);
												setFinalizeOrderId(null);
												setPaymentMethod('Cash');
												setPaidAmount('');
												setGivenAmount('');
												setChangeAmount(null);
											}
										}}
										disabled={finalizeProcessing}
									>
										<Text style={styles.cancelTextAlt}>Close</Text>
									</TouchableOpacity>

									<TouchableOpacity
										style={styles.submitButtonAlt}
										onPress={confirmFinalize}
										disabled={finalizeProcessing}
									>
										<Text style={styles.submitTextAlt}>{finalizeProcessing ? 'Processing...' : 'Confirm Finalize'}</Text>
									</TouchableOpacity>
								</View>
							</View>
						</TouchableWithoutFeedback>
					</View>
				</TouchableWithoutFeedback>
			</Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#FFFFFF' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#111827' },
  list: { paddingBottom: 24 },
  cartDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 6,
  },
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
  serviceChargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
    paddingHorizontal: 4,
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
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 100, // above the summary bar
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
    maxHeight: height * 0.6, // Limit cart height to 60% of screen
    zIndex: 1000,
  },
  fabCart: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 1100,
  },
  fabCartText: { color: '#fff', fontWeight: '800' },

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
  // added small container for right-side controls
  searchRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12 },

  // --- added styles for ongoing drawer and toggle ---
  ongoingToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  ongoingToggleText: { color: '#111827', fontWeight: '700', marginRight: 8, fontSize: 13 },
  ongoingBadge: { backgroundColor: '#FF6B6B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  ongoingBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  ongoingOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 900,
  },
  ongoingDrawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: '100%',
    width: 360,
    maxWidth: '100%',
    backgroundColor: '#fff',
    zIndex: 950,
   
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    display: 'flex',
    flexDirection: 'column',
    borderLeftWidth: 1,
    borderLeftColor: '#F3F4F6',
  },
  ongoingDrawerOpen: { transform: [{ translateX: 0 }] },
  ongoingDrawerClosed: { transform: [{ translateX: 400 }] },

  ongoingHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ongoingTitle: { fontWeight: '800', fontSize: 16 },

  ongoingOrderCard: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 10, padding: 12, marginBottom:  12, backgroundColor: '#FFFFFF' },
  ongoingStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#FEF3C7', alignItems: 'center' },
  ongoingActionBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  ongoingActionText: { color: '#111827', fontWeight: '700' },
  refreshBtn: { backgroundColor: '#111827', borderColor: '#111827' },
  refreshBtnText: { color: '#FFFFFF' },
  closeBtn: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  closeBtnText: { color: '#FFFFFF' },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '700', color: '#111827' },
 
  summaryText: { marginVertical: 4, color: '#111827' },
  summarySubtitle: { marginTop: 12, fontWeight: '700', color: '#111827' },
  priceSummaryContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  priceSummaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  priceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceSummaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  priceSummaryValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  priceSummaryTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#FF6B6B',
  },
  priceTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  priceTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FF6B6B',
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  cartSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  hideCartText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  cartItemsWrapper: {
    maxHeight: height * 0.5,
    marginBottom: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cartItemMeta: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  removeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  placeOrderButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  placeOrderText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },

  // small dropdown styles
  paymentDropdown: {
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  paymentDropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  paymentMethodTextActive: { color: '#FF6B6B', fontWeight: '800' },
  paymentMethodText: { color: '#111827', fontWeight: '700' },
});
