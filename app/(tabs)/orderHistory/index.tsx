import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert, StyleSheet, Button, Dimensions, Platform, StatusBar, TextInput, Modal, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getOrders, getOrder, Order, PaginatedOrders } from '../../../services/orderHistoryService';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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

  // Filter state and panel visibility
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>(''); // e.g., 'Take Away' | 'Dine In'
  const [filterStatus, setFilterStatus] = useState<string>(''); // e.g., 'Complete' | 'Processing'
  const [filterFromDate, setFilterFromDate] = useState<string>(''); // YYYY-MM-DD
  const [filterToDate, setFilterToDate] = useState<string>(''); // YYYY-MM-DD

  // New states for detail modal and detail loading
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

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

  // Helper: safely extract items array from various possible payload shapes
  const extractItems = (detail: any) => {
    const d = detail?.data ?? detail; // support APIs that wrap detail in { data: ... }
    if (!d) return [];
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.order_items)) return d.order_items;
    if (Array.isArray(d.products)) return d.products;
    if (Array.isArray(d.line_items)) return d.line_items;
    // fallback: find any array with item-like objects
    for (const k of Object.keys(d)) {
      const val = (d as any)[k];
      if (Array.isArray(val) && val.length > 0) {
        const first = val[0];
        if (first && (first.name || first.product_name || first.item_name || first.qty || first.quantity)) return val;
      }
    }
    return [];
  };

  // Helper: robust item name extractor - check several fields and nested paths
  const getItemName = (it: any) => {
     if (!it) return 'Item';
     if (typeof it === 'string') return it;
 
     const get = (obj: any, path: string) => {
       const parts = path.split('.');
       let acc: any = obj;
       for (const p of parts) {
         if (acc === undefined || acc === null) return undefined;
         if (Array.isArray(acc)) {
           if (/^\d+$/.test(p)) acc = acc[parseInt(p, 10)];
           else acc = acc[0];
         } else {
           acc = acc[p];
         }
       }
       return acc;
     };
 
     // Recursive search falls back to find recipe_name anywhere inside nested objects/arrays
     const findKeyRecursive = (obj: any, keyToFind: string): any => {
       if (obj === undefined || obj === null) return undefined;
       if (typeof obj !== 'object') return undefined;
       if (Array.isArray(obj)) {
         for (const el of obj) {
           const v = findKeyRecursive(el, keyToFind);
           if (v !== undefined) return v;
         }
         return undefined;
       }
       if (Object.prototype.hasOwnProperty.call(obj, keyToFind) && typeof obj[keyToFind] === 'string' && obj[keyToFind].trim()) {
         return obj[keyToFind].trim();
       }
       for (const k of Object.keys(obj)) {
         const v = findKeyRecursive(obj[k], keyToFind);
         if (v !== undefined) return v;
       }
       return undefined;
     };
 
     const paths = [
       'name', 'item_name', 'product_name', 'title', 'label',
       'menu_item_name', 'unit_name', 'sku_name', 'variant.name',
       'product.name', 'product.data.name', 'product?.data?.name',
       'menu.name', 'menu.title',
       // new: order_list_detail recipe fallback
       'order_list_detail.recipe_name', 'order_list_detail.0.recipe_name',
       'pivot.order_list_detail.recipe_name', 'pivot.order_list_detail.0.recipe_name'
     ];
 
     for (const p of paths) {
       const v = get(it, p.replace(/\?\./g, '.')); // basic optional path support
       if (typeof v === 'string' && v.trim()) return v.trim();
     }
 
     // If any recipe_name exists nested anywhere (e.g., order_list_detail or other structures), show it
     const recipe = findKeyRecursive(it, 'recipe_name');
     if (typeof recipe === 'string' && recipe.trim()) return recipe.trim();
 
     // Lastly, try nested object keys that are strings
     for (const k of Object.keys(it)) {
       if (typeof it[k] === 'string' && it[k].trim()) return it[k].trim();
     }
     return it?.id ? String(it.id) : 'Item';
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

  async function onPressOrder(item: Order) {
    try {
      setDetailLoading(true);
      setSelectedOrderDetail(null);
      const raw = (await getOrder(item.id)) as unknown;

      // prefer .data if present; otherwise use the raw (supports APIs that wrap payload as { data: ... })
      const detail = (raw as any)?.data ?? raw;

      setSelectedOrderDetail(detail);
      setDetailModalVisible(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load order');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetailModal() {
    setDetailModalVisible(false);
    setSelectedOrderDetail(null);
  }

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

  // responsive paddings
  const { width, height } = Dimensions.get('window');
  const rightPadding = Math.max(12, Math.round(width * 0.04));
  const baseTop = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 16) : 16;
  const topPadding = baseTop + Math.round(height * 0.03);

  // modal width centered on screen (responsive)
  const modalWidth = Math.min(720, width - 48);

  // items list max height so it can scroll inside the modal
  const itemsMaxHeight = Math.min(420, Math.round(height * 0.35));
  const itemsList = selectedOrderDetail ? extractItems(selectedOrderDetail) : [];

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingRight: rightPadding }]}>
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

          {/* Date filters (manual input YYYY-MM-DD) */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>From</Text>
            <TextInput style={styles.dateInput} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" value={filterFromDate} onChangeText={setFilterFromDate} />
            <Text style={[styles.filterLabel, { marginLeft: 12 }]}>To</Text>
            <TextInput style={styles.dateInput} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" value={filterToDate} onChangeText={setFilterToDate} />
          </View>

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
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: Math.round(topPadding * 0.15) }}
          ListEmptyComponent={() =>
            !loading ? <Text style={[styles.emptyText, { color: '#6b7280' }]}>No orders found</Text> : null
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

            return (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.card, { marginRight: rightPadding / 2, marginTop: Math.max(10, Math.round(height * 0.012)) }]}
                onPress={() => onPressOrder(item)}
              >
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
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={renderFooter}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      {/* Order detail modal */}
      <Modal visible={detailModalVisible} transparent animationType="fade" onRequestClose={closeDetailModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeDetailModal}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalCard, { width: modalWidth }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.modalTitle}>
                    {(selectedOrderDetail?.order_id ? `#${selectedOrderDetail.order_id}` : `#${selectedOrderDetail?.id}`) || 'Order'}
                  </Text>
                  <Text style={styles.modalSubtitle}>{selectedOrderDetail?.customer_name || 'Unknown customer'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={[styles.badge, { backgroundColor: getStatusColor(selectedOrderDetail?.status).background }]}>
                    <Text style={[styles.badgeText, { color: getStatusColor(selectedOrderDetail?.status).color }]}>{(selectedOrderDetail?.status || '').toString().replace(/_/g, ' ')}</Text>
                  </View>
                  {/* removed inline "Close" text button - moved to top-right highlighted icon */}
                </View>
              </View>

              {/* New highlighted close button at top-right of modal */}
              <TouchableOpacity style={styles.modalCloseTop} onPress={closeDetailModal} accessibilityLabel="Close order details">
                <MaterialCommunityIcons name="close" size={18} color="#fff" />
              </TouchableOpacity>

              {detailLoading && <ActivityIndicator style={{ marginTop: 12 }} size="small" color={PRIMARY} />}

              {!detailLoading && (
                <ScrollView style={styles.modalContent}>
                  {/* Customer contact & meta */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Customer</Text>
                    <Text style={styles.sectionValue}>{selectedOrderDetail?.customer_name || '—'}</Text>
                    {selectedOrderDetail?.customer_phone ? (
                      <Text style={[styles.sectionValue, { marginTop: 4 }]}>{selectedOrderDetail.customer_phone}</Text>
                    ) : null}
                    <Text style={[styles.meta, { marginTop: 6 }]}>{selectedOrderDetail?.type ? `${selectedOrderDetail.type} • ` : ''}{formatDate(selectedOrderDetail?.created_at)}</Text>
                  </View>

                  {/* Items */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Items</Text>
                    {itemsList.length === 0 ? (
                      <Text style={[styles.sectionValue, { color: '#6b7280' }]}>No items</Text>
                    ) : (
                      <View style={[styles.itemsContainer, { maxHeight: itemsMaxHeight }]}>
                        {itemsList.map((it: any, idx: number) => {
                          const qty = Number(it.qty ?? it.quantity ?? it.qty_sold ?? it.qty_ordered ?? 0);
                          const price = Number(String(it.price ?? it.unit_price ?? it.rate ?? it.price_per_item ?? 0).replace(/,/g, ''));
                          const lineTotal = !isNaN(qty) && !isNaN(price) ? qty * price : (it.total ?? it.line_total ?? '');
                          return (
                            <View key={it?.id ?? idx} style={styles.itemRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.itemName} numberOfLines={2}>{getItemName(it)}</Text>
                                {it.notes ? <Text style={[styles.meta, { marginTop: 2 }]}>{it.notes}</Text> : null}
                              </View>
                              <View style={{ marginLeft: 12, alignItems: 'flex-end' }}>
                                <Text style={styles.itemQty}>x{isNaN(qty) ? (it.qty ?? it.quantity ?? '-') : qty}</Text>
                                <Text style={styles.itemPrice}>{formatCurrency(lineTotal)}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Summary totals */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Summary</Text>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Subtotal</Text>
                      <Text style={styles.summaryValue}>{formatCurrency(selectedOrderDetail?.subtotal ?? selectedOrderDetail?.sub_total ?? selectedOrderDetail?.amount ?? selectedOrderDetail?.total_before_tax)}</Text>
                    </View>
                    {selectedOrderDetail?.tax_amount ? (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Tax</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(selectedOrderDetail.tax_amount)}</Text>
                      </View>
                    ) : null}

                    {/* Service charge (various possible fields) */}
                    {(() => {
                      const svcRaw = selectedOrderDetail?.service_charge ?? selectedOrderDetail?.serviceCharge ?? selectedOrderDetail?.service_fee ?? selectedOrderDetail?.service_charge_amount ?? selectedOrderDetail?.service_charge_value;
                      const svcNum = parseNumber(svcRaw);
                      const showSvc = !isNaN(svcNum) ? formatCurrency(svcNum) : svcRaw ? formatCurrency(String(svcRaw)) : '';
                      return showSvc ? (
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Service charge</Text>
                          <Text style={styles.summaryValue}>{showSvc}</Text>
                        </View>
                      ) : null;
                    })()}

                    {selectedOrderDetail?.discount ? (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Discount</Text>
                        <Text style={[styles.summaryValue, { color: PRIMARY }]}>{formatCurrency(selectedOrderDetail.discount)}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.summaryRow, { marginTop: 6 }]}>
                      <Text style={[styles.summaryLabel, { fontWeight: '800' }]}>Total</Text>
                      <Text style={[styles.summaryValue, { fontWeight: '800' }]}>{formatCurrency(selectedOrderDetail?.total_amount ?? selectedOrderDetail?.total ?? selectedOrderDetail?.price)}</Text>
                    </View>

                    {/* Paid amount and due calculation */}
                    {(() => {
                      const paidRaw = selectedOrderDetail?.paid_amount ?? selectedOrderDetail?.paid ?? selectedOrderDetail?.amount_paid ?? selectedOrderDetail?.paid_value;
                      const paidNum = parseNumber(paidRaw);
                      if (isNaN(paidNum)) {
                        // if raw string shows something, still display it
                        if (paidRaw) {
                          return (
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>Paid</Text>
                              <Text style={[styles.summaryValue, { color: PRIMARY }]}>{formatCurrency(String(paidRaw))}</Text>
                            </View>
                          );
                        }
                        return null;
                      }
                      // show 'Paid' value
                      const totalNum = parseNumber(selectedOrderDetail?.total_amount ?? selectedOrderDetail?.total ?? selectedOrderDetail?.price ?? selectedOrderDetail?.grand_total);
                      const dueNum = !isNaN(totalNum) ? Math.max(0, totalNum - paidNum) : NaN;
                      return (
                        <>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Paid</Text>
                            <Text style={[styles.summaryValue, { color: PRIMARY }]}>{formatCurrency(paidNum)}</Text>
                          </View>
                          {!isNaN(dueNum) && (
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>Due</Text>
                              <Text style={[styles.summaryValue, { color: dueNum > 0 ? '#DC2626' : PRIMARY, fontWeight: '800' }]}>{formatCurrency(dueNum)}</Text>
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>

                  {/* Order notes, payment method, etc */}
                  {selectedOrderDetail?.notes ? (
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Notes</Text>
                      <Text style={styles.sectionValue}>{selectedOrderDetail.notes}</Text>
                    </View>
                  ) : null}

                  {selectedOrderDetail?.payment_method ? (
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Payment</Text>
                      <Text style={styles.sectionValue}>{selectedOrderDetail.payment_method}</Text>
                    </View>
                  ) : null}

                </ScrollView>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingLeft: 12, paddingBottom: 12, backgroundColor: '#F8FAFC' },

  // Header styles: slightly more compact, modern
  header: {
    height: 60,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 6,
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
    // Android shadow
    elevation: 2,
    // iOS shadow
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

  // content
  cardCenter: { flex: 1 },
  orderId: { fontWeight: '700', fontSize: 15 },
  customer: { color: '#374151', marginTop: 4, fontSize: 13 },
  meta: { color: '#6b7280', fontSize: 12 },
  amount: { color: '#111827', fontWeight: '700', fontSize: 14 },

  // status badge
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  errorText: { color: 'red', marginTop: 12 },
  emptyText: { marginTop: 16, color: '#6b7280', textAlign: 'center' },

  // Filter panel styles
  filterPanel: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.04)',
    // small elevation for card feel
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
    fontWeight: '800', // Increased boldness for main filter topics
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
  filterActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  actionButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  applyButton: { backgroundColor: PRIMARY },
  applyText: { color: '#fff', fontWeight: '700' },
  resetButton: { marginRight: 8, backgroundColor: 'transparent' },
  resetText: { color: '#6b7280', fontWeight: '700' },

  // Modal / detail styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center', // center vertically
    alignItems: 'center',     // center horizontally
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16, // small padding for top area; close button contained inside the card
    paddingBottom: 44,
    paddingHorizontal: 16,
    maxHeight: '85%',
    // subtle shadow feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },

  // **NEW** highlighted close icon on top-right (circular)
  modalCloseTop: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    padding: 8,
    zIndex: 20,
    // minor elevation/shadow for the highlight
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },

  // remove old modalClose style; keep other modal styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingRight: 48, // create more space to avoid overlap with top-right icon
  },

  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  modalContent: { marginTop: 8 },

  section: { marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 6 },
  sectionValue: { fontSize: 14, color: '#374151' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(15,23,42,0.04)',
  },
  itemName: { fontWeight: '700', color: '#111827', flexShrink: 1 },
  itemQty: { fontSize: 12, color: '#6b7280' },
  itemPrice: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 6 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  summaryLabel: { color: '#6b7280', fontSize: 13 },
  summaryValue: { color: '#111827', fontSize: 13 },

  itemsContainer: {
    width: '100%',
    borderRadius: 8,
    marginBottom: 6,
    overflow: 'hidden'
  },
});
