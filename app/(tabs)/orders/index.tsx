// OrdersScreen: displays menu items and cart UI only.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Dimensions, Alert, Modal, TextInput, ScrollView, TouchableWithoutFeedback, Keyboard, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { fetchMenuData, fetchMenuItemByIdEndpoint } from '../../../services/menuService';
import { orderService } from '../../../services/orderService';
import { getStewards, Steward, formatStewardName } from '../../../services/staffService';
import { getCustomers, Customer, formatCustomerName, getCustomerRooms, type RoomItem } from '../../../services/customerService';
import { getTables, type Table } from '../../../services/tableService';
import type { MenuItem, MenuResponse } from '../../../types/menu';
import ComboSelectionModal from '../../../components/orders/ComboSelectionModal';
import CartPanel from '../../../components/orders/CartPanel';
import { fetchAndMapOrderToBillData } from '../../../services/bill/billMapper';
import { printThermalBill } from '../../../services/bill/printerService';
import { getHotelSettings, type HotelSettings } from '../../../services/hotelSettingService';
import RunningOrdersDrawer from '../../../components/orders/RunningOrdersDrawer';
import OrderModal from '../../../components/orders/OrderModal';
import PlacedOrderModal from '../../../components/orders/PlacedOrderModal';
import MenuList from '../../../components/orders/MenuList';
import CancelModal from '../../../components/orders/CancelModal';
import FinalizeModal from '../../../components/orders/FinalizeModal';
import SplitOrderModal from '../../../components/orders/SplitOrderModal';
import styles from './styles';

const { width, height } = Dimensions.get('window');
// const imageBase = 'https://app.trackerstay.com/storage/';
const imageBase = (process.env.IMAGE_BASE_URL as string) ?? 'https://app.trackerstay.com/storage/';

// Responsive breakpoints
const TABLET_BREAKPOINT = 768; // Tablet and POS machines
const isTabletOrPOS = width >= TABLET_BREAKPOINT;

