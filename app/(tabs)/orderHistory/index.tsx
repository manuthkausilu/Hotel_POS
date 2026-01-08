import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert, StyleSheet, Button, Dimensions, Platform, StatusBar, TextInput, Modal, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getOrders, Order, PaginatedOrders } from '../../../services/orderHistoryService';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchAndMapOrderToBillData } from '../../../services/bill/billMapper';
import { printThermalBill, generateBillPDF } from '../../../services/bill/printerService';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

// Add theme constants (from app/index.tsx)
const PRIMARY = '#FF6B6B';
const TEXT_PRIMARY = '#1F2937';
const BACK_BUTTON_COLOR = '#2563EB'; // blue-600

export default function OrderHistoryScreen() {
  // loading / pagination state
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const perPage = 10;
  const [lastPage, setLastPage] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const navigation = useNavigation<any>();

  // Search state - client-side filtering
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter state and panel visibility
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>(''); // e.g., 'Take Away' | 'Dine In'
  const [filterStatus, setFilterStatus] = useState<string>(''); // e.g., 'Complete' | 'Processing'
  const [filterFromDate, setFilterFromDate] = useState<string>(''); // YYYY-MM-DD
  const [filterToDate, setFilterToDate] = useState<string>(''); // YYYY-MM-DD

  // Date picker states
  const [isFromDatePickerVisible, setFromDatePickerVisibility] = useState(false);
  const [isToDatePickerVisible, setToDatePickerVisibility] = useState(false);

  const [printingOrderId, setPrintingOrderId] = useState<number | null>(null);
  
  // New: bill preview modal state
  const [billPreviewVisible, setBillPreviewVisible] = useState<boolean>(false);
  const [previewBillData, setPreviewBillData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Helper: get color for status badge
  const getStatusColor = (status?: string) => {
    const s = (status || '').toString().toLowerCase();
    switch (s) {
      case 'completed':
      case 'done':
      case 'paid': return { background: 'rgba(255,107,107,0.08)', color: PRIMARY };
      case 'pending':
      case 'processing': return { background: '#FFFBEB', color: '#B45309' };
      case 'cancelled':
      case 'canceled': return { background: '#FEF2F2', color: '#DC2626' };
      case 'preparing': return { background: '#F5F3FF', color: '#6D28D9' };
      default: return { background: 'rgba(0,0,0,0.06)', color: '#374151' };
    }
  };

  // Helper: simple date formatting
  const formatDate = (val?: string) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleString();
  };

  // Helper: format currency
  const formatCurrency = (val?: any) => {
    if (val === undefined || val === null || val === '') return '';
    const n = Number(String(val).replace(/,/g, ''));
    return isNaN(n) ? `Rs ${String(val)}` : `Rs ${n.toLocaleString('en-IN')}`;
  };

  // Helper: parse numeric values from strings with currency symbols, etc.
  const parseNumber = (v?: any) => {
     if (v === undefined || v === null || v === '') return NaN;
     const n = Number(String(v).replace(/[^0-9.-]+/g, ''));
     return isNaN(n) ? NaN : n;
  };

  async function loadOrders(pageParam = 1, append = false) {
    if (append) setLoadingMore(true);
    else if (refreshing) {} // keep refresh indicator
    else setLoading(true);

    setError(null);
    try {
      const params: Record<string, any> = {
        per_page: perPage,
        page: pageParam,
        // include filters when set (basic validation for date)
        ...(filterType ? { type: filterType } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterFromDate && /^\d{4}-\d{2}-\d{2}$/.test(filterFromDate) ? { from_date: filterFromDate } : {}),
        ...(filterToDate && /^\d{4}-\d{2}-\d{2}$/.test(filterToDate) ? { to_date: filterToDate } : {}),
      };

      const resp = await getOrders(params);

      // If paginated response
      if (resp && typeof resp === 'object' && Array.isArray((resp as PaginatedOrders).data) && typeof (resp as PaginatedOrders).current_page === 'number') {
        const pag = resp as PaginatedOrders;
        const data = pag.data || [];
        setOrders(prev => (append ? [...prev, ...data] : data));
        setPage(pag.current_page);
        setLastPage(pag.last_page);
        setHasMore(pag.current_page < pag.last_page);
      } else if (Array.isArray(resp)) {
        // Non-paginated full array returned
        setOrders(resp as Order[]);
        setPage(1);
        setLastPage(null);
        setHasMore(false);
      } else {
        // Fallback
        const maybeData = (resp as any)?.data;
        if (Array.isArray(maybeData)) {
          setOrders(prev => (append ? [...prev, ...maybeData] : maybeData));
          setHasMore(false);
        } else setOrders([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadOrders(1, false);
  }, []);

  async function handlePrintBill(order: any) {
    try {
      setPrintingOrderId(order.id);
      
      const billData = await fetchAndMapOrderToBillData(order.id);
      await printThermalBill(billData);
      
      // Success - silently complete (no alert)
      console.log('Bill printed successfully for order:', order.id);
    } catch (error) {
      console.error('Print error:', error);
      
      const errorMessage = (error as Error).message;
      // Only show error if it's not a user cancellation
      if (!errorMessage.includes('cancelled') && !errorMessage.includes('Print cancelled')) {
        Alert.alert('Print Error', errorMessage || 'Failed to print bill');
      }
    } finally {
      setPrintingOrderId(null);
    }
  }

  // New: Handle view bill
  async function handleViewBill(order: any) {
    try {
      setPreviewLoading(true);
      setBillPreviewVisible(true);
      
      const billData = await fetchAndMapOrderToBillData(order.id);
      setPreviewBillData(billData);
    } catch (error) {
      console.error('Load bill error:', error);
      Alert.alert('Error', 'Failed to load bill preview');
      setBillPreviewVisible(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  // New: Print from preview
  async function handlePrintFromPreview() {
    if (!previewBillData) return;
    
    try {
      setPrintingOrderId(previewBillData.orderId);
      await printThermalBill(previewBillData);
      console.log('Bill printed successfully');
      setBillPreviewVisible(false);
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (!errorMessage.includes('cancelled') && !errorMessage.includes('Print cancelled')) {
        Alert.alert('Print Error', errorMessage || 'Failed to print bill');
      }
    } finally {
      setPrintingOrderId(null);
    }
  }

  // Format currency for preview
  const formatCurrencyPreview = (amount: number) => {
    return `Rs ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date for preview
  const formatDatePreview = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true 
    });
  };

  // Helper: format date for display (DD/MM/YYYY)
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Select Date';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Select Date';
    return d.toLocaleDateString('en-GB'); // DD/MM/YYYY format
  };

  // Helper: format date to YYYY-MM-DD
  const formatDateToString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Show from date picker
  const showFromDatePicker = () => {
    setFromDatePickerVisibility(true);
  };

  // Hide from date picker
  const hideFromDatePicker = () => {
    setFromDatePickerVisibility(false);
  };

  // Handle from date confirm
  const handleFromDateConfirm = (date: Date) => {
    setFilterFromDate(formatDateToString(date));
    hideFromDatePicker();
  };

  // Show to date picker
  const showToDatePicker = () => {
    setToDatePickerVisibility(true);
  };

  // Hide to date picker
  const hideToDatePicker = () => {
    setToDatePickerVisibility(false);
  };

  // Handle to date confirm
  const handleToDateConfirm = (date: Date) => {
    setFilterToDate(formatDateToString(date));
    hideToDatePicker();
  };

  function onLoadMore() {
    if (!hasMore || loadingMore) return;
    loadOrders(page + 1, true);
  }

  function onRefresh() {
    setRefreshing(true);
    setPage(1);
    loadOrders(1, false);
  }

  function applyFilters() {
    // Basic validation: check date formats if provided
    if (filterFromDate && !/^\d{4}-\d{2}-\d{2}$/.test(filterFromDate)) {
      Alert.alert('Invalid date', 'From date must be in YYYY-MM-DD format');
      return;
    }
    if (filterToDate && !/^\d{4}-\d{2}-\d{2}$/.test(filterToDate)) {
      Alert.alert('Invalid date', 'To date must be in YYYY-MM-DD format');
      return;
    }
    setFiltersOpen(false);
    setRefreshing(true);
    setPage(1);
    loadOrders(1, false);
  }

  function resetFilters() {
    setFilterType('');
    setFilterStatus('');
    setFilterFromDate('');
    setFilterToDate('');
    setFiltersOpen(false);
    setRefreshing(true);
    setPage(1);
    loadOrders(1, false);
  }

  // Handle search - just update the query, filtering happens via useMemo
  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  const filteredOrders = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return orders;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return orders.filter((order) => {
      const orderId = (order.order_id || String(order.id)).toLowerCase();
      const customerName = (order.customer_name || '').toLowerCase();
      const status = (order.status || '').toLowerCase();
      const type = (order.type || '').toLowerCase();
      
      return (
        orderId.includes(query) ||
        customerName.includes(query) ||
        status.includes(query) ||
        type.includes(query)
      );
    });
  }, [orders, searchQuery]);

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <View style={{ padding: 12, alignItems: 'center' }}>
        {loadingMore ? (
          <ActivityIndicator />
        ) : (
          <Button title="Load more" onPress={onLoadMore} />
        )}
      </View>
    );
  };

  // responsive paddings - adjusted for SafeAreaView
  const { width, height } = Dimensions.get('window');
  const rightPadding = Math.max(12, Math.round(width * 0.04));

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { paddingRight: rightPadding }]}>
          {/* Header with back button and centered title */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (navigation?.canGoBack && navigation.canGoBack()) navigation.goBack();
                else Alert.alert('Back', 'No screen to go back to');
              }}
            >
              <Text style={[styles.backText, { color: BACK_BUTTON_COLOR }]}>Back</Text>
            </TouchableOpacity>
            <Text numberOfLines={1} style={[styles.headerTitle, { color: TEXT_PRIMARY }]}>Order History</Text>
            {/* Filter toggle */}
            <TouchableOpacity
              style={[styles.filterButton, filtersOpen && styles.filterButtonActive]}
              onPress={() => setFiltersOpen(!filtersOpen)}
            >
              <MaterialCommunityIcons
                name={filtersOpen ? 'filter' : 'filter-outline'}
                size={25}
                color={filtersOpen ? '#fff' : '#6b7280'}
              />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by order ID, customer name..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={handleSearch}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filter panel (toggleable) */}
          {filtersOpen && (
            <View style={styles.filterPanel}>
              {/* Type filter */}
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Type</Text>
                <View style={styles.pillsRow}>
                  <TouchableOpacity style={[styles.pill, !filterType && styles.pillActive]} onPress={() => setFilterType('')}>
                    <Text style={[styles.pillText, !filterType && styles.pillTextActive]}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.pill, filterType === 'Take Away' && styles.pillActive]} onPress={() => setFilterType('Take Away')}>
                    <Text style={[styles.pillText, filterType === 'Take Away' && styles.pillTextActive]}>Take Away</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.pill, filterType === 'Dine In' && styles.pillActive]} onPress={() => setFilterType('Dine In')}>
                    <Text style={[styles.pillText, filterType === 'Dine In' && styles.pillTextActive]}>Dine In</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Status filter */}
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.pillsRow}>
                  <TouchableOpacity style={[styles.pill, !filterStatus && styles.pillActive]} onPress={() => setFilterStatus('')}>
                    <Text style={[styles.pillText, !filterStatus && styles.pillTextActive]}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.pill, filterStatus === 'Complete' && styles.pillActive]} onPress={() => setFilterStatus('Complete')}>
                    <Text style={[styles.pillText, filterStatus === 'Complete' && styles.pillTextActive]}>Complete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.pill, filterStatus === 'Processing' && styles.pillActive]} onPress={() => setFilterStatus('Processing')}>
                    <Text style={[styles.pillText, filterStatus === 'Processing' && styles.pillTextActive]}>Processing</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date filters with date pickers */}
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>From</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={showFromDatePicker}
                >
                  <MaterialCommunityIcons name="calendar" size={18} color="#6B7280" />
                  <Text style={styles.datePickerText}>{formatDateDisplay(filterFromDate)}</Text>
                </TouchableOpacity>
                {filterFromDate && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setFilterFromDate('')}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>To</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={showToDatePicker}
                >
                  <MaterialCommunityIcons name="calendar" size={18} color="#6B7280" />
                  <Text style={styles.datePickerText}>{formatDateDisplay(filterToDate)}</Text>
                </TouchableOpacity>
                {filterToDate && (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setFilterToDate('')}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Date Picker Modals */}
              <DateTimePickerModal
                isVisible={isFromDatePickerVisible}
                mode="date"
                onConfirm={handleFromDateConfirm}
                onCancel={hideFromDatePicker}
                date={filterFromDate ? new Date(filterFromDate) : new Date()}
                maximumDate={new Date()}
              />

              <DateTimePickerModal
                isVisible={isToDatePickerVisible}
                mode="date"
                onConfirm={handleToDateConfirm}
                onCancel={hideToDatePicker}
                date={filterToDate ? new Date(filterToDate) : (filterFromDate ? new Date(filterFromDate) : new Date())}
                minimumDate={filterFromDate ? new Date(filterFromDate) : undefined}
                maximumDate={new Date()}
              />

              {/* Actions */}
              <View style={styles.filterActions}>
                <TouchableOpacity style={[styles.actionButton, styles.resetButton]} onPress={resetFilters}>
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.applyButton]} onPress={applyFilters}>
                  <Text style={styles.applyText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loading && !refreshing && !loadingMore && <ActivityIndicator style={{ marginTop: 16 }} size="large" color={PRIMARY} />}

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
              ListEmptyComponent={() =>
                !loading ? (
                  <Text style={[styles.emptyText, { color: '#6b7280' }]}>
                    {searchQuery.trim() ? 'No matching orders found' : 'No orders found'}
                  </Text>
                ) : null
              }
              renderItem={({ item }) => {
                const statusStyle = getStatusColor(item.status);
                const totalAmount = (item as any).total_amount ?? (item as any).total ?? (item as any).price ?? '';
                const idLabel = item.order_id ? item.order_id.toString() : `#${item.id}`;
                const initials = (item.customer_name || 'U').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
                let amountText = '';
                if (totalAmount !== '' && totalAmount !== null && totalAmount !== undefined) {
                  const n = Number(String(totalAmount).replace(/,/g, ''));
                  amountText = isNaN(n) ? `Rs ${String(totalAmount)}` : `Rs ${n.toLocaleString('en-IN')}`;
                }
                
                const isPrinting = printingOrderId === item.id;

                return (
                  <View style={[styles.card, { marginRight: rightPadding / 2, marginTop: Math.max(10, Math.round(height * 0.012)) }]}>
                    <View style={styles.leftAvatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>

                    <View style={styles.cardCenter}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.orderId, { color: TEXT_PRIMARY }]} numberOfLines={1}>{idLabel}</Text>
                        <Text style={[styles.amount]} numberOfLines={1}>{amountText}</Text>
                      </View>
                      <Text style={styles.customer}>{item.customer_name || 'Unknown customer'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, justifyContent: 'space-between' }}>
                        <Text style={styles.meta}>{item.type ? `${item.type} • ` : ''}{formatDate(item.created_at)}</Text>
                        <View style={[styles.badge, { backgroundColor: statusStyle.background }]}>
                          <Text style={[styles.badgeText, { color: statusStyle.color }]}>{(item.status || '').toString().replace(/_/g, ' ')}</Text>
                        </View>
                      </View>
                      
                      {/* Action buttons row */}
                      <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                          style={[styles.viewBillButton]}
                          onPress={() => handleViewBill(item)}
                          disabled={isPrinting}
                        >
                          <MaterialCommunityIcons name="file-document-outline" size={16} color="#2563EB" />
                          <Text style={styles.viewBillText}>View Bill</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.printButtonCompact, isPrinting && styles.printButtonDisabled]}
                          onPress={() => handlePrintBill(item)}
                          disabled={isPrinting}
                        >
                          <MaterialCommunityIcons name="printer" size={16} color="#fff" />
                          <Text style={styles.printButtonText}>
                            {isPrinting ? 'Printing...' : 'Print'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={renderFooter}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          )}

          {/* Bill Preview Modal */}
          <Modal visible={billPreviewVisible} animationType="slide" transparent={false}>
            <SafeAreaView style={styles.billPreviewSafeArea}>
              <View style={styles.billPreviewContainer}>
                <View style={styles.billPreviewHeader}>
                  <Text style={styles.billPreviewTitle}>Bill Preview</Text>
                  <TouchableOpacity 
                    onPress={() => setBillPreviewVisible(false)} 
                    style={styles.closeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>

                {previewLoading ? (
                  <View style={styles.billPreviewLoading}>
                    <ActivityIndicator size="large" color={PRIMARY} />
                    <Text style={styles.billPreviewLoadingText}>Loading bill...</Text>
                  </View>
                ) : previewBillData ? (
                  <>
                    <ScrollView style={styles.billPreviewScroll}>
                      <View style={styles.billPreviewContent}>
                        {/* Hotel Header */}
                        <View style={styles.billPreviewSection}>
                          <Text style={styles.billHotelName}>{previewBillData.hotelName}</Text>
                          {previewBillData.hotelAddress && <Text style={styles.billHotelInfo}>{previewBillData.hotelAddress}</Text>}
                          {(previewBillData.hotelCity || previewBillData.hotelCountry) && (
                            <Text style={styles.billHotelInfo}>
                              {[previewBillData.hotelCity, previewBillData.hotelCountry].filter(Boolean).join(', ')}
                            </Text>
                          )}
                          {previewBillData.hotelPhone && <Text style={styles.billHotelInfo}>Tel: {previewBillData.hotelPhone}</Text>}
                          {previewBillData.hotelEmail && <Text style={styles.billHotelInfo}>{previewBillData.hotelEmail}</Text>}
                        </View>

                        <View style={styles.billDivider} />

                        {/* Order Info */}
                        <View style={styles.billPreviewSection}>
                          <View style={styles.billInfoRow}>
                            <Text style={styles.billInfoLabel}>Invoice ID:</Text>
                            <Text style={styles.billInfoValue}>#{previewBillData.orderId}</Text>
                          </View>
                          <View style={styles.billInfoRow}>
                            <Text style={styles.billInfoLabel}>Date:</Text>
                            <Text style={styles.billInfoValue}>{formatDatePreview(previewBillData.orderDate)}</Text>
                          </View>
                          <View style={styles.billInfoRow}>
                            <Text style={styles.billInfoLabel}>Type:</Text>
                            <Text style={styles.billInfoValue}>{previewBillData.orderType}</Text>
                          </View>
                          <View style={styles.billInfoRow}>
                            <Text style={styles.billInfoLabel}>Customer:</Text>
                            <Text style={styles.billInfoValue}>{previewBillData.customerName}</Text>
                          </View>
                          {previewBillData.roomNumber && (
                            <View style={styles.billInfoRow}>
                              <Text style={styles.billInfoLabel}>Room:</Text>
                              <Text style={styles.billInfoValue}>{previewBillData.roomNumber}</Text>
                            </View>
                          )}
                          {previewBillData.tableNumber && (
                            <View style={styles.billInfoRow}>
                              <Text style={styles.billInfoLabel}>Table:</Text>
                              <Text style={styles.billInfoValue}>{previewBillData.tableNumber}</Text>
                            </View>
                          )}
                          <View style={styles.billInfoRow}>
                            <Text style={styles.billInfoLabel}>Cashier:</Text>
                            <Text style={styles.billInfoValue}>{previewBillData.cashier}</Text>
                          </View>
                        </View>

                        <View style={styles.billDivider} />

                        {/* Items */}
                        <View style={styles.billPreviewSection}>
                          <Text style={styles.billSectionTitle}>Items</Text>
                          {previewBillData.items.map((item: any, idx: number) => (
                            <View key={idx} style={styles.billItemRow}>
                              <View style={styles.billItemLeft}>
                                <Text style={styles.billItemName}>{item.name}</Text>
                                <Text style={styles.billItemQty}>{item.quantity} x {formatCurrencyPreview(item.price)}</Text>
                              </View>
                              <Text style={styles.billItemTotal}>{formatCurrencyPreview(item.total)}</Text>
                            </View>
                          ))}
                        </View>

                        <View style={styles.billDivider} />

                        {/* Totals */}
                        <View style={styles.billPreviewSection}>
                          <View style={styles.billTotalRow}>
                            <Text style={styles.billTotalLabel}>Subtotal:</Text>
                            <Text style={styles.billTotalValue}>{formatCurrencyPreview(previewBillData.subtotal)}</Text>
                          </View>
                          {previewBillData.serviceCharge > 0 && (
                            <View style={styles.billTotalRow}>
                              <Text style={styles.billTotalLabel}>
                                Service Charge{previewBillData.serviceChargeRate ? ` (${previewBillData.serviceChargeRate.toFixed(1)}%)` : ''}:
                              </Text>
                              <Text style={styles.billTotalValue}>{formatCurrencyPreview(previewBillData.serviceCharge)}</Text>
                            </View>
                          )}
                          <View style={[styles.billTotalRow, styles.billGrandTotal]}>
                            <Text style={styles.billGrandTotalLabel}>TOTAL:</Text>
                            <Text style={styles.billGrandTotalValue}>{formatCurrencyPreview(previewBillData.total)}</Text>
                          </View>
                        </View>

                        <View style={styles.billDivider} />

                        {/* Payment */}
                        <View style={styles.billPreviewSection}>
                          <View style={styles.billTotalRow}>
                            <Text style={styles.billTotalLabel}>Payment Method:</Text>
                            <Text style={styles.billTotalValue}>{previewBillData.paymentMethod}</Text>
                          </View>
                          <View style={styles.billTotalRow}>
                            <Text style={styles.billTotalLabel}>Paid:</Text>
                            <Text style={styles.billTotalValue}>{formatCurrencyPreview(previewBillData.paidAmount)}</Text>
                          </View>
                          
                          {/* Show given amount if payment method is Cash */}
                          {previewBillData.paymentMethod === 'Cash' && previewBillData.givenAmount > 0 && (
                            <View style={styles.billTotalRow}>
                              <Text style={styles.billTotalLabel}>Given Amount:</Text>
                              <Text style={styles.billTotalValue}>{formatCurrencyPreview(previewBillData.givenAmount)}</Text>
                            </View>
                          )}
                          
                          {/* Show change amount if payment method is Cash and change exists */}
                          {previewBillData.paymentMethod === 'Cash' && previewBillData.changeAmount > 0 && (
                            <View style={styles.billTotalRow}>
                              <Text style={styles.billTotalLabel}>Change:</Text>
                              <Text style={[styles.billTotalValue]}>
                                {formatCurrencyPreview(previewBillData.changeAmount)}
                              </Text>
                            </View>
                          )}
                          
                          {/* Calculate balance on demand */}
                          {(() => {
                            const balance = previewBillData.total - previewBillData.paidAmount;
                            return balance !== 0 ? (
                              <View style={styles.billTotalRow}>
                                <Text style={styles.billTotalLabel}>{balance > 0 ? 'Balance Due:' : 'Change:'}</Text>
                                <Text style={[styles.billTotalValue, { color: balance > 0 ? '#DC2626' : '#059669' }]}>
                                  {formatCurrencyPreview(Math.abs(balance))}
                                </Text>
                              </View>
                            ) : null;
                          })()}
                        </View>

                        <View style={styles.billFooter}>
                          <Text style={styles.billThankYou}>Thank You!</Text>
                          <Text style={styles.billFooterText}>Visit Again</Text>
                        </View>
                      </View>
                    </ScrollView>

                    {/* Print button at bottom */}
                    <View style={styles.billPreviewActions}>
                      <TouchableOpacity 
                        style={styles.billPrintButton} 
                        onPress={handlePrintFromPreview}
                        disabled={!!printingOrderId}
                      >
                        <MaterialCommunityIcons name="printer" size={20} color="#fff" />
                        <Text style={styles.billPrintButtonText}>
                          {printingOrderId ? 'Printing...' : 'Print Bill'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </View>
            </SafeAreaView>
          </Modal>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#F8FAFC',
  },
  
  container: { 
    flex: 1, 
    paddingLeft: 12, 
    paddingBottom: 12, 
    backgroundColor: '#F8FAFC',
  },

  // Header styles: slightly more compact, modern
  header: {
    height: 60,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 6,
    marginTop: 8,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  backText: { fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  filterButton: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 12 },
  filterButtonActive: { backgroundColor: PRIMARY, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },

  // Card-style modern item
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.04)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  leftAvatar: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,107,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontWeight: '700', color: PRIMARY },

  cardCenter: { flex: 1 },
  orderId: { fontWeight: '700', fontSize: 15 },
  customer: { color: '#374151', marginTop: 4, fontSize: 13 },
  meta: { color: '#6b7280', fontSize: 12 },
  amount: { color: '#111827', fontWeight: '700', fontSize: 14 },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  errorText: { color: 'red', marginTop: 12 },
  emptyText: { marginTop: 16, color: '#6b7280', textAlign: 'center' },

  filterPanel: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.04)',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap'
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginRight: 8
  },
  pillsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.04)',
    marginRight: 8,
    marginTop: 4
  },
  pillActive: { backgroundColor: PRIMARY },
  pillText: { color: '#374151', fontWeight: '600' },
  pillTextActive: { color: '#fff' },

  dateInput: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'android' ? 6 : 8,
    minWidth: 120,
    color: '#111827',
    marginTop: 4
  },

  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    minWidth: 150,
    gap: 8,
    marginTop: 4,
  },

  datePickerText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },

  clearDateButton: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginLeft: 4,
    marginTop: 4,
  },

  filterActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  actionButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  applyButton: { backgroundColor: PRIMARY },
  applyText: { color: '#fff', fontWeight: '700' },
  resetButton: { marginRight: 8, backgroundColor: 'transparent' },
  resetText: { color: '#6b7280', fontWeight: '700' },

  // Action buttons row
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  viewBillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 6,
  },

  viewBillText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },

  printButtonCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  
  printButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  
  printButtonDisabled: {
    opacity: 0.5,
  },

  // Search bar styles
  searchContainer: {
    marginBottom: 12,
  },

  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    paddingHorizontal: 12,
    height: 44,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },

  clearSearchButton: {
    padding: 4,
  },

  // Bill Preview Modal Styles
  billPreviewSafeArea: {
    flex: 1,
    backgroundColor: PRIMARY,
  },

  billPreviewContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  billPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  billPreviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },

  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  closeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  billPreviewLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  billPreviewLoadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },

  billPreviewScroll: {
    flex: 1,
  },

  billPreviewContent: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },

  billPreviewSection: {
    marginBottom: 16,
  },

  billHotelName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },

  billHotelInfo: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },

  billDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginVertical: 16,
  },

  billSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },

  billInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  billInfoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },

  billInfoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },

  billItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  billItemLeft: {
    flex: 1,
    marginRight: 12,
  },

  billItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },

  billItemQty: {
    fontSize: 13,
    color: '#6B7280',
  },

  billItemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },

  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  billTotalLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },

  billTotalValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },

  billGrandTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: PRIMARY,
  },

  billGrandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },

  billGrandTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: PRIMARY,
  },

  billFooter: {
    marginTop: 24,
    alignItems: 'center',
  },

  billThankYou: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },

  billFooterText: {
    fontSize: 13,
    color: '#6B7280',
  },

  billPreviewActions: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },

  billPrintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    elevation: 2,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  billPrintButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
