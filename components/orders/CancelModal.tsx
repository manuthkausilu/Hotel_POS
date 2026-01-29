import React from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  reason: string;
  setReason: (s: string) => void;
  onConfirm: () => Promise<void>;
  processing: boolean;
  orderId: number | null;
};

export default function CancelModal({ visible, onClose, reason, setReason, onConfirm, processing, orderId }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.2)' }}>
          <TouchableWithoutFeedback>
            <View style={{ width: '90%', maxWidth: 520, backgroundColor:'#fff', padding:18, borderRadius:14, borderWidth:1, borderColor:'#E5E7EB' }}>
              <Text style={{ fontSize:16, fontWeight:'800', marginBottom:8 }}>Cancel Order #{orderId}</Text>
              <Text style={{ fontSize:14, color:'#DC2626', marginBottom:8 }}>* Reason is required</Text>

              <TextInput
                style={{ borderWidth:1, borderColor:'#E5E7EB', padding:10, borderRadius:5, minHeight:80, textAlignVertical:'top', backgroundColor:'#fff' }}
                placeholder="Reason for cancellation *"
                placeholderTextColor="#9CA3AF"
                value={reason}
                onChangeText={setReason}
                editable={!processing}
                multiline
              />

              <View style={{ flexDirection:'row', marginTop:12, gap:12 }}>
                <TouchableOpacity
                  style={{ flex:1, backgroundColor:'transparent', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:12, borderRadius:10, alignItems:'center' }}
                  onPress={onClose}
                  disabled={processing}
                >
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flex:1, backgroundColor:'#FF6B6B', paddingVertical:12, borderRadius:10, alignItems:'center' }}
                  onPress={onConfirm}
                  disabled={processing}
                >
                  <Text style={{ color:'#fff', fontWeight:'800' }}>{processing ? 'Processing...' : 'Confirm Cancel'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