export default function OrdersScreen() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [cart, setCart] = useState<{ entryId: string, item: MenuItem, quantity: number, discount?: number, combos?: { comboId: number, menuId: number, menu?: any }[], rowId?: string | number }[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [menuData, setMenuData] = useState<MenuResponse | null>(null);
  const [categories, setCategories] = useState<{ id: number | string, name?: string, label?: string }[]>([]);
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

  // New: immediate finalization state
  const [immediateFinalize, setImmediateFinalize] = useState(false);
  const [submitPaymentMethod, setSubmitPaymentMethod] = useState<string>('Cash');
  const [submitPaidAmount, setSubmitPaidAmount] = useState<string>('');
  const [submitGivenAmount, setSubmitGivenAmount] = useState<string>('');
  const [submitChangeAmount, setSubmitChangeAmount] = useState<number | null>(null);
  const [submitPaymentDropdownOpen, setSubmitPaymentDropdownOpen] = useState(false);

  // New: ref for order modal scroll
  const orderModalScrollRef = useRef<ScrollView>(null);

  // New: processing states for submit and update
  const [submitProcessing, setSubmitProcessing] = useState(false);

  // hotel settings state
  const [hotelSettings, setHotelSettings] = useState<HotelSettings | null>(null);
  const [hotelSettingsLoading, setHotelSettingsLoading] = useState(false);
  const [hotelSettingsError, setHotelSettingsError] = useState<string | null>(null);
  const [serviceChargePercent, setServiceChargePercent] = useState<number>(10);
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

  // New: stewards state
  const [stewards, setStewards] = useState<Steward[]>([]);
  const [stewardsLoading, setStewardsLoading] = useState(false);
  const [stewardsError, setStewardsError] = useState<string | null>(null);
  const [stewardDropdownOpen, setStewardDropdownOpen] = useState(false);

  // New: customers state (for order submit dropdown)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  // New: tables state (for order submit dropdown)
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [tableDropdownOpen, setTableDropdownOpen] = useState(false);

  // New: rooms state (based on selected customer / reservation)
  const [customerRooms, setCustomerRooms] = useState<RoomItem[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);

  // New: split bill state
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [splitOrderId, setSplitOrderId] = useState<number | null>(null);

  // Calculate cartTotal with discount
  const cartTotal = cart.reduce((sum, c) => {
    const base = Number(c.item.price) || 0;
    const combosPrice = (c.combos || []).reduce((s, sc) => s + (Number(sc.menu?.price) || 0), 0);
    const itemTotal = (base + combosPrice) * c.quantity;
    const discount = Number(c.discount) || 0;
    return sum + (itemTotal - discount);
  }, 0);

  // currency label and displayed service charge depend on cartTotal and settings
  const currencyLabel = (hotelSettings?.currency ?? 'Rs') + ' ';
  const displayedServiceCharge = enableServiceCharge ? cartTotal * (serviceChargePercent / 100) : 0;

  // fetch hotel settings on mount and derive percent/flag
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setHotelSettingsLoading(true);
      setHotelSettingsError(null);
      try {
        const s = await getHotelSettings();
        if (!mounted) return;
        setHotelSettings(s ?? null);
        const raw = s?.service_charge ?? '';
        const parsed = parseFloat(String(raw));
        const percent = !isNaN(parsed) ? (parsed > 0 && parsed <= 1 ? parsed * 100 : parsed) : 10;
        setServiceChargePercent(percent);
        setEnableServiceCharge(Boolean(Number(s?.service_charge_enabled ?? 0)));
      } catch (err: any) {
        if (!mounted) return;
        setHotelSettingsError(err?.message ?? 'Failed to load hotel settings');
      } finally {
        if (!mounted) return;
        setHotelSettingsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

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

  // fetch stewards on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setStewardsLoading(true);
      setStewardsError(null);
      try {
        const s = await getStewards();
        if (!mounted) return;
        setStewards(s || []);
      } catch (err: any) {
        if (!mounted) return;
        setStewardsError(err?.message ?? 'Failed to load stewards');
      } finally {
        if (!mounted) return;
        setStewardsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // fetch customers on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setCustomersLoading(true);
      setCustomersError(null);
      try {
        const list = await getCustomers();
        if (!mounted) return;
        setCustomers(list || []);
      } catch (err: any) {
        if (!mounted) return;
        setCustomersError(err?.message ?? 'Failed to load customers');
      } finally {
        if (!mounted) return;
        setCustomersLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // fetch tables on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setTablesLoading(true);
      setTablesError(null);
      try {
        const list = await getTables();
        if (!mounted) return;
        setTables(list || []);
      } catch (err: any) {
        if (!mounted) return;
        setTablesError(err?.message ?? 'Failed to load tables');
      } finally {
        if (!mounted) return;
        setTablesLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // fetch rooms whenever selected customer changes (reservation_id = customer.id)
  useEffect(() => {
    let mounted = true;
    const selectedCustomerId = orderDetails.customer;

    const loadRooms = async () => {
      // Walk-in: clear
      if (!selectedCustomerId) {
        setCustomerRooms([]);
        setRoomsError(null);
        setRoomsLoading(false);
        setRoomDropdownOpen(false);
        return;
      }

      setRoomsLoading(true);
      setRoomsError(null);
      try {
        const rooms = await getCustomerRooms(selectedCustomerId);
        if (!mounted) return;

        // avoid stale set if customer changed mid-request
        if (selectedCustomerId !== orderDetails.customer) return;

        setCustomerRooms(rooms || []);
        // if current selected room not in list, clear it
        setOrderDetails(prev => {
          if (!prev.room) return prev;
          const exists = (rooms || []).some(r => String(r?.room?.id) === String(prev.room));
          return exists ? prev : { ...prev, room: '' };
        });
      } catch (err: any) {
        if (!mounted) return;
        setCustomerRooms([]);
        setRoomsError(err?.message ?? 'Failed to load rooms');
      } finally {
        if (!mounted) return;
        setRoomsLoading(false);
      }
    };

    loadRooms();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderDetails.customer]);

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

  const updateDiscount = (entryId: string, discount: number) => {
    setCart(prev => prev.map(c => {
      if (c.entryId === entryId) {
        // Calculate max allowed discount (total item price)
        const base = Number(c.item.price) || 0;
        const combosPrice = (c.combos || []).reduce((s, sc) => s + (Number(sc.menu?.price) || 0), 0);
        const itemTotal = (base + combosPrice) * c.quantity;

        // Clamp discount between 0 and itemTotal
        const validDiscount = Math.min(Math.max(0, discount), itemTotal);

        return { ...c, discount: validDiscount };
      }
      return c;
    }));
  };

  const removeFromCart = (entryId: string) => {
    setCart(prev => prev.filter(c => c.entryId !== entryId));
  };

  const placeOrder = () => {
    // Get current user ID from API client headers
    const headerUserId =
      (orderService as any).client?.defaults?.headers?.common?.['X-User-Id'] ??
      (orderService as any).client?.defaults?.headers?.common?.['user-id'] ??
      (orderService as any).client?.defaults?.headers?.['X-User-Id'] ??
      (orderService as any).client?.defaults?.headers?.['user-id'] ??
      undefined;

    // Set default steward ID to current user if not already set
    if (headerUserId && !orderDetails.stewardId) {
      setOrderDetails(prev => ({
        ...prev,
        stewardId: String(headerUserId)
      }));
    }

    setShowOrderModal(true);
  };

  const isTakeAway = (orderDetails.orderType || '').toLowerCase().includes('take');

  // Compute change for submit form payment fields
  useEffect(() => {
    if (!immediateFinalize) {
      setSubmitChangeAmount(null);
      return;
    }
    const paid = parseFloat(submitPaidAmount || '0') || 0;
    const given = parseFloat(submitGivenAmount || '0') || 0;
    if (submitPaymentMethod === 'Free') {
      setSubmitChangeAmount(0);
      return;
    }
    const diff = given - paid;
    if (isNaN(diff) || diff < 0) {
      setSubmitChangeAmount(null);
    } else {
      setSubmitChangeAmount(Number(diff.toFixed(2)));
    }
  }, [submitPaidAmount, submitGivenAmount, submitPaymentMethod, immediateFinalize]);

  // Auto-fill paid amount when finalize toggle changes or cart changes
  useEffect(() => {
    if (immediateFinalize) {
      const total = cartTotal + displayedServiceCharge;
      setSubmitPaidAmount(String(Number(total.toFixed(2))));

      // Scroll to finalize section when enabled
      setTimeout(() => {
        orderModalScrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [immediateFinalize, cartTotal, displayedServiceCharge]);

  const submitOrder = async () => {
    // Prevent double submission
    if (submitProcessing) return;

    try {
      setSubmitProcessing(true);

      if (!orderDetails.orderType || orderDetails.orderType.trim().length === 0) {
        Alert.alert('Error', 'Please select Order Type');
        return;
      }
      if (cart.length === 0) {
        Alert.alert('Error', 'Cart is empty');
        return;
      }

      // Validate finalize fields if immediate finalization is enabled
      if (immediateFinalize) {
        const paid = parseFloat(submitPaidAmount || '0');
        if (submitPaymentMethod !== 'Free') {
          if (isNaN(paid) || paid <= 0) {
            Alert.alert('Error', 'Please enter a valid paid amount');
            return;
          }
        }
      }

      const effectiveTableId = isTakeAway ? undefined : (orderDetails.tableId || undefined);

      const orderId = orderService.createOrder(effectiveTableId);

      cart.forEach(c => {
        const modifiers = (c.combos || []).map(combo => ({
          menu_id: combo.menuId,
          name: combo.menu?.name || 'Option'
        }));

        const combosPrice = (c.combos || []).reduce((s, sc) => s + (Number(sc.menu?.price) || 0), 0);
        const fullUnitPrice = Number(c.item.price) + combosPrice;

        const menuItemWithModifiers = {
          ...c.item,
          price: fullUnitPrice, // Use price including combos
          modifiers: modifiers.length > 0 ? modifiers : undefined,
          discount: c.discount || 0, // Include discount
        };

        orderService.addItemToOrder(orderId, menuItemWithModifiers, c.quantity, c.item.special_note ?? undefined);
      });

      // Calculate subtotal AFTER discounts for service charge calculation
      const subtotalAfterDiscounts = cart.reduce((sum, c) => {
        const base = Number(c.item.price) || 0;
        const comboPrice = (c.combos || []).reduce((s, combo) => s + (Number(combo.menu?.price) || 0), 0);
        const itemSubtotal = (base + comboPrice) * c.quantity;
        const discount = Number(c.discount) || 0;
        return sum + (itemSubtotal - discount);
      }, 0);

      const subtotalBeforeDiscounts = cart.reduce((sum, c) => {
        const base = Number(c.item.price) || 0;
        const comboPrice = (c.combos || []).reduce((s, combo) => s + (Number(combo.menu?.price) || 0), 0);
        return sum + (base + comboPrice) * c.quantity;
      }, 0);

      const serviceCharge = enableServiceCharge ? subtotalAfterDiscounts * (serviceChargePercent / 100) : 0;
      const totalAmount = subtotalAfterDiscounts + serviceCharge;

      const selectedCustomer = orderDetails.customer
        ? customers.find(c => String(c.id) === String(orderDetails.customer))
        : undefined;

      const selectedRoomItem = orderDetails.room
        ? customerRooms.find(r => String(r?.room?.id) === String(orderDetails.room))
        : undefined;

      const response = await orderService.submitOrder(orderId, {
        orderType: orderDetails.orderType,
        customer: orderDetails.customer
          ? { id: orderDetails.customer, name: formatCustomerName(selectedCustomer) || `Customer ${orderDetails.customer}` }
          : undefined,
        room: orderDetails.room
          ? { id: orderDetails.room, name: selectedRoomItem?.room?.room_number ? `Room ${selectedRoomItem.room.room_number}` : `Room ${orderDetails.room}` }
          : undefined,
        tableId: effectiveTableId,
        stewardId: orderDetails.stewardId || undefined,
        serviceCharge,
      });

      // Store finalization status before clearing state
      const wasFinalized = immediateFinalize;
      const finalizePaymentMethod = submitPaymentMethod;

      // If immediate finalization is enabled, finalize the order
      if (immediateFinalize && response.data.order_id) {
        try {
          const paid = parseFloat(submitPaidAmount || '0');
          const finalizePayload = {
            order_id: response.data.order_id,
            payment_method: submitPaymentMethod || 'Cash',
            paid_amount: submitPaymentMethod === 'Free' ? Number(totalAmount.toFixed(2)) : Number(paid.toFixed(2)),
            given_amount: submitPaymentMethod === 'Free' ? 0 : (submitGivenAmount ? Number(parseFloat(submitGivenAmount).toFixed(2)) : undefined),
            change_amount: submitPaymentMethod === 'Free' ? 0 : (submitChangeAmount ?? undefined),
            order_date: formatForApiDate(),
          };

          const finalizeRes = await orderService.finalizeOrder(finalizePayload);

          if (finalizeRes && finalizeRes.success) {
            // Print bill in background
            (async () => {
              try {
                console.log('[POS/UI] Starting background print (immediate) for order:', response.data.order_id);
                const billData = await fetchAndMapOrderToBillData(response.data.order_id);
                await printThermalBill(billData);
                console.log('[POS/UI] Bill printed successfully (immediate) for order:', response.data.order_id);
              } catch (printErr: any) {
                console.warn('[POS/UI] Background print (immediate) failed:', printErr?.message);
              }
            })();
          }
        } catch (finalizeErr: any) {
          console.error('[POS/UI] Immediate finalization failed:', finalizeErr?.message);
          Alert.alert('Finalize Error', finalizeErr?.response?.data?.message ?? finalizeErr?.message ?? 'Order created but finalization failed');
        }
      }

      // Refresh running orders after successful order placement
      await fetchRunningOrders(true);

      // Reset ALL state before showing summary
      setCart([]);
      setShowCart(false);
      setShowOrderModal(false);
      setOrderDetails({ tableId: '', orderType: 'Dine In', customer: '', room: '', stewardId: '' });
      setEnableServiceCharge(true);
      setImmediateFinalize(false);
      setSubmitPaymentMethod('Cash');
      setSubmitPaidAmount('');
      setSubmitGivenAmount('');
      setSubmitChangeAmount(null);
      setSubmitPaymentDropdownOpen(false);

      // Show order placed modal with summary
      setPlacedOrderSummary({
        orderId: response.data.order_id,
        orderNumber: response.data.order_number,
        items: cart.map(c => ({ name: c.item.name, qty: c.quantity, price: (Number(c.item.price) || 0) + (c.combos || []).reduce((s, sc) => s + (Number(sc.menu?.price) || 0), 0) })),
        subtotal: subtotalAfterDiscounts,
        serviceCharge,
        total: totalAmount,
        finalized: wasFinalized,
        paymentMethod: wasFinalized ? finalizePaymentMethod : undefined,
      });
      setOrderPlacedModalVisible(true);

    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Failed to place order';
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitProcessing(false);
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

  // Exit update mode and reset editing state
  const exitUpdateMode = useCallback(() => {
    setEditingRunningOrderId(null);
    setEditingRunningOrderExternalId(null);
    setCart([]);
    setOrderDetails({ tableId: '', orderType: 'Dine In', customer: '', room: '', stewardId: '' });
    setEnableServiceCharge(true);
    setShowCart(false);
  }, []);

  // Auto-exit update mode when cart becomes empty
  useEffect(() => {
    if (editingRunningOrderId && cart.length === 0) {
      exitUpdateMode();
    }
  }, [cart.length, editingRunningOrderId, exitUpdateMode]);

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
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

  const handleSplitPress = (id: number) => {
    setSplitOrderId(id);
    setSplitModalVisible(true);
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
        paid_amount: paymentMethod === 'Free' ? Number(finalizeOrderTotal.toFixed(2)) : Number(paid.toFixed(2)),
        given_amount: paymentMethod === 'Free' ? 0 : (givenAmount ? Number(parseFloat(givenAmount).toFixed(2)) : undefined),
        change_amount: paymentMethod === 'Free' ? 0 : (changeAmount ?? undefined),
        order_date: formatForApiDate(),
      };
      const res = await orderService.finalizeOrder(payload);
      if (res && res.success) {
        // RESET STATE IMMEDIATELY so UI is not stuck
        setFinalizeProcessing(false);
        setFinalizeModalVisible(false);
        setPaymentMethod('Cash');
        setPaidAmount('');
        setGivenAmount('');
        setChangeAmount(null);

        // Print bill in background
        (async () => {
          try {
            console.log('[POS/UI] Starting background print for order:', finalizeOrderId);
            const billData = await fetchAndMapOrderToBillData(finalizeOrderId);
            await printThermalBill(billData);
            console.log('[POS/UI] Bill printed successfully for order:', finalizeOrderId);
          } catch (printErr: any) {
            const errorMessage = printErr?.message || '';
            if (!errorMessage.includes('cancelled') && !errorMessage.includes('Print cancelled')) {
              console.warn('[POS/UI] Background print failed:', errorMessage);
              // We don't alert here to avoid interrupting the user's next action, 
              // but we log it for debugging.
            }
          }
        })();

        // Refresh running orders
        await fetchRunningOrders(true);
        setFinalizeOrderId(null);
      } else {
        setFinalizeProcessing(false);
        Alert.alert('Error', res?.message ?? 'Finalize failed');
      }
    } catch (err: any) {
      setFinalizeProcessing(false);
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to finalize order');
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
        const discount = Number(it.discount ?? 0) || 0; // Extract discount
        const combos = (it.modifiers || it.options || []).map((m: any, ci: number) => {
          const mid = m.menu_id ?? m.id ?? m.menu?.id ?? `${menuId}-opt-${ci}`;
          return { comboId: mid, menuId: mid, menu: { id: mid, name: m.name ?? m.menu?.name ?? 'Option', price: Number(m.price ?? m.menu?.price ?? 0) } };
        });
        const rowId = it.row_id ?? it.rowid ?? it.rowId ?? undefined;
        return {
          entryId: `${menuId}-${Date.now()}-${idx}`,
          item: { id: menuId, name, price },
          quantity: qty,
          discount, // Include discount
          combos: combos.length ? combos : undefined,
          rowId
        };
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

    if (submitProcessing) return;

    try {
      setSubmitProcessing(true);

      const payload: any = {
        // use numeric internal order id to avoid accidental "create" on the backend
        order_id: editingRunningOrderId,
        order_type: orderDetails.orderType || 'Dine In',
        customer: orderDetails.customer ?? '',
        room: orderDetails.room ?? '',
        table_id: isTakeAway ? '' : (orderDetails.tableId ?? ''),
        steward_id: orderDetails.stewardId ?? '',
        restaurant_id: 2, // keep same default used elsewhere
        service_charge: enableServiceCharge ? Number((cartTotal * (serviceChargePercent / 100)).toFixed(2)) : 0,
        cart: cart.map(c => {
          const comboPrice = (c.combos || []).reduce((s, sc) => s + (Number(sc.menu?.price) || 0), 0);
          const fullPrice = (Number(c.item.price) || 0) + comboPrice;
          const qty = c.quantity || 1;
          const discount = c.discount || 0;
          const itemTotal = (fullPrice * qty) - discount;

          return {
            recipe_id: c.item.id,
            name: c.item.name,
            qty: qty,
            price: fullPrice,
            total: itemTotal,
            discount: discount,
            // reuse existing row id when present; otherwise send "new" to create a new row
            row_id: c.rowId ?? "new",
            modifiers: c.combos ? c.combos.map((sc: any) => ({ menu_id: sc.menuId, name: sc.menu?.name || 'Option' })) : [],
            note: c.item.special_note || undefined,
          };
        }),
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
    } finally {
      setSubmitProcessing(false);
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

  const toggleCart = () => setShowCart(prev => !prev);

  // Clear cart and reset order details
  const clearCart = () => {
    setCart([]);
    setOrderDetails({ tableId: '', orderType: 'Dine In', customer: '', room: '', stewardId: '' });
    setEnableServiceCharge(true);
    // if we were editing, exit that mode
    if (editingRunningOrderId) {
      exitUpdateMode();
    }
  };

  async function confirmCancel(): Promise<void> {
    if (!cancelingOrderId) {
      Alert.alert('Error', 'No order selected to cancel');
      return;
    }

    // Validate that reason is provided
    if (!cancelReason || cancelReason.trim().length === 0) {
      Alert.alert('Required', 'Please provide a reason for cancellation');
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

  // keep existing helper but ensure it uses name+lname
  function stewardFullName(s?: Steward | null): string {
    const v = formatStewardName(s ?? undefined);
    if (v) return v;
    const alt = [(s as any)?.first_name, (s as any)?.last_name, (s as any)?.full_name].filter(Boolean).join(' ').trim();
    if (alt) return alt;
    return (s as any)?.id ? `#${(s as any).id}` : '';
  }

  function customerFullName(o: any): string {
    if (!o) return '';
    const first =
      (o.customer_first_name ?? o.first_name ?? o.customer?.first_name ?? o.customer?.fname ?? '')
        .toString()
        .trim();
    const last =
      (o.customer_last_name ?? o.last_name ?? o.customer?.last_name ?? o.customer?.lname ?? '')
        .toString()
        .trim();
    const combined = `${first}${last ? ' ' + last : ''}`.trim();
    if (combined) return combined;
    // fallbacks (if API only gives a single field)
    const single =
      (o.customer_name ?? o.customer?.name ?? o.customer_full_name ?? '').toString().trim();
    return single;
  }

  const tableLabel = (t?: Table | null) => {
    if (!t) return '';
    const name = (t.table_name ?? '').toString().trim();
    return name ? name : `Table #${t.id}`;
  };

  const roomLabel = (ri?: RoomItem | null) => {
    if (!ri?.room) return '';
    const num = (ri.room.room_number ?? '').toString().trim();
    return num ? num : `Room #${ri.room.id}`;
  };

  return (
    <View style={styles.container}>
      {/* Responsive layout: side-by-side for tablet/POS, stacked for mobile */}
      {isTabletOrPOS ? (
        <View style={styles.tabletLayout}>
          {/* Left side: Menu items */}
          <View style={styles.tabletMenuSection}>
            <MenuList
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              setSelectedCategoryId={setSelectedCategoryId}
              filteredMenuItems={filteredMenuItems}
              cart={cart}
              addToCart={addToCart}
              updateQuantity={updateQuantity}
              findPreferredEntryId={findPreferredEntryId}
              imageErrors={imageErrors}
              setImageErrors={setImageErrors}
              imageBase={imageBase}
              isTabletOrPOS={isTabletOrPOS}
              runningOrdersLength={runningOrders.length}
              openRunning={() => { setOngoingOpen(true); fetchRunningOrders(true); }}
              currencyLabel={currencyLabel}
              cartTotal={cartTotal}
              showCart={showCart}
              setShowCart={setShowCart}
              styles={styles}
            />
          </View>

          {/* Right side: Cart panel (always visible) */}
          <View style={styles.tabletCartSection}>
            <CartPanel
              cart={cart}
              visible={true}
              onToggle={() => { }} // No toggle needed on tablet
              onUpdateQuantity={updateQuantity}
              onUpdateDiscount={updateDiscount}
              onRemoveItem={removeFromCart}
              onPlaceOrder={editingRunningOrderId ? () => setShowOrderModal(true) : placeOrder}
              onClearCart={clearCart}
              editingRunningOrderId={editingRunningOrderId}
              isTabletMode={true}
            />
          </View>
        </View>
      ) : (
        <>
          <MenuList
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            setSelectedCategoryId={setSelectedCategoryId}
            filteredMenuItems={filteredMenuItems}
            cart={cart}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
            findPreferredEntryId={findPreferredEntryId}
            imageErrors={imageErrors}
            setImageErrors={setImageErrors}
            imageBase={imageBase}
            isTabletOrPOS={isTabletOrPOS}
            runningOrdersLength={runningOrders.length}
            openRunning={() => { setOngoingOpen(true); fetchRunningOrders(true); }}
            currencyLabel={currencyLabel}
            cartTotal={cartTotal}
            showCart={showCart}
            setShowCart={setShowCart}
            styles={styles}
          />
          {/* Cart panel for mobile (overlay) */}
          <CartPanel
            cart={cart}
            visible={showCart}
            onToggle={toggleCart}
            onUpdateQuantity={updateQuantity}
            onUpdateDiscount={updateDiscount}
            onRemoveItem={removeFromCart}
            onPlaceOrder={editingRunningOrderId ? () => setShowOrderModal(true) : placeOrder}
            onClearCart={clearCart}
            editingRunningOrderId={editingRunningOrderId}
            isTabletMode={false}
          />
        </>
      )}

      {/* running orders overlay and drawer — extracted to component */}
      <RunningOrdersDrawer
        visible={ongoingOpen}
        onClose={() => setOngoingOpen(false)}
        runningOrders={runningOrders}
        runningLoading={runningLoading}
        runningError={runningError}
        onRefresh={() => fetchRunningOrders(true)}
        onCancelPress={handleCancelPress}
        onEditPress={handleEditPress}
        onFinalizePress={handleFinalizePress}
        onSplitPress={handleSplitPress}
        currencyLabel={currencyLabel}
        formatDateTime={formatDateTime}
        customerFullName={customerFullName}
        roomLabel={roomLabel}
      />

      {/* Order Modal (extracted) */}
      <OrderModal
        visible={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setImmediateFinalize(false);
          setSubmitPaymentMethod('Cash');
          setSubmitPaidAmount('');
          setSubmitGivenAmount('');
          setSubmitChangeAmount(null);
          setSubmitPaymentDropdownOpen(false);
        }}
        orderDetails={orderDetails}
        setOrderDetails={setOrderDetails}
        customers={customers}
        customersLoading={customersLoading}
        customersError={customersError}
        customerDropdownOpen={customerDropdownOpen}
        setCustomerDropdownOpen={setCustomerDropdownOpen}
        customerRooms={customerRooms}
        roomsLoading={roomsLoading}
        roomsError={roomsError}
        roomDropdownOpen={roomDropdownOpen}
        setRoomDropdownOpen={setRoomDropdownOpen}
        stewards={stewards}
        stewardsLoading={stewardsLoading}
        stewardsError={stewardsError}
        stewardDropdownOpen={stewardDropdownOpen}
        setStewardDropdownOpen={setStewardDropdownOpen}
        enableServiceCharge={enableServiceCharge}
        setEnableServiceCharge={setEnableServiceCharge}
        serviceChargePercent={serviceChargePercent}
        immediateFinalize={immediateFinalize}
        setImmediateFinalize={setImmediateFinalize}
        submitPaymentMethod={submitPaymentMethod}
        setSubmitPaymentMethod={setSubmitPaymentMethod}
        submitPaidAmount={submitPaidAmount}
        setSubmitPaidAmount={setSubmitPaidAmount}
        submitGivenAmount={submitGivenAmount}
        setSubmitGivenAmount={setSubmitGivenAmount}
        submitChangeAmount={submitChangeAmount}
        submitPaymentDropdownOpen={submitPaymentDropdownOpen}
        setSubmitPaymentDropdownOpen={setSubmitPaymentDropdownOpen}
        submitProcessing={submitProcessing}
        onSubmit={submitOrder}
        onUpdate={confirmUpdateOrder}
        editingRunningOrderId={editingRunningOrderId}
        cartTotal={cartTotal}
        displayedServiceCharge={displayedServiceCharge}
        currencyLabel={currencyLabel}
        orderModalScrollRef={orderModalScrollRef}
        formatCustomerName={formatCustomerName}
        roomLabel={roomLabel}
        customersList={customers}
      />

      {/* Order Placed Modal (extracted) */}
      <PlacedOrderModal
        visible={orderPlacedModalVisible}
        onClose={() => { setOrderPlacedModalVisible(false); setPlacedOrderSummary(null); }}
        summary={placedOrderSummary}
        currencyLabel={currencyLabel}
      />

      {/* combo selection modal — now extracted to component */}
      <ComboSelectionModal
        visible={comboModalVisible}
        comboContext={comboContext}
        selectedComboChoices={selectedComboChoices}
        onSelectChoice={(key, menuId) =>
          setSelectedComboChoices((prev) => ({ ...prev, [key]: menuId }))
        }
        onConfirm={confirmAddWithCombos}
        onCancel={() => {
          setComboModalVisible(false);
          setComboContext(null);
          setSelectedComboChoices({});
        }}
      />

      {/* Cancel Reason Modal (extracted) */}
      <CancelModal
        visible={cancelModalVisible}
        onClose={() => { if (!cancelProcessing) { setCancelModalVisible(false); setCancelingOrderId(null); setCancelReason(''); } }}
        reason={cancelReason}
        setReason={setCancelReason}
        onConfirm={confirmCancel}
        processing={cancelProcessing}
        orderId={cancelingOrderId}
      />

      {/* Finalize Modal (extracted) */}
      <FinalizeModal
        visible={finalizeModalVisible}
        onClose={() => {
          if (!finalizeProcessing) {
            setFinalizeModalVisible(false);
            setFinalizeOrderId(null);
            setPaymentMethod('Cash');
            setPaidAmount('');
            setGivenAmount('');
            setChangeAmount(null);
          }
        }}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paidAmount={paidAmount}
        setPaidAmount={setPaidAmount}
        givenAmount={givenAmount}
        setGivenAmount={setGivenAmount}
        changeAmount={changeAmount}
        currencyLabel={currencyLabel}
        finalizeOrderId={finalizeOrderId}
        finalizeOrderTotal={finalizeOrderTotal}
        formatForApiDate={formatForApiDate}
        paymentDropdownOpen={paymentDropdownOpen}
        setPaymentDropdownOpen={setPaymentDropdownOpen}
        finalizeProcessing={finalizeProcessing}
        onConfirm={confirmFinalize}
      />

      <SplitOrderModal
        visible={splitModalVisible}
        orderId={splitOrderId}
        onClose={() => { setSplitModalVisible(false); setSplitOrderId(null); }}
        currencyLabel={currencyLabel}
        serviceChargePercent={serviceChargePercent}
        onSuccess={() => {
          setSplitModalVisible(false);
          setSplitOrderId(null);
          fetchRunningOrders(true);
        }}
      />
    </View>
  );
}

// styles moved to ./styles.ts
