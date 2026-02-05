import React from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, TouchableWithoutFeedback, KeyboardAvoidingView, Keyboard, Platform, ScrollView, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  paymentMethod: string;
  setPaymentMethod: (s: string) => void;
  paidAmount: string;
  setPaidAmount: (s: string) => void;
  givenAmount: string;
  setGivenAmount: (s: string) => void;
  changeAmount: number | null;
  currencyLabel: string;
  finalizeOrderId: number | null;
  finalizeOrderTotal: number;
  formatForApiDate: () => string;
  paymentDropdownOpen: boolean;
  setPaymentDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  finalizeProcessing: boolean;
  onConfirm: () => Promise<void> | void;
};

export default function FinalizeModal(props: Props) {
  const {
    visible, onClose, paymentMethod, setPaymentMethod, paidAmount, setPaidAmount,
    givenAmount, setGivenAmount, changeAmount, currencyLabel, finalizeOrderId,
    formatForApiDate, paymentDropdownOpen, setPaymentDropdownOpen,
    finalizeProcessing, onConfirm
  } = props;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); if (!finalizeProcessing) onClose(); }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <ScrollView contentContainerStyle={styles.finalizeModalScroll} keyboardShouldPersistTaps="handled">
                <View style={styles.finalizeModalBox}>
                  <Text style={styles.title}>Finalize Order #{finalizeOrderId}</Text>

                  <Text style={styles.label}>Payment method</Text>
                  <TouchableOpacity style={[styles.input, styles.dropdown]} onPress={() => setPaymentDropdownOpen(p => !p)} activeOpacity={0.85}>
                    <Text style={styles.dropdownText}>{paymentMethod}</Text>
                    <Text style={styles.dropdownIcon}>{paymentDropdownOpen ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {paymentDropdownOpen && (
                    <View style={styles.paymentDropdown}>
                      {['Cash', 'Card', 'Free'].map(pm => (
                        <TouchableOpacity key={pm} style={styles.paymentOption} onPress={() => { setPaymentMethod(pm); setPaymentDropdownOpen(false); }}>
                          <Text style={paymentMethod === pm ? styles.paymentActive : styles.payment}>{pm}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.label}>Paid amount</Text>
                  <TextInput
                    style={[styles.input, paymentMethod === 'Free' && styles.inputDisabled]}
                    value={paidAmount}
                    onChangeText={setPaidAmount}
                    placeholder="e.g., 1785.00"
                    placeholderTextColor="#9CA3AF"
                    editable={paymentMethod !== 'Free'}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />

                  <Text style={styles.label}>Given amount (optional)</Text>
                  <TextInput
                    style={[styles.input, paymentMethod === 'Free' && styles.inputDisabled]}
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
                    <View style={styles.changeRow}>
                      <Text style={styles.changeLabel}>Change:</Text>
                      <Text style={styles.changeValue}>{currencyLabel}{changeAmount.toFixed(2)}</Text>
                    </View>
                  )}

                  <Text style={styles.dateText}>Order date: {formatForApiDate()}</Text>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => { Keyboard.dismiss(); if (!finalizeProcessing) onClose(); }}
                      disabled={finalizeProcessing}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.cancelText}>Close</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.confirmBtn, finalizeProcessing && styles.confirmBtnDisabled]}
                      onPress={() => { Keyboard.dismiss(); onConfirm(); }}
                      disabled={finalizeProcessing}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.confirmText}>{finalizeProcessing ? 'Processing...' : 'Confirm Finalize'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // overlay uses padding so the box can size itself and remain centered on tall screens
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 22, backgroundColor: 'rgba(0,0,0,0.2)' },
  // let the box control its width; don't force ScrollView to full width
  finalizeModalScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 12, alignItems: 'center' },
  // wider default and larger max for tablet / desktop screens
  finalizeModalBox: {
    width: '94%',
    maxWidth: 640,
    minWidth: 320,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignSelf: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '700', color: '#111827', fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 5, color: '#111827', backgroundColor: '#FFFFFF' },
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownText: { color: '#111827', fontSize: 15, flex: 1 },
  dropdownIcon: { color: '#6B7280', marginLeft: 8 },
  paymentDropdown: { paddingVertical: 6, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#FFFFFF', marginTop: 6 },
  paymentOption: { paddingVertical: 10, paddingHorizontal: 12 },
  paymentActive: { color: '#FF6B6B', fontWeight: '800' },
  payment: { color: '#111827', fontWeight: '700' },
  changeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  changeLabel: { fontSize: 15, fontWeight: '700', color: '#374151' },
  changeValue: { fontSize: 16, fontWeight: '800', color: '#059669' },
  dateText: { fontSize: 13, color: '#6B7280', marginBottom: 16, textAlign: 'left' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  cancelText: { color: '#374151', fontWeight: '700', fontSize: 15 },
  confirmBtn: { flex: 1, backgroundColor: '#FF6B6B', paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
