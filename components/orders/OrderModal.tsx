import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, TextInput, TouchableWithoutFeedback, KeyboardAvoidingView, Keyboard, Platform, Switch } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  orderDetails: any;
  setOrderDetails: (d: any) => void;
  customers: any[];
  customersLoading: boolean;
  customersError: string | null;
  customerDropdownOpen: boolean;
  setCustomerDropdownOpen: (v: boolean) => void;
  customerRooms: any[];
  roomsLoading: boolean;
  roomsError: string | null;
  roomDropdownOpen: boolean;
  setRoomDropdownOpen: (v: boolean) => void;
  stewards: any[];
  stewardsLoading: boolean;
  stewardsError: string | null;
  stewardDropdownOpen: boolean;
  setStewardDropdownOpen: (v: boolean) => void;
  enableServiceCharge: boolean;
  setEnableServiceCharge: (v: boolean) => void;
  serviceChargePercent: number;
  immediateFinalize: boolean;
  setImmediateFinalize: (v: boolean) => void;
  submitPaymentMethod: string;
  setSubmitPaymentMethod: (s: string) => void;
  submitPaidAmount: string;
  setSubmitPaidAmount: (s: string) => void;
  submitGivenAmount: string;
  setSubmitGivenAmount: (s: string) => void;
  submitChangeAmount: number | null;
  submitPaymentDropdownOpen: boolean;
  setSubmitPaymentDropdownOpen: (b: boolean) => void;
  submitProcessing: boolean;
  onSubmit: () => Promise<void>;
  onUpdate: () => Promise<void>;
  editingRunningOrderId: number | null;
  cartTotal: number;
  displayedServiceCharge: number;
  currencyLabel: string;
  orderModalScrollRef: any;
  formatCustomerName: (c: any) => string;
  roomLabel: (r: any) => string;
  customersList?: any[];
};

