import React from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, ScrollView } from 'react-native';
import type { MenuItem } from '../../types/menu';

type Props = {
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  categories: any[];
  selectedCategoryId: number | string | null;
  setSelectedCategoryId: (id: any) => void;
  filteredMenuItems: MenuItem[];
  cart: any[];
  addToCart: (item: MenuItem) => void;
  updateQuantity: (entryId: string, delta: number) => void;
  findPreferredEntryId: (menuId: number | string) => string | undefined;
  imageErrors: Record<number, boolean>;
  setImageErrors: (v: Record<number, boolean>) => void;
  imageBase: string;
  isTabletOrPOS: boolean;
  runningOrdersLength: number;
  openRunning: () => void;
  currencyLabel: string;
  cartTotal: number;
  showCart: boolean;
  setShowCart: (b: boolean) => void;
  styles: any;
};

export default function MenuList(props: Props) {
  const {
    searchQuery, setSearchQuery, categories, selectedCategoryId, setSelectedCategoryId,
    filteredMenuItems, cart, addToCart, updateQuantity, findPreferredEntryId,
    imageErrors, setImageErrors, imageBase, isTabletOrPOS, runningOrdersLength,
    openRunning, currencyLabel, cartTotal, showCart, setShowCart, styles
  } = props;

  return (
    <>
      <View style={[styles.searchBar, isTabletOrPOS && styles.tabletSearchBar]}>
        <View style={[styles.searchInputWrapper, isTabletOrPOS && styles.tabletSearchInputWrapper]}>
          <TextInput
            style={[styles.searchInput, isTabletOrPOS && styles.tabletSearchInput]}
            placeholder="Search items..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.countBadge}>
          <TouchableOpacity
            style={[styles.ongoingToggle, isTabletOrPOS && styles.tabletOngoingToggle]}
            onPress={openRunning}
            activeOpacity={0.85}
          >
            <Text style={[styles.ongoingToggleText, isTabletOrPOS && styles.tabletOngoingToggleText]}>Running</Text>
            <View style={styles.ongoingBadge}>
              <Text style={styles.ongoingBadgeText}>{runningOrdersLength}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.categoryArea, isTabletOrPOS && styles.tabletCategoryArea]}>
        {categories.length > 0 && (() => {
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
              renderItem={({ item }) => {
                const isAll = item.id === '__all__';
                const catId = isAll ? null : item.id;
                const isActive = (isAll && selectedCategoryId === null) || (!isAll && String(selectedCategoryId) === String(item.id));
                return (
                  <TouchableOpacity activeOpacity={0.85} onPress={() => setSelectedCategoryId(catId)}
                    style={[styles.categoryPill, isTabletOrPOS && styles.tabletCategoryPill, isActive && styles.categoryPillActive, isTabletOrPOS && isActive && styles.tabletCategoryPillActive]}>
                    <Text style={[styles.categoryLabel, isTabletOrPOS && styles.tabletCategoryLabel, isActive && styles.categoryLabelActive]} numberOfLines={1} allowFontScaling={false}>
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
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.menuList, isTabletOrPOS && styles.tabletMenuList]}
        showsVerticalScrollIndicator={false}
        numColumns={isTabletOrPOS ? 2 : undefined}
        columnWrapperStyle={isTabletOrPOS ? styles.tabletMenuColumnWrapper : undefined}
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
                  <Image source={{ uri: imgUri }} style={[styles.menuImage, isTabletOrPOS && styles.tabletMenuImage]} onError={() => setImageErrors({ ...imageErrors, [item.id]: true })} />
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
}
