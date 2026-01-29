import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  summary: any | null;
  currencyLabel: string;
};

export default function PlacedOrderModal({ visible, onClose, summary, currencyLabel }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          <TouchableWithoutFeedback>
            <View style={{ backgroundColor: '#fff', padding: 18, borderRadius: 14, width: '95%', maxHeight: '80%', borderWidth: 1, borderColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                {summary?.finalized ? 'Order Finalized' : 'Order Placed'}
              </Text>

              {summary && (
                <ScrollView>
                  <Text style={{ marginVertical: 4 }}>Order ID: {summary.orderId}</Text>
                  <Text style={{ marginVertical: 4 }}>Order Number: {summary.orderNumber}</Text>
                  {summary.finalized && <Text style={{ marginVertical: 4 }}>Payment: {summary.paymentMethod}</Text>}
                  <Text style={{ marginTop: 12, fontWeight: '700' }}>Items:</Text>
                  {summary.items.map((item: any, idx: number) => (
                    <Text key={idx} style={{ marginVertical: 4 }}>
                      {item.qty}x {item.name} - {currencyLabel}{(item.qty * item.price).toFixed(2)}
                    </Text>
                  ))}
                  <Text style={{ marginVertical: 4 }}>Subtotal: {currencyLabel}{summary.subtotal.toFixed(2)}</Text>
                  <Text style={{ marginVertical: 4 }}>Service Charge: {currencyLabel}{summary.serviceCharge.toFixed(2)}</Text>
                  <Text style={{ fontWeight: '700', fontSize: 16, marginTop: 8 }}>Total: {currencyLabel}{summary.total.toFixed(2)}</Text>
                  {summary.finalized && (
                    <Text style={{ color: '#059669', fontWeight: '700', marginTop: 8 }}>✓ Order has been finalized</Text>
                  )}
                </ScrollView>
              )}

              <TouchableOpacity style={{ backgroundColor: '#FF6B6B', padding: 10, borderRadius: 5, marginTop: 12, alignItems: 'center' }} onPress={onClose}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
