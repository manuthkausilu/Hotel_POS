import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { SplitPayer, SplitPayerItem, processSplitPayments } from '../../services/splitOrderService';
import { fetchOrderById } from '../../services/orderService';

type Props = {
    visible: boolean;
    orderId: number | null;
    onClose: () => void;
    onSuccess: () => void;
    currencyLabel: string;
    serviceChargePercent: number;
};

type OrderDetailItem = {
    id: number;
    recipe_id: number;
    name: string;
    qty: number;
    price: number;
    total: number;
};

export default function SplitOrderModal({
    visible,
    orderId,
    onClose,
    onSuccess,
    currencyLabel,
    serviceChargePercent,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [orderDetails, setOrderDetails] = useState<any>(null);
    const [items, setItems] = useState<OrderDetailItem[]>([]);
    const [payers, setPayers] = useState<SplitPayer[]>([]);
    const { width: windowWidth } = useWindowDimensions();
    const isMobile = windowWidth < 768;

    // Payer Form State
    const [payerName, setPayerName] = useState('');
    const [payerEmail, setPayerEmail] = useState('');
    const [payerPhone, setPayerPhone] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');

    // Currently selected item assignments for the "Add Payer" section
    const [currentPayerAssignments, setCurrentPayerAssignments] = useState<Record<number, number>>({});

    useEffect(() => {
        if (visible && orderId) {
            loadOrderDetails();
        } else {
            resetState();
        }
    }, [visible, orderId]);

    const loadOrderDetails = async () => {
        if (!orderId) return;
        setLoading(true);
        try {
            const data = await fetchOrderById(orderId);
            setOrderDetails(data);
            const orderItems = data.order_list_detail || [];

            setItems(orderItems.map((item: any) => {
                let qty = 1;
                if (typeof item.quantity === 'number' || (typeof item.quantity === 'string' && item.quantity !== '')) {
                    qty = Number(item.quantity);
                } else if (typeof item.qty === 'number' || (typeof item.qty === 'string' && item.qty !== '')) {
                    qty = Number(item.qty);
                }

                const total = Number(item.total ?? 0);
                const effectivePrice = qty > 0 ? total / qty : 0;

                return {
                    id: item.id,
                    recipe_id: item.recipe_id,
                    name: item.recipe_name || item.item_name || item.name || item.product_name || item.variant_name || 'Item',
                    qty: isNaN(qty) ? 1 : qty,
                    price: effectivePrice,
                    total: total,
                };
            }));
        } catch (error: any) {
            Alert.alert('Error', 'Failed to load order details: ' + (error.message || 'Unknown error'));
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const resetState = () => {
        setOrderDetails(null);
        setItems([]);
        setPayers([]);
        setPayerName('');
        setPayerEmail('');
        setPayerPhone('');
        setPaymentMethod('Cash');
        setCurrentPayerAssignments({});
    };

    const getAssignedQty = (itemId: number) => {
        return payers.reduce((sum, p) => {
            const item = p.items.find(it => it.id === `cart-item-${itemId}`);
            return sum + (item?.quantity || 0);
        }, 0);
    };

    const getRemainingQty = (item: OrderDetailItem) => {
        return item.qty - getAssignedQty(item.id);
    };

    const originalSubtotal = useMemo(() => items.reduce((sum, it) => sum + it.total, 0), [items]);
    const originalServiceCharge = useMemo(() => originalSubtotal * (serviceChargePercent / 100), [originalSubtotal, serviceChargePercent]);
    const originalTotal = originalSubtotal + originalServiceCharge;

    const selectedSubtotal = useMemo(() => {
        return Object.entries(currentPayerAssignments).reduce((sum, [id, qty]) => {
            const item = items.find(it => it.id === Number(id));
            return sum + (item ? item.price * qty : 0);
        }, 0);
    }, [currentPayerAssignments, items]);

    const selectedServiceCharge = selectedSubtotal * (serviceChargePercent / 100);
    const selectedPayerTotal = selectedSubtotal + selectedServiceCharge;

    const totalAssignedSubtotal = useMemo(() => payers.reduce((sum, p) => sum + p.itemsSubtotal, 0), [payers]);
    const assignmentProgress = originalSubtotal > 0 ? (totalAssignedSubtotal / originalSubtotal) * 100 : 0;
    const remainingSubtotal = originalSubtotal - totalAssignedSubtotal;

    const handleAddPayer = () => {
        if (!payerName.trim()) {
            Alert.alert('Error', 'Payer name is required');
            return;
        }

        const payerItems: SplitPayerItem[] = Object.entries(currentPayerAssignments)
            .filter(([_, qty]) => qty > 0)
            .map(([id, qty]) => {
                const item = items.find(it => it.id === Number(id))!;
                return {
                    id: `cart-item-${item.id}`,
                    name: item.name,
                    quantity: qty,
                    unitPrice: item.price,
                    totalPrice: item.price * qty,
                };
            });

        if (payerItems.length === 0) {
            Alert.alert('Error', 'No items assigned to this payer');
            return;
        }

        const newPayer: SplitPayer = {
            name: payerName,
            email: payerEmail || undefined,
            phone: payerPhone || undefined,
            paymentMethod,
            itemsSubtotal: selectedSubtotal,
            serviceCharge: selectedServiceCharge,
            totalAmount: selectedPayerTotal,
            items: payerItems,
        };

        setPayers([...payers, newPayer]);

        setPayerName('');
        setPayerEmail('');
        setPayerPhone('');
        setCurrentPayerAssignments({});
    };

    const handleRemovePayer = (index: number) => {
        const newPayers = [...payers];
        newPayers.splice(index, 1);
        setPayers(newPayers);
    };

    const setSplitQty = (itemId: number, qty: number, max: number) => {
        const val = Math.min(Math.max(0, qty), max);
        setCurrentPayerAssignments(prev => ({ ...prev, [itemId]: val }));
    };

    const handleCreateOrders = async () => {
        if (payers.length === 0) {
            Alert.alert('Error', 'Add at least one payer');
            return;
        }

        if (remainingSubtotal > 1) {
            Alert.alert('Warning', 'Not all items have been assigned. Are you sure you want to proceed?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Proceed', onPress: doSplit }
            ]);
        } else {
            doSplit();
        }
    };

    const doSplit = async () => {
        if (!orderId) return;
        setLoading(true);
        try {
            const res = await processSplitPayments(
                orderId,
                payers,
                originalTotal,
                originalServiceCharge
            );
            if (res.success) {
                Alert.alert('Success', 'Order split successfully');
                onSuccess();
                onClose();
            } else {
                Alert.alert('Error', res.message || 'Failed to split order');
            }
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to split order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={[styles.container, { padding: windowWidth > 1000 ? 50 : 15 }]}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Split Bill</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtnHeader}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollArea}>
                        {/* Assignment Progress */}
                        <View style={styles.section}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                <Text style={styles.sectionLabel}>Assignment Progress</Text>
                                <Text style={[styles.sectionLabel, { color: '#FF6B6B' }]}>{Math.round(assignmentProgress)}% Assigned</Text>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${assignmentProgress}%` }]} />
                            </View>
                        </View>

                        <View style={[styles.mainRow, isMobile && { flexDirection: 'column' }]}>
                            {/* Left Column: Items */}
                            <View style={[styles.leftCol, isMobile && { flex: 0 }]}>
                                <View style={styles.innerSection}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text style={styles.innerTitle}>Assign Items</Text>
                                        <View style={styles.orderBadge}>
                                            <Text style={styles.orderBadgeText}>Order #{orderId}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.tableHeadText, { flex: isMobile ? 1.5 : 2 }]}>Item</Text>
                                        {!isMobile && <Text style={[styles.tableHeadText, { flex: 1 }]}>Price</Text>}
                                        <Text style={[styles.tableHeadText, { flex: isMobile ? 0.7 : 0.5, textAlign: 'center' }]}>Avail</Text>
                                        <Text style={[styles.tableHeadText, { flex: 1, textAlign: 'center' }]}>Split</Text>
                                        {!isMobile && <Text style={[styles.tableHeadText, { flex: 1, textAlign: 'center' }]}>Actions</Text>}
                                    </View>

                                    {items.map(item => {
                                        const remaining = getRemainingQty(item);
                                        const currentVal = currentPayerAssignments[item.id] || 0;
                                        const assignedToThisItem = payers.map(p => {
                                            const found = p.items.find(it => it.id === `cart-item-${item.id}`);
                                            return found ? { name: p.name, qty: found.quantity, total: found.totalPrice } : null;
                                        }).filter(Boolean);

                                        return (
                                            <View key={item.id} style={styles.itemRowWrapper}>
                                                <View style={styles.tableRow}>
                                                    <View style={{ flex: isMobile ? 1.5 : 2 }}>
                                                        <Text style={styles.tableCellText}>{item.name}</Text>
                                                        {isMobile && <Text style={styles.mobileSubText}>{currencyLabel}{item.price.toFixed(2)}</Text>}
                                                    </View>
                                                    {!isMobile && <Text style={[styles.tableCellText, { flex: 1 }]}>{currencyLabel}{item.price.toFixed(2)}</Text>}
                                                    <View style={[styles.tableCellText, { flex: isMobile ? 0.7 : 0.5, alignItems: 'center' }]}>
                                                        <View style={[styles.qtyBox, { backgroundColor: '#FEE2E2' }]}><Text style={[styles.qtyBoxText, { color: '#FF6B6B' }]}>{remaining}</Text></View>
                                                        {isMobile && <Text style={styles.mobileSubText}>of {item.qty}</Text>}
                                                    </View>
                                                    <View style={[styles.tableCellText, { flex: 1, paddingHorizontal: 4 }]}>
                                                        <TextInput
                                                            style={styles.splitInput}
                                                            keyboardType="numeric"
                                                            value={String(currentVal)}
                                                            onChangeText={(v) => setSplitQty(item.id, parseInt(v) || 0, remaining + currentVal)}
                                                        />
                                                        <Text style={styles.splitAmount}>{currencyLabel}{(currentVal * item.price).toFixed(2)}</Text>
                                                    </View>
                                                    {!isMobile && (
                                                        <View style={[styles.tableCellText, { flex: 1, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                                                            <TouchableOpacity
                                                                style={styles.actionBtnSmall}
                                                                onPress={() => setSplitQty(item.id, remaining, remaining)}
                                                            >
                                                                <Text style={styles.actionBtnSmallText}>✓All</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={[styles.actionBtnSmall, { borderColor: '#E5E7EB' }]}
                                                                onPress={() => setSplitQty(item.id, 0, 0)}
                                                            >
                                                                <Text style={[styles.actionBtnSmallText, { color: '#6B7280' }]}>✕</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </View>

                                                {isMobile && (
                                                    <View style={styles.mobileActions}>
                                                        <TouchableOpacity
                                                            style={styles.actionBtnSmall}
                                                            onPress={() => setSplitQty(item.id, remaining, remaining)}
                                                        >
                                                            <Text style={styles.actionBtnSmallText}>✓ Assign All</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.actionBtnSmall, { borderColor: '#E5E7EB' }]}
                                                            onPress={() => setSplitQty(item.id, 0, 0)}
                                                        >
                                                            <Text style={[styles.actionBtnSmallText, { color: '#6B7280' }]}>✕ Reset</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}

                                                {assignedToThisItem.length > 0 && (
                                                    <View style={styles.assignedSection}>
                                                        <Text style={styles.assignedLabel}>Assigned to:</Text>
                                                        <View style={styles.assignedChips}>
                                                            {assignedToThisItem.map((a: any, i) => (
                                                                <View key={i} style={styles.chip}>
                                                                    <Text style={styles.chipText}>{a.name}: {a.qty}</Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Right Column: Add Payer & Summary */}
                            <View style={[styles.rightCol, isMobile && { flex: 0 }]}>
                                {/* Add Payer Form */}
                                <View style={styles.innerSection}>
                                    <Text style={styles.innerTitle}>Add Payer</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Payer Name *"
                                        placeholderTextColor="#9CA3AF"
                                        value={payerName}
                                        onChangeText={setPayerName}
                                    />
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TextInput
                                            style={[styles.formInput, { flex: 1 }]}
                                            placeholder="Email (optional)"
                                            placeholderTextColor="#9CA3AF"
                                            value={payerEmail}
                                            onChangeText={setPayerEmail}
                                        />
                                        <TextInput
                                            style={[styles.formInput, { flex: 1 }]}
                                            placeholder="Phone"
                                            placeholderTextColor="#9CA3AF"
                                            value={payerPhone}
                                            onChangeText={setPayerPhone}
                                        />
                                    </View>

                                    <View style={styles.selectedTotalBox}>
                                        <Text style={styles.selectedTotalLabel}>Requested for Payer:</Text>
                                        <Text style={styles.selectedTotalValue}>{currencyLabel}{selectedPayerTotal.toFixed(2)}</Text>
                                    </View>

                                    <TouchableOpacity style={styles.addPayerBtn} onPress={handleAddPayer}>
                                        <Text style={styles.addPayerBtnText}>+ Add Payer to Bill</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Bill Summary */}
                                <View style={styles.innerSection}>
                                    <Text style={styles.innerTitle}>Bill Summary</Text>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Subtotal:</Text>
                                        <Text style={styles.summaryValue}>{currencyLabel}{originalSubtotal.toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Service Charge ({serviceChargePercent}%):</Text>
                                        <Text style={styles.summaryValue}>{currencyLabel}{originalServiceCharge.toFixed(2)}</Text>
                                    </View>
                                    <View style={[styles.summaryRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 }]}>
                                        <Text style={[styles.summaryLabel, { fontWeight: '800', fontSize: 16, color: '#111827' }]}>Total Amount:</Text>
                                        <Text style={[styles.summaryValue, { fontWeight: '900', fontSize: 18, color: '#FF6B6B' }]}>{currencyLabel}{originalTotal.toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <Text style={[styles.summaryLabel, { color: '#059669', fontWeight: '700' }]}>Assigned:</Text>
                                        <Text style={[styles.summaryValue, { color: '#059669', fontWeight: '700' }]}>{currencyLabel}{(totalAssignedSubtotal + (totalAssignedSubtotal * (serviceChargePercent / 100))).toFixed(2)}</Text>
                                    </View>
                                    {remainingSubtotal > 0 && (
                                        <View style={styles.summaryRow}>
                                            <Text style={[styles.summaryLabel, { color: '#DC2626', fontWeight: '700' }]}>Unassigned:</Text>
                                            <Text style={[styles.summaryValue, { color: '#DC2626', fontWeight: '700' }]}>{currencyLabel}{(remainingSubtotal + (remainingSubtotal * (serviceChargePercent / 100))).toFixed(2)}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Split Bill Preview */}
                        {payers.length > 0 && (
                            <View style={[styles.section, { marginBottom: 32 }]}>
                                <Text style={styles.innerTitle}>Split Preview</Text>
                                <View style={styles.payerCountBadge}>
                                    <Text style={styles.payerCountText}>{payers.length} Payer{payers.length > 1 ? 's' : ''}</Text>
                                </View>

                                {payers.map((p, idx) => (
                                    <View key={idx} style={styles.payerPreviewCard}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.payerPreviewName}>{p.name}</Text>
                                            <Text style={styles.payerPreviewSub}>{p.items.length} items • {p.paymentMethod}</Text>
                                        </View>
                                        <View style={styles.payerPreviewTotalBox}>
                                            <Text style={styles.payerPreviewTotal}>{currencyLabel}{p.totalAmount.toFixed(2)}</Text>
                                        </View>
                                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleRemovePayer(idx)}>
                                            <Text style={styles.deleteBtnText}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.submitBtn, { opacity: payers.length > 0 ? 1 : 0.6 }]}
                            onPress={handleCreateOrders}
                            disabled={loading || payers.length === 0}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Split Orders</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        width: '100%',
        maxWidth: 1000,
        maxHeight: '92%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        backgroundColor: '#FFFFFF',
        position: 'relative',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
    },
    closeBtnHeader: {
        position: 'absolute',
        right: 20,
        padding: 5,
    },
    closeIcon: {
        fontSize: 20,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    scrollArea: {
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    progressBarBg: {
        height: 10,
        backgroundColor: '#F3F4F6',
        borderRadius: 5,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#FF6B6B',
        borderRadius: 5,
    },
    mainRow: {
        flexDirection: 'row',
        gap: 20,
    },
    leftCol: {
        flex: 1.8,
    },
    rightCol: {
        flex: 1.2,
    },
    innerSection: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    innerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 14,
    },
    orderBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    orderBadgeText: {
        color: '#4B5563',
        fontSize: 12,
        fontWeight: '800',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#FAFAFA',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    tableHeadText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#9CA3AF',
        textTransform: 'uppercase',
    },
    itemRowWrapper: {
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingVertical: 14,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tableCellText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        paddingHorizontal: 4,
    },
    qtyBox: {
        width: 30,
        height: 30,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,107,107,0.2)',
    },
    qtyBoxText: {
        fontSize: 14,
        fontWeight: '800',
    },
    splitInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        textAlign: 'center',
        fontSize: 15,
        fontWeight: '700',
        backgroundColor: '#FAFAFA',
        color: '#111827',
    },
    splitAmount: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FF6B6B',
        textAlign: 'center',
        marginTop: 4,
    },
    actionBtnSmall: {
        borderWidth: 1,
        borderColor: '#FF6B6B',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
    },
    actionBtnSmallText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FF6B6B',
    },
    mobileActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    mobileSubText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
        marginTop: 2,
    },
    assignedSection: {
        backgroundColor: '#FAFAFA',
        borderRadius: 8,
        padding: 10,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    assignedLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    assignedChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    chip: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipText: {
        color: '#374151',
        fontSize: 11,
        fontWeight: '700',
    },
    formInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        marginBottom: 12,
        color: '#111827',
        backgroundColor: '#FAFAFA',
    },
    selectedTotalBox: {
        backgroundColor: '#FFF1F1',
        borderRadius: 12,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,107,107,0.1)',
        alignItems: 'center',
        marginBottom: 16,
    },
    selectedTotalLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FF6B6B',
        marginBottom: 4,
    },
    selectedTotalValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FF6B6B',
    },
    addPayerBtn: {
        backgroundColor: '#FF6B6B',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#FF6B6B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    addPayerBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    summaryLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
    },
    payerCountBadge: {
        backgroundColor: '#FAFAFA',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    payerCountText: {
        color: '#FF6B6B',
        fontSize: 12,
        fontWeight: '800',
    },
    payerPreviewCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
    },
    payerPreviewName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    payerPreviewSub: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        marginTop: 2,
    },
    payerPreviewTotalBox: {
        backgroundColor: '#FF6B6B',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 10,
    },
    payerPreviewTotal: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
    },
    deleteBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtnText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '900',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 14,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#FAFAFA',
    },
    cancelBtn: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    cancelBtnText: {
        color: '#4B5563',
        fontSize: 16,
        fontWeight: '800',
    },
    submitBtn: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        backgroundColor: '#FF6B6B',
        borderRadius: 12,
        minWidth: 220,
        alignItems: 'center',
        shadowColor: '#FF6B6B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
});