export default function OrderModal(props: Props) {
  const {
    visible, onClose, orderDetails, setOrderDetails,
    customers, customersLoading, customersError, customerDropdownOpen, setCustomerDropdownOpen,
    customerRooms, roomsLoading, roomsError, roomDropdownOpen, setRoomDropdownOpen,
    stewards, stewardsLoading, stewardsError, stewardDropdownOpen, setStewardDropdownOpen,
    enableServiceCharge, setEnableServiceCharge, serviceChargePercent,
    immediateFinalize, setImmediateFinalize,
    submitPaymentMethod, setSubmitPaymentMethod, submitPaidAmount, setSubmitPaidAmount,
    submitGivenAmount, setSubmitGivenAmount, submitChangeAmount,
    submitPaymentDropdownOpen, setSubmitPaymentDropdownOpen,
    submitProcessing, onSubmit, onUpdate, editingRunningOrderId,
    cartTotal, displayedServiceCharge, currencyLabel, orderModalScrollRef,
    formatCustomerName, roomLabel
  } = props;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <ScrollView
              ref={orderModalScrollRef}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ backgroundColor: '#FFF', padding: 18, borderRadius: 14, width: '95%', maxWidth: 700 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>{editingRunningOrderId ? 'Update Order' : 'Order Details'}</Text>

                {/* Order type segmented control simplified */}
                <Text style={{ marginTop: 12, marginBottom: 6, fontWeight: '700' }}>Order Type *</Text>
                <View style={{ flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' }}>
                  {['Dine In', 'Take away'].map(type => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setOrderDetails((p: any) => ({ ...p, orderType: type, tableId: type.toLowerCase().includes('take') ? '' : p.tableId }))}
                      style={[{ flex: 1, paddingVertical: 10, alignItems: 'center' }, orderDetails.orderType === type ? { backgroundColor: '#FF6B6B' } : {}]}
                    >
                      <Text style={orderDetails.orderType === type ? { color: '#fff', fontWeight: '700' } : { color: '#111827', fontWeight: '700' }}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Customer / Room / Steward fields (kept simple, using parent's dropdown flags) */}
                <Text style={{ marginTop: 12, marginBottom: 6, fontWeight: '700' }}>Customer</Text>
                <TouchableOpacity style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 5 }} onPress={() => setCustomerDropdownOpen(!customerDropdownOpen)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text>{orderDetails.customer ? (formatCustomerName(customers.find(c => String(c.id) === String(orderDetails.customer))) || `#${orderDetails.customer}`) : 'Walk-in Customer'}</Text>
                    <Text style={{ color: '#6B7280' }}>{customerDropdownOpen ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>
                {customerDropdownOpen && (
                  <View style={{ marginTop: 6, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#fff' }}>
                    <TouchableOpacity style={{ padding: 10 }} onPress={() => { setOrderDetails((p:any)=>({...p, customer: '', room: ''})); setCustomerDropdownOpen(false); setRoomDropdownOpen(false); }}>
                      <Text style={!orderDetails.customer ? { color: '#FF6B6B', fontWeight: '800' } : {}}>Walk-in Customer</Text>
                    </TouchableOpacity>
                    {customersLoading && <Text style={{ padding: 8 }}>Loading...</Text>}
                    {customersError && <Text style={{ padding: 8, color: 'red' }}>{customersError}</Text>}
                    {customers.map(c => (
                      <TouchableOpacity key={String(c.id)} style={{ padding: 10 }} onPress={() => { setOrderDetails((p:any)=>({...p, customer: String(c.id), room: ''})); setCustomerDropdownOpen(false); }}>
                        <Text style={orderDetails.customer === String(c.id) ? { color: '#FF6B6B', fontWeight: '800' } : {}}>{formatCustomerName(c)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Room */}
                <Text style={{ marginTop: 12, marginBottom: 6, fontWeight: '700' }}>Room</Text>
                <TouchableOpacity style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 5 }} onPress={() => { if (!orderDetails.customer || roomsLoading) return; setRoomDropdownOpen(!roomDropdownOpen); }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text>{!orderDetails.customer ? 'Select customer first' : roomsLoading ? 'Loading rooms...' : orderDetails.room ? (roomLabel(customerRooms.find(r=>String(r.room?.id)===String(orderDetails.room)))||`#${orderDetails.room}`) : (customerRooms.length>0 ? 'Select room' : 'No rooms found')}</Text>
                    <Text style={{ color: '#6B7280' }}>{roomDropdownOpen ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>
                {roomDropdownOpen && orderDetails.customer && !roomsLoading && (
                  <View style={{ marginTop: 6, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#fff' }}>
                    <TouchableOpacity style={{ padding: 10 }} onPress={() => { setOrderDetails((p:any)=>({...p, room: ''})); setRoomDropdownOpen(false); }}>
                      <Text style={!orderDetails.room ? { color: '#FF6B6B', fontWeight: '800' } : {}}>None</Text>
                    </TouchableOpacity>
                    {customerRooms.map((ri, idx) => {
                      const id = String(ri?.room?.id ?? idx);
                      return (
                        <TouchableOpacity key={id} style={{ padding: 10 }} onPress={() => { setOrderDetails((p:any)=>({...p, room: id})); setRoomDropdownOpen(false); }}>
                          <Text style={orderDetails.room === id ? { color: '#FF6B6B', fontWeight: '800' } : {}}>{roomLabel(ri) || `#${id}`}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Steward */}
                <Text style={{ marginTop: 12, marginBottom: 6, fontWeight: '700' }}>Steward</Text>
                <TouchableOpacity style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 5 }} onPress={() => setStewardDropdownOpen(!stewardDropdownOpen)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text>{orderDetails.stewardId ? (stewards.find((s:any)=>String(s.id)===String(orderDetails.stewardId))?.first_name || `#${orderDetails.stewardId}`) : 'None'}</Text>
                    <Text style={{ color: '#6B7280' }}>{stewardDropdownOpen ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>
                {stewardDropdownOpen && (
                  <View style={{ marginTop: 6, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#fff' }}>
                    <TouchableOpacity style={{ padding: 10 }} onPress={() => { setOrderDetails((p:any)=>({...p, stewardId: ''})); setStewardDropdownOpen(false); }}>
                      <Text style={!orderDetails.stewardId ? { color: '#FF6B6B', fontWeight: '800' } : {}}>None</Text>
                    </TouchableOpacity>
                    {stewardsLoading && <Text style={{ padding: 8 }}>Loading...</Text>}
                    {stewardsError && <Text style={{ padding: 8, color: 'red' }}>{stewardsError}</Text>}
                    {stewards.map(s => (
                      <TouchableOpacity key={String(s.id)} style={{ padding: 10 }} onPress={() => { setOrderDetails((p:any)=>({...p, stewardId: String(s.id)})); setStewardDropdownOpen(false); }}>
                        <Text style={orderDetails.stewardId === String(s.id) ? { color: '#FF6B6B', fontWeight: '800' } : {}}>{s.first_name || `#${s.id}`}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                  <Text>Enable Service Charge ({serviceChargePercent}%)</Text>
                  <Switch value={enableServiceCharge} onValueChange={setEnableServiceCharge} />
                </View>

                {!editingRunningOrderId && (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                      <Text>Finalize Immediately</Text>
                      <Switch value={immediateFinalize} onValueChange={(val)=>{ setImmediateFinalize(val); if(!val){ setSubmitPaymentMethod('Cash'); setSubmitPaidAmount(''); setSubmitGivenAmount(''); setSubmitPaymentDropdownOpen(false); } }} />
                    </View>

                    {immediateFinalize && (
                      <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginVertical: 12 }}>
                        <Text style={{ fontWeight: '700' }}>Payment Method</Text>
                        <TouchableOpacity style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 5, marginTop: 8 }} onPress={() => setSubmitPaymentDropdownOpen(!submitPaymentDropdownOpen)}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text>{submitPaymentMethod}</Text>
                            <Text>{submitPaymentDropdownOpen ? '▲' : '▼'}</Text>
                          </View>
                        </TouchableOpacity>
                        {submitPaymentDropdownOpen && ['Cash','Card','Free'].map(pm => (
                          <TouchableOpacity key={pm} style={{ padding: 10 }} onPress={() => { setSubmitPaymentMethod(pm); setSubmitPaymentDropdownOpen(false); }}>
                            <Text style={submitPaymentMethod===pm ? { color: '#FF6B6B', fontWeight: '800' } : {}}>{pm}</Text>
                          </TouchableOpacity>
                        ))}

                        <Text style={{ marginTop: 8, fontWeight: '700' }}>Paid Amount</Text>
                        <TextInput style={{ borderWidth:1, borderColor:'#E5E7EB', padding:10, borderRadius:5, marginTop:6, backgroundColor: submitPaymentMethod==='Free' ? '#F3F4F6' : '#fff' }} value={submitPaidAmount} onChangeText={setSubmitPaidAmount} editable={submitPaymentMethod!=='Free'} keyboardType="numeric" />

                        <Text style={{ marginTop: 8, fontWeight: '700' }}>Given Amount (optional)</Text>
                        <TextInput style={{ borderWidth:1, borderColor:'#E5E7EB', padding:10, borderRadius:5, marginTop:6, backgroundColor: submitPaymentMethod==='Free' ? '#F3F4F6' : '#fff' }} value={submitGivenAmount} onChangeText={setSubmitGivenAmount} editable={submitPaymentMethod!=='Free'} keyboardType="numeric" />

                        {submitChangeAmount !== null && (
                          <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
                            <Text style={{ fontWeight:'700' }}>Change:</Text>
                            <Text style={{ fontWeight:'800', color:'#059669' }}>{currencyLabel}{submitChangeAmount.toFixed(2)}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}

                {/* Price Summary */}
                <View style={{ backgroundColor:'#F9FAFB', borderRadius:12, padding:12, marginVertical:12 }}>
                  <Text style={{ fontWeight:'800' }}>Order Summary</Text>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
                    <Text>Subtotal:</Text><Text>{currencyLabel}{cartTotal.toFixed(2)}</Text>
                  </View>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
                    <Text>Service Charge ({serviceChargePercent}%):</Text><Text>{currencyLabel}{enableServiceCharge ? displayedServiceCharge.toFixed(2) : '0.00'}</Text>
                  </View>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:12, borderTopWidth:1, borderTopColor:'#FF6B6B', paddingTop:12 }}>
                    <Text style={{ fontWeight:'800' }}>Total:</Text>
                    <Text style={{ fontWeight:'900', color:'#FF6B6B' }}>{currencyLabel}{(cartTotal + displayedServiceCharge).toFixed(2)}</Text>
                  </View>
                </View>

                <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                  <TouchableOpacity style={{ backgroundColor:'#F3F4F6', padding:10, borderRadius:5 }} onPress={onClose}>
                    <Text>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ backgroundColor:'#FF6B6B', padding:10, borderRadius:5, opacity: submitProcessing ? 0.6 : 1 }} onPress={editingRunningOrderId ? onUpdate : onSubmit} disabled={submitProcessing}>
                    <Text style={{ color:'#fff' }}>{submitProcessing ? 'Processing...' : editingRunningOrderId ? 'Update Order' : (immediateFinalize ? 'Submit & Finalize' : 'Submit Order')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}
