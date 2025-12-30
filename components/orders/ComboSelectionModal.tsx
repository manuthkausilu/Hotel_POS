import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, TouchableWithoutFeedback, Keyboard, Image, StyleSheet } from 'react-native';

const imageBase = 'https://app.trackerstay.com/storage/';

interface ComboSelectionModalProps {
  visible: boolean;
  comboContext: { baseItem: any | null; combos: any[] } | null;
  selectedComboChoices: Record<string | number, number>;
  onSelectChoice: (key: string | number, menuId: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ComboSelectionModal({
  visible,
  comboContext,
  selectedComboChoices,
  onSelectChoice,
  onConfirm,
  onCancel,
}: ComboSelectionModalProps) {
  if (!comboContext) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
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
                    <Text style={{ fontWeight: '700', marginBottom: 8 }}>
                      {c.combo_title ?? c.title ?? c.name ?? `Choice ${idx + 1}`}
                    </Text>
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
                            onPress={() => onSelectChoice(key, menuId)}
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
                              <Text style={styles.comboOptionName}>
                                {menu?.name ?? menu?.title ?? 'Option'}
                              </Text>
                              {menu?.price ? (
                                <Text style={{ color: '#666' }}>Rs {Number(menu.price).toFixed(2)}</Text>
                              ) : null}
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
              <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={onConfirm}>
                <Text style={styles.submitText}>Add to cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 14, width: '95%', maxWidth: 700, borderWidth: 1, borderColor: '#E5E7EB' },
  modalHeader: { paddingVertical: 16, paddingHorizontal: 20, backgroundColor: '#FF6B6B', alignItems: 'flex-start' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  comboOptionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#FFFFFF', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  comboOptionSelected: { borderWidth: 2, borderColor: '#FF6B6B', backgroundColor: '#FFF1F1' },
  comboOptionImage: { width: 64, height: 64, borderRadius: 10, marginRight: 12, backgroundColor: '#F3F4F6', resizeMode: 'cover' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#6B7280', fontSize: 12 },
  comboOptionInfo: { flex: 1, justifyContent: 'center' },
  comboOptionName: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  modalActionsRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 12 },
  cancelButton: { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelText: { color: '#111827', fontWeight: '700' },
  submitButton: { flex: 1, backgroundColor: '#FF6B6B', paddingVertical: 12, borderRadius: 10, alignItems: 'center', shadowColor: '#FF6B6B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  submitText: { color: '#FFFFFF', fontWeight: '800' },
});
