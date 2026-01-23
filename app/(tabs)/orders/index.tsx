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

  // Calculate cartTotal so it is available in the component
  const cartTotal = cart.reduce((sum, c) => {
    const base = Number(c.item.price) || 0;
    const combosPrice = (c.combos || []).reduce((s, sc) => s + (Number(sc.menu?.price) || 0), 0);
    return sum + (base + combosPrice) * c.quantity;
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

      const serviceCharge = enableServiceCharge ? subtotal * (serviceChargePercent / 100) : 0;
      const totalAmount = subtotal + serviceCharge;

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
            // Print bill after finalization
            try {
              const billData = await fetchAndMapOrderToBillData(response.data.order_id);
              await printThermalBill(billData);
              console.log('Bill printed successfully for order:', response.data.order_id);
            } catch (printErr: any) {
              const errorMessage = printErr?.message || '';
              if (!errorMessage.includes('cancelled') && !errorMessage.includes('Print cancelled')) {
                Alert.alert('Print Error', errorMessage || 'Failed to print bill');
              }
            }
          }
        } catch (finalizeErr: any) {
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
        items: cart.map(c => ({ name: c.item.name, qty: c.quantity, price: Number(c.item.price) })),
        subtotal,
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
				paid_amount: paymentMethod === 'Free' ? Number(finalizeOrderTotal.toFixed(2)) : Number(paid.toFixed(2)),
				given_amount: paymentMethod === 'Free' ? 0 : (givenAmount ? Number(parseFloat(givenAmount).toFixed(2)) : undefined),
				change_amount: paymentMethod === 'Free' ? 0 : (changeAmount ?? undefined),
				order_date: formatForApiDate(),
			};
			const res = await orderService.finalizeOrder(payload);
			if (res && res.success) {
				// Close finalize modal first
				setFinalizeModalVisible(false);
				setPaymentMethod('Cash');
				setPaidAmount('');
				setGivenAmount('');
				setChangeAmount(null);
				
				// Print bill directly
				try {
          const billData = await fetchAndMapOrderToBillData(finalizeOrderId);
          await printThermalBill(billData);
          console.log('Bill printed successfully for order:', finalizeOrderId);
        } catch (printErr: any) {
          // Only show error if not cancelled by user
          const errorMessage = printErr?.message || '';
          if (!errorMessage.includes('cancelled') && !errorMessage.includes('Print cancelled')) {
            Alert.alert('Print Error', errorMessage || 'Failed to print bill');
          }
        }
        
        // Refresh running orders
        await fetchRunningOrders(true);
        setFinalizeOrderId(null);
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
    
    // Prevent double submission
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

  const renderMenuItems = () => {
     // use cartTotal / displayedServiceCharge / currencyLabel from component scope
     return (
       <>
         {/* Replace the inline search/header block with a modern search bar */}
         <View style={[styles.searchBar, isTabletOrPOS && styles.tabletSearchBar]}>
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

         <View style={[styles.categoryArea, isTabletOrPOS && styles.tabletCategoryArea]}>
         {categories.length > 0 && (() => {
            // build a categories data array that always includes "All" as first item
            const flatCats = [{ id: '__all__', label: 'All' }, ...categories.map((c) => ({ id: c.id ?? String(c), label: c.label ?? c.name ?? String(c) }))];
  
            return (
              <FlatList
                horizontal
                data={flatCats}
                keyExtractor={(item) => String(item.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.categoryListContent, isTabletOrPOS && styles.tabletCategoryListContent]}
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
                      style={[styles.categoryPill, isActive && styles.categoryPillActive, isTabletOrPOS && styles.tabletCategoryPill]}
                    >
                      <Text
                        style={[styles.categoryLabel, isActive && styles.categoryLabelActive, isTabletOrPOS && styles.tabletCategoryLabel]}
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
           contentContainerStyle={[styles.menuList, isTabletOrPOS && styles.tabletMenuList]}
           showsVerticalScrollIndicator={false}
           numColumns={isTabletOrPOS ? 2 : undefined}
           renderItem={({ item }) => {
             const imgUri = item.image ? imageBase + item.image.replace(/^\/+/, '') : null;
             const aggregatedQty = cart.filter(c => String(c.item.id) === String(item.id)).reduce((s, c) => s + c.quantity, 0);
             const cartEntryPreferredId = findPreferredEntryId(item.id);
             const isAvailable = item.is_available !== 0;

             return (
               <View style={[styles.menuCard, isTabletOrPOS && styles.tabletMenuCard]}>
                 <View style={[styles.menuImageWrapper, isTabletOrPOS && styles.tabletMenuImageWrapper]}>
                   <View style={[styles.availabilityDot, !isAvailable && styles.availabilityDotOff]} />
                   {imgUri && !imageErrors[item.id] ? (
                     <Image
                       source={{ uri: imgUri }}
                       style={[styles.menuImage, isTabletOrPOS && styles.tabletMenuImage]}
                       onError={() => setImageErrors(prev => ({ ...prev, [item.id]: true }))}
                     />
                   ) : (
                     <View style={[styles.menuImage, styles.placeholder, isTabletOrPOS && styles.tabletMenuImage]}>
                       <Text style={styles.placeholderText}>No image</Text>
                     </View>
                   )}
                 </View>
                 <View style={styles.menuInfo}>
                   <Text style={[styles.menuTitle, isTabletOrPOS && styles.tabletMenuTitle]}>{item.name}</Text>
                   {item.special_note ? (
                     <Text style={[styles.menuMeta, isTabletOrPOS && styles.tabletMenuMeta]}>{item.special_note}</Text>
                   ) : item.item_code ? (
                     <Text style={[styles.menuMeta, isTabletOrPOS && styles.tabletMenuMeta]}>Item code • {item.item_code}</Text>
                   ) : null}
                   <View style={styles.menuFooter}>
                     <Text style={[styles.menuPrice, isTabletOrPOS && styles.tabletMenuPrice]}>{currencyLabel}{Number(item.price).toFixed(2)}</Text>
                     {aggregatedQty > 0 ? (
                       <View style={[styles.qtyPill, isTabletOrPOS && styles.tabletQtyPill]}>
                         <TouchableOpacity onPress={() => cartEntryPreferredId && updateQuantity(cartEntryPreferredId, -1)}>
                           <Text style={[styles.qtyPillButton, isTabletOrPOS && styles.tabletQtyPillButton]}>-</Text>
                         </TouchableOpacity>
                         <Text style={[styles.qtyPillValue, isTabletOrPOS && styles.tabletQtyPillValue]}>{aggregatedQty}</Text>
                         <TouchableOpacity onPress={() => cartEntryPreferredId && updateQuantity(cartEntryPreferredId, 1)}>
                           <Text style={[styles.qtyPillButton, isTabletOrPOS && styles.tabletQtyPillButton]}>+</Text>
                         </TouchableOpacity>
                       </View>
                     ) : (
                       <TouchableOpacity style={[styles.addBadge, isTabletOrPOS && styles.tabletAddBadge]} onPress={() => addToCart(item)}>
                         <Text style={[styles.addBadgeText, isTabletOrPOS && styles.tabletAddBadgeText]}>+ ADD</Text>
                       </TouchableOpacity>
                     )}
                   </View>
                 </View>
               </View>
             );
           }}
           ListFooterComponent={<View style={{ height: 80 }} />}
         />
         {/* Cart summary bar - only show on mobile when cart is hidden */}
         {!isTabletOrPOS && cart.length > 0 && !showCart && (
           <TouchableOpacity style={styles.cartSummaryBar} onPress={() => setShowCart(true)} activeOpacity={0.9}>
             <View>
               <Text style={styles.cartSummaryItems}>{cart.length} {cart.length === 1 ? 'Item' : 'Items'}</Text>
               <Text style={styles.cartSummaryTotal}>{currencyLabel}{cartTotal.toFixed(2)}</Text>
             </View>
             <Text style={styles.cartSummaryCta}>View Cart</Text>
           </TouchableOpacity>
         )}
       </>
     );
   };

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
    const alt = [ (s as any)?.first_name, (s as any)?.last_name, (s as any)?.full_name ].filter(Boolean).join(' ').trim();
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
            {renderMenuItems()}
          </View>
          
          {/* Right side: Cart panel (always visible) */}
          <View style={styles.tabletCartSection}>
            <CartPanel
              cart={cart}
              visible={true}
              onToggle={() => {}} // No toggle needed on tablet
              onUpdateQuantity={updateQuantity}
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
          {renderMenuItems()}
          {/* Cart panel for mobile (overlay) */}
          <CartPanel
            cart={cart}
            visible={showCart}
            onToggle={toggleCart}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
            onPlaceOrder={editingRunningOrderId ? () => setShowOrderModal(true) : placeOrder}
            onClearCart={clearCart}
            editingRunningOrderId={editingRunningOrderId}
            isTabletMode={false}
          />
        </>
      )}

      {/* running orders overlay and drawer */}
      {ongoingOpen && (
        <>
          <TouchableOpacity style={styles.ongoingOverlay} activeOpacity={1} onPress={() => setOngoingOpen(false)} />
          <View style={[styles.ongoingDrawer, styles.ongoingDrawerOpen, isTabletOrPOS && styles.tabletOngoingDrawer]}>
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
                    <Text style={{ color: '#FF6B6B', fontWeight: '800' }}>{currencyLabel}{Number(o.total).toFixed(2)}</Text>
                  </View>

                  {/* created_at */}
                  {o.created_at ? <Text style={{ color: '#6B7280', marginBottom: 6 }}>{formatDateTime(o.created_at)}</Text> : null}

                  {/* only show attributes when present */}
                  {o.customer_name ? <Text style={{ marginBottom: 4 }}>Customer: {customerFullName(o)}</Text> : null}
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


      {/* Order Modal */}
      <Modal visible={showOrderModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <ScrollView 
                ref={orderModalScrollRef}
                contentContainerStyle={[styles.scrollContent, isTabletOrPOS && styles.tabletScrollContent]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                <View style={[styles.modalContent, isTabletOrPOS && styles.tabletModalContent]}>
                  <Text style={[styles.modalTitle, isTabletOrPOS && styles.tabletModalTitle]}>{editingRunningOrderId ? 'Update Order' : 'Order Details'}</Text>

                  <Text style={styles.label}>Order Type *</Text>
                  <View style={styles.segmentedControl}>
                    {['Dine In', 'Take away'].map(type => (
                      <TouchableOpacity
                        key={type}
                        onPress={() => {
                          setOrderDetails(prev => ({
                            ...prev,
                            orderType: type,
                            tableId: type.toLowerCase().includes('take') ? '' : prev.tableId,
                          }));
                          if (type.toLowerCase().includes('take')) setTableDropdownOpen(false);
                        }}
                        style={[styles.segmentButton, orderDetails.orderType === type && styles.segmentButtonActive]}
                      >
                        <Text style={[styles.segmentButtonText, orderDetails.orderType === type && styles.segmentButtonTextActive]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Customer dropdown */}
                  <Text style={styles.label}>Customer</Text>
                  <View>
                    <TouchableOpacity
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                      onPress={() => setCustomerDropdownOpen(p => !p)}
                      activeOpacity={0.85}
                    >
                      <Text>
                        {orderDetails.customer
                          ? (formatCustomerName(customers.find(c => String(c.id) === String(orderDetails.customer))) || `#${orderDetails.customer}`)
                          : 'Walk-in Customer'}
                      </Text>
                      <Text style={{ color: '#6B7280' }}>{customerDropdownOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {customerDropdownOpen && (
                      <View style={styles.paymentDropdown}>
                        <TouchableOpacity
                          key="walkin"
                          style={styles.paymentDropdownOption}
                          onPress={() => {
                            setOrderDetails(prev => ({ ...prev, customer: '', room: '' }));
                            setCustomerDropdownOpen(false);
                            setRoomDropdownOpen(false);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={!orderDetails.customer ? styles.paymentMethodTextActive : styles.paymentMethodText}>
                            Walk-in Customer
                          </Text>
                        </TouchableOpacity>

                        {customersLoading && <Text style={{ padding: 8 }}>Loading...</Text>}
                        {customersError && <Text style={{ padding: 8, color: 'red' }}>{customersError}</Text>}

                        {customers.map(c => (
                          <TouchableOpacity
                            key={String(c.id)}
                            style={styles.paymentDropdownOption}
                            onPress={() => {
                              // selecting customer triggers rooms fetch via useEffect
                              setOrderDetails(prev => ({ ...prev, customer: String(c.id), room: '' }));
                              setCustomerDropdownOpen(false);
                            }}
                            activeOpacity={0.85}
                          >
                            <Text style={orderDetails.customer === String(c.id) ? styles.paymentMethodTextActive : styles.paymentMethodText}>
                              {formatCustomerName(c)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Room dropdown (fetched by getCustomerRooms using reservation_id = selected customer id) */}
                  <Text style={styles.label}>Room</Text>
                  <View>
                    <TouchableOpacity
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                      onPress={() => {
                        if (!orderDetails.customer) return; // must select customer first
                        if (roomsLoading) return;
                        setRoomDropdownOpen(p => !p);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text>
                        {!orderDetails.customer
                          ? 'Select customer first'
                          : roomsLoading
                            ? 'Loading rooms...'
                            : orderDetails.room
                              ? (roomLabel(customerRooms.find(r => String(r.room?.id) === String(orderDetails.room))) || `#${orderDetails.room}`)
                              : (customerRooms.length > 0 ? 'Select room' : 'No rooms found')}
                      </Text>
                      <Text style={{ color: '#6B7280' }}>
                        {roomDropdownOpen ? '▲' : '▼'}
                      </Text>
                    </TouchableOpacity>

                    {!!roomsError && <Text style={{ paddingBottom: 8, color: 'red' }}>{roomsError}</Text>}

                    {roomDropdownOpen && orderDetails.customer && !roomsLoading && (
                      <View style={styles.paymentDropdown}>
                        <TouchableOpacity
                          key="room-none"
                          style={styles.paymentDropdownOption}
                          onPress={() => { setOrderDetails(prev => ({ ...prev, room: '' })); setRoomDropdownOpen(false); }}
                          activeOpacity={0.85}
                        >
                          <Text style={!orderDetails.room ? styles.paymentMethodTextActive : styles.paymentMethodText}>
                            None
                          </Text>
                        </TouchableOpacity>

                        {customerRooms.map((ri, idx) => {
                          const id = String(ri?.room?.id ?? idx);
                          return (
                            <TouchableOpacity
                              key={id}
                              style={styles.paymentDropdownOption}
                              onPress={() => { setOrderDetails(prev => ({ ...prev, room: id })); setRoomDropdownOpen(false); }}
                              activeOpacity={0.85}
                            >
                              <Text style={orderDetails.room === id ? styles.paymentMethodTextActive : styles.paymentMethodText}>
                                {roomLabel(ri) || `#${id}`}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {/* Manual fallback if rooms not returned */}
                    {orderDetails.customer && !roomsLoading && customerRooms.length === 0 && (
                      <TextInput
                        style={styles.input}
                        placeholder="Manual room (optional)"
                        value={orderDetails.room}
                        onChangeText={(text) => setOrderDetails(prev => ({ ...prev, room: text }))}
                        keyboardType="default"
                      />
                    )}
                  </View>

                  <Text style={styles.label}>Steward</Text>
                  <View>
                    <TouchableOpacity
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                      onPress={() => setStewardDropdownOpen(p => !p)}
                      activeOpacity={0.85}
                    >
                      <Text>
                        {orderDetails.stewardId
                          ? (stewardFullName(stewards.find(s => String(s.id) === String(orderDetails.stewardId))) || `#${orderDetails.stewardId}`)
                          : 'None'}
                      </Text>
                      <Text style={{ color: '#6B7280' }}>{stewardDropdownOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {stewardDropdownOpen && (
                      <View style={styles.paymentDropdown}>
                        <TouchableOpacity
                          key="none"
                          style={styles.paymentDropdownOption}
                          onPress={() => { setOrderDetails(prev => ({ ...prev, stewardId: '' })); setStewardDropdownOpen(false); }}
                          activeOpacity={0.85}
                        >
                          <Text style={!orderDetails.stewardId ? styles.paymentMethodTextActive : styles.paymentMethodText}>None</Text>
                        </TouchableOpacity>

                        {stewardsLoading && <Text style={{ padding: 8 }}>Loading...</Text>}
                        {stewardsError && <Text style={{ padding: 8, color: 'red' }}>{stewardsError}</Text>}

                        {stewards.map(s => (
                          <TouchableOpacity
                            key={String(s.id)}
                            style={styles.paymentDropdownOption}
                            onPress={() => { setOrderDetails(prev => ({ ...prev, stewardId: String(s.id) })); setStewardDropdownOpen(false); }}
                            activeOpacity={0.85}
                          >
                            <Text style={orderDetails.stewardId === String(s.id) ? styles.paymentMethodTextActive : styles.paymentMethodText}>
                              {stewardFullName(s)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.serviceChargeRow}>
                    <Text>Enable Service Charge ({serviceChargePercent}%)</Text>
                    <Switch value={enableServiceCharge} onValueChange={setEnableServiceCharge} />
                  </View>

                  {/* New: Immediate Finalization Toggle */}
                  {!editingRunningOrderId && (
                    <>
                      <View style={styles.serviceChargeRow}>
                        <Text>Finalize Immediately</Text>
                        <Switch 
                          value={immediateFinalize} 
                          onValueChange={(val) => {
                            setImmediateFinalize(val);
                            if (!val) {
                              // Reset payment fields when disabled
                              setSubmitPaymentMethod('Cash');
                              setSubmitPaidAmount('');
                              setSubmitGivenAmount('');
                              setSubmitChangeAmount(null);
                              setSubmitPaymentDropdownOpen(false);
                            }
                          }} 
                        />
                      </View>

                      {/* Payment fields when finalize is enabled */}
                      {immediateFinalize && (
                        <View style={styles.finalizeFieldsContainer}>
                          <Text style={styles.label}>Payment Method</Text>
                          <View>
                            <TouchableOpacity
                              style={[styles.input, styles.finalizeDropdownTrigger]}
                              onPress={() => setSubmitPaymentDropdownOpen(p => !p)}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.finalizeDropdownText}>{submitPaymentMethod}</Text>
                              <Text style={styles.finalizeDropdownIcon}>{submitPaymentDropdownOpen ? '▲' : '▼'}</Text>
                            </TouchableOpacity>

                            {submitPaymentDropdownOpen && (
                              <View style={styles.paymentDropdown}>
                                {['Cash', 'Card', 'Free'].map(pm => (
                                  <TouchableOpacity
                                    key={pm}
                                    style={styles.paymentDropdownOption}
                                    onPress={() => { setSubmitPaymentMethod(pm); setSubmitPaymentDropdownOpen(false); }}
                                    activeOpacity={0.85}
                                  >
                                    <Text style={submitPaymentMethod === pm ? styles.paymentMethodTextActive : styles.paymentMethodText}>
                                      {pm}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>

                          <Text style={styles.label}>Paid Amount</Text>
                          <TextInput
                            style={[styles.input, styles.finalizeInput, submitPaymentMethod === 'Free' && styles.finalizeInputDisabled]}
                            value={submitPaidAmount}
                            onChangeText={setSubmitPaidAmount}
                            placeholder="e.g., 1785.00"
                            placeholderTextColor="#9CA3AF"
                            editable={submitPaymentMethod !== 'Free'}
                            keyboardType="numeric"
                            returnKeyType="done"
                            onSubmitEditing={() => Keyboard.dismiss()}
                          />

                          <Text style={styles.label}>Given Amount (optional)</Text>
                          <TextInput
                            style={[styles.input, styles.finalizeInput, submitPaymentMethod === 'Free' && styles.finalizeInputDisabled]}
                            value={submitGivenAmount}
                            onChangeText={setSubmitGivenAmount}
                            placeholder="Optional"
                            placeholderTextColor="#9CA3AF"
                            editable={submitPaymentMethod !== 'Free'}
                            keyboardType="numeric"
                            returnKeyType="done"
                            onSubmitEditing={() => Keyboard.dismiss()}
                          />

                          {submitChangeAmount !== null && (
                            <View style={styles.finalizeChangeRow}>
                              <Text style={styles.finalizeChangeLabel}>Change:</Text>
                              <Text style={styles.finalizeChangeValue}>{currencyLabel}{submitChangeAmount.toFixed(2)}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  )}

                  {/* Price Summary */}
                  <View style={styles.priceSummaryContainer}>
                    <Text style={styles.priceSummaryTitle}>Order Summary</Text>
                    <View style={styles.priceSummaryRow}>
                      <Text style={styles.priceSummaryLabel}>Subtotal:</Text>
                      <Text style={styles.priceSummaryValue}>{currencyLabel}{cartTotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.priceSummaryRow}>
                      <Text style={styles.priceSummaryLabel}>Service Charge ({serviceChargePercent}%):</Text>
                      <Text style={styles.priceSummaryValue}>
                        {currencyLabel}{enableServiceCharge ? displayedServiceCharge.toFixed(2) : '0.00'}
                      </Text>
                    </View>
                    <View style={[styles.priceSummaryRow, styles.priceSummaryTotal]}>
                      <Text style={styles.priceTotalLabel}>Total:</Text>
                      <Text style={styles.priceTotalValue}>
                        {currencyLabel}{(cartTotal + displayedServiceCharge).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowOrderModal(false);
                        // Reset finalize fields when closing
                        setImmediateFinalize(false);
                        setSubmitPaymentMethod('Cash');
                        setSubmitPaidAmount('');
                        setSubmitGivenAmount('');
                        setSubmitChangeAmount(null);
                        setSubmitPaymentDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        submitProcessing && styles.submitButtonDisabled
                      ]}
                      onPress={editingRunningOrderId ? confirmUpdateOrder : submitOrder}
                      disabled={submitProcessing}
                    >
                      <Text style={styles.submitText}>
                        {submitProcessing 
                          ? 'Processing...' 
                          : editingRunningOrderId 
                            ? 'Update Order' 
                            : (immediateFinalize ? 'Submit & Finalize' : 'Submit Order')
                        }
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Order Placed Modal */}
      <Modal visible={orderPlacedModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={() => {
          setOrderPlacedModalVisible(false);
          setPlacedOrderSummary(null);
        }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                <Text style={styles.modalTitle}>
                  {placedOrderSummary?.finalized ? 'Order Finalized' : 'Order Placed'}
                </Text>
                {placedOrderSummary && (
                  <ScrollView>
                    <Text style={styles.summaryText}>Order ID: {placedOrderSummary.orderId}</Text>
                    <Text style={styles.summaryText}>Order Number: {placedOrderSummary.orderNumber}</Text>
                    {placedOrderSummary.finalized && (
                      <Text style={styles.summaryText}>Payment: {placedOrderSummary.paymentMethod}</Text>
                    )}
                    <Text style={styles.summarySubtitle}>Items:</Text>
                    {placedOrderSummary.items.map((item: any, idx: number) => (
                      <Text key={idx} style={styles.summaryText}>
                        {item.qty}x {item.name} - {currencyLabel}{(item.qty * item.price).toFixed(2)}
                      </Text>
                    ))}
                    <Text style={styles.summaryText}>Subtotal: {currencyLabel}{placedOrderSummary.subtotal.toFixed(2)}</Text>
                    <Text style={styles.summaryText}>Service Charge: {currencyLabel}{placedOrderSummary.serviceCharge.toFixed(2)}</Text>
                    <Text style={styles.totalText}>Total: {currencyLabel}{placedOrderSummary.total.toFixed(2)}</Text>
                    {placedOrderSummary.finalized && (
                      <Text style={[styles.summaryText, { color: '#059669', fontWeight: '700', marginTop: 8 }]}>
                        ✓ Order has been finalized
                      </Text>
                    )}
                  </ScrollView>
                )}
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={() => {
                    setOrderPlacedModalVisible(false);
                    setPlacedOrderSummary(null);
                  }}
                >
                  <Text style={styles.submitText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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

      {/* Cancel Reason Modal */}
      <Modal visible={cancelModalVisible} animationType="fade" transparent>
         <TouchableWithoutFeedback onPress={() => !cancelProcessing && setCancelModalVisible(false)}>
           <View style={styles.modalOverlay}>
             <TouchableWithoutFeedback>
               <View style={[styles.modalContent, { width: '90%', maxWidth: 520 }]}>
                 <Text style={{ fontSize: 16, fontWeight: '800', marginBottom: 8 }}>Cancel Order #{cancelingOrderId}</Text>
                 <Text style={{ fontSize: 14, color: '#DC2626', marginBottom: 8 }}>* Reason is required</Text>
                 <TextInput
                   style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                   placeholder="Reason for cancellation *"
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
				<KeyboardAvoidingView 
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
					style={{ flex: 1 }}
				>
					<TouchableWithoutFeedback onPress={() => {
						Keyboard.dismiss();
						if (!finalizeProcessing) setFinalizeModalVisible(false);
					}}>
						<View style={styles.modalOverlay}>
							<TouchableWithoutFeedback onPress={() => {}}>
								<ScrollView 
									contentContainerStyle={styles.finalizeModalScroll}
									keyboardShouldPersistTaps="handled"
									showsVerticalScrollIndicator={false}
								>
									<View style={[styles.modalContent, styles.finalizeModalContent]}>
										<Text style={styles.finalizeModalTitle}>Finalize Order #{finalizeOrderId}</Text>

										<Text style={styles.finalizeLabel}>Payment method</Text>
										<View>
											<TouchableOpacity
												style={[styles.input, styles.finalizeDropdownTrigger]}
												onPress={() => setPaymentDropdownOpen(p => !p)}
												activeOpacity={0.85}
											>
												<Text style={styles.finalizeDropdownText}>{paymentMethod}</Text>
												<Text style={styles.finalizeDropdownIcon}>{paymentDropdownOpen ? '▲' : '▼'}</Text>
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

										<Text style={styles.finalizeLabel}>Paid amount</Text>
										<TextInput
											style={[styles.input, styles.finalizeInput, paymentMethod === 'Free' && styles.finalizeInputDisabled]}
											value={paidAmount}
											onChangeText={setPaidAmount}
											placeholder="e.g., 1785.00"
											placeholderTextColor="#9CA3AF"
											editable={paymentMethod !== 'Free'}
											keyboardType="numeric"
											returnKeyType="done"
											onSubmitEditing={() => Keyboard.dismiss()}
										/>

										<Text style={styles.finalizeLabel}>Given amount (optional)</Text>
										<TextInput
											style={[styles.input, styles.finalizeInput, paymentMethod === 'Free' && styles.finalizeInputDisabled]}
											value={givenAmount}
										 onChangeText={setGivenAmount}
											placeholder="Optional"
											placeholderTextColor="#9CA3AF"
											editable={paymentMethod !== 'Free'}
											keyboardType="numeric"
											returnKeyType="done"
											onSubmitEditing={() => Keyboard.dismiss()}
										/>

										{changeAmount !== null && (
											<View style={styles.finalizeChangeRow}>
												<Text style={styles.finalizeChangeLabel}>Change:</Text>
												<Text style={styles.finalizeChangeValue}>{currencyLabel}{changeAmount.toFixed(2)}</Text>
											</View>
										)}

										<Text style={styles.finalizeDateText}>Order date: {formatForApiDate()}</Text>

										<View style={styles.finalizeButtonRow}>
											<TouchableOpacity
												style={styles.finalizeCancelButton}
												onPress={() => {
													Keyboard.dismiss();
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
												activeOpacity={0.85}
											>
												<Text style={styles.finalizeCancelText}>Close</Text>
											</TouchableOpacity>

											<TouchableOpacity
											 style={[styles.finalizeConfirmButton, finalizeProcessing && styles.finalizeConfirmButtonDisabled]}
											 onPress={() => {
												 Keyboard.dismiss();
												 confirmFinalize();
											 }}
											 disabled={finalizeProcessing}
											 activeOpacity={0.85}
											>
												<Text style={styles.finalizeConfirmText}>
													{finalizeProcessing ? 'Processing...' : 'Confirm Finalize'}
												</Text>
											</TouchableOpacity>
										</View>
									</View>
								</ScrollView>
							</TouchableWithoutFeedback>
						</View>
					</TouchableWithoutFeedback>
				</KeyboardAvoidingView>
			</Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#FFFFFF' },
  // Tablet/POS layout styles
  tabletLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  tabletMenuSection: {
    flex: 0.6, // 60% width for menu
    paddingRight: 8,
  },
  tabletCartSection: {
    flex: 0.4, // 40% width for cart
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    paddingLeft: 16,
    backgroundColor: '#FAFAFA',
  },
  tabletSearchBar: {
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  tabletCategoryArea: {
    minHeight: 80,
    marginBottom: 20,
  },
  tabletCategoryListContent: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  tabletCategoryPill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
    minWidth: 90,
  },
  tabletCategoryLabel: {
    fontSize: 15,
  },
  tabletMenuList: {
    paddingBottom: 20,
    paddingRight: 8,
  },
  tabletMenuCard: {
    flex: 0.5,
    marginHorizontal: 8,
    marginBottom: 16,
    padding: 20,
    maxWidth: '48%',
  },
  tabletMenuImageWrapper: {
    marginRight: 16,
  },
  tabletMenuImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
  },
  tabletMenuTitle: {
    fontSize: 18,
    marginBottom: 6,
  },
  tabletMenuMeta: {
    fontSize: 14,
    marginTop: 6,
  },
  tabletMenuPrice: {
    fontSize: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabletQtyPill: {
    paddingHorizontal: 4,
  },
  tabletQtyPillButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontSize: 20,
  },
  tabletQtyPillValue: {
    minWidth: 32,
    fontSize: 16,
  },
  tabletAddBadge: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  tabletAddBadgeText: {
    fontSize: 15,
    letterSpacing: 0.5,
  },
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
    borderRadius: 999,
    overflow: 'hidden',
  },
  countBadgeText: {
    color: '#FF6B6B',
    fontWeight: '700',
    fontSize: 13,
  },
  categoryPill: {
    paddingHorizontal:  14,
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
    borderRadius:  16,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB', // light neutral border that follows the radius
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius:  12,
    elevation: 2,
  },
  menuImageWrapper: { marginRight:  14 },
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
    color: '#FF6B6B',    backgroundColor: 'transparent',
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
  qtyPillButton: { paddingHorizontal: 12, paddingVertical:  4, fontSize: 18, fontWeight: '700', color: '#FF6B6B' },
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
  keyboardAvoid: { flex:  1, justifyContent: 'center' },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingVertical: 20,
  },
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
  tabletModalContent: {
    padding: 24,
    borderRadius: 16,
    maxWidth: 800,
  },
  tabletScrollContent: {
    paddingVertical: 30,
  },
  tabletModalTitle: {
    fontSize: 22,
    marginBottom: 8,
  },
  modalHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FF6B6B',
    alignItems: 'flex-start',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', padding: 10, marginBottom: 10, borderRadius: 5, color: '#111827', backgroundColor: '#FFFFFF' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelButton: { backgroundColor: '#F3F4F6', padding: 10, borderRadius: 5 },
  cancelText: { color: '#111827' },
  submitButton: { 
    backgroundColor: '#FF6B6B', 
    padding: 10, 
    borderRadius: 5 
  },
  submitButtonDisabled: {
    backgroundColor: '#FCA5A5',
    opacity: 0.6,
  },
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

  // Add missing styles:
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
  
  // Ongoing drawer styles
  ongoingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FF6B6B',
    borderWidth: 1,
    borderColor: '#FB7185',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  ongoingToggleText: {
    color: '#FFFFFF',
    fontWeight: '800',
    marginRight: 8,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  ongoingBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ongoingBadgeText: {
    color: '#FF6B6B',
    fontWeight: '900',
    fontSize: 12,
  },
  ongoingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    borderLeftWidth: 1,
    borderLeftColor: '#F3F4F6',
  },
  tabletOngoingDrawer: {
    width: 420,
  },
  ongoingDrawerOpen: { transform: [{ translateX: 0 }] },
  ongoingDrawerClosed: { transform: [{ translateX: 400 }] },
  ongoingHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ongoingTitle: { fontWeight: '800', fontSize: 16 },
  ongoingOrderCard: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#FFFFFF' },
  ongoingStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignItems: 'center' },
  ongoingActionBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  ongoingActionText: { color: '#111827', fontWeight: '700' },
  refreshBtn: { backgroundColor: '#111827', borderColor: '#111827' },
  refreshBtnText: { color: '#FFFFFF' },
  closeBtn: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  closeBtnText: { color: '#FFFFFF' },
  
  // Finalize modal styles
  finalizeModalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  finalizeModalContent: {
    marginHorizontal: 0,
    maxHeight: height * 0.85,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  finalizeModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'left',
  },
  finalizeLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '700',
    color: '#111827',
    fontSize: 14,
  },
  finalizeDropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finalizeDropdownText: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
  },
  finalizeDropdownIcon: {
    color: '#6B7280',
    marginLeft: 8,
  },
  finalizeInput: {
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  finalizeInputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  finalizeChangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  finalizeChangeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  finalizeChangeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  finalizeDateText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'left',
  },
  finalizeButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  finalizeCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  finalizeCancelText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  finalizeConfirmButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 48,
  },
  finalizeConfirmButtonDisabled: {
    opacity: 0.6,
  },
  finalizeConfirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
  },
  
  // Other missing styles
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
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 10,
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
  finalizeFieldsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
