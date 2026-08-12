import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicInput,
  NeumorphicPressable,
  NeumorphicSurface,
} from '@/components/ui';
import { useSQLiteContext } from '@/db/provider';
import { useAuthStore } from '@/stores/use-auth-store';
import { Category } from '@/db/schema';
import {
  findCategoriesByUser,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/db/category-repo';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme';

const PRESET_COLORS = ['#3c87f7', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIsIncome, setNewIsIncome] = useState(false);
  const [newIsDeductible, setNewIsDeductible] = useState(true);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  const loadCategories = useCallback(async () => {
    if (!user) return;
    try {
      const cats = await findCategoriesByUser(db, user.id);
      setCategories(cats);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('closed')) return;
      console.warn('loadCategories error:', e);
    }
  }, [db, user]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCategories();
    setRefreshing(false);
  }, [loadCategories]);

  const handleAdd = useCallback(async () => {
    if (!newName.trim() || !user) return;

    await createCategory(db, {
      userId: user.id,
      name: newName.trim(),
      color: selectedColor,
      isIncome: newIsIncome,
      isDeductible: newIsIncome ? false : newIsDeductible,
      isHidden: false,
      sortOrder: categories.length,
    });

    setNewName('');
    setNewIsDeductible(true);
    setShowAddForm(false);
    await loadCategories();
  }, [db, user, newName, newIsIncome, newIsDeductible, selectedColor, categories.length, loadCategories]);

  const handleToggleIncome = useCallback(
    async (cat: Category) => {
      await updateCategory(db, cat.id, { isIncome: !cat.isIncome });
      await loadCategories();
    },
    [db, loadCategories]
  );

  const handleToggleHidden = useCallback(
    async (cat: Category) => {
      await updateCategory(db, cat.id, { isHidden: !cat.isHidden });
      await loadCategories();
    },
    [db, loadCategories]
  );

  const handleToggleDeductible = useCallback(
    async (cat: Category) => {
      await updateCategory(db, cat.id, { isDeductible: !cat.isDeductible });
      await loadCategories();
    },
    [db, loadCategories]
  );

  const handleDelete = useCallback(
    (cat: Category) => {
      Alert.alert('Delete Category', `Delete "${cat.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(db, cat.id);
            await loadCategories();
          },
        },
      ]);
    },
    [db, loadCategories]
  );

  const incomeCategories = categories.filter((c) => c.isIncome && !c.isHidden);
  const expenseCategories = categories.filter((c) => !c.isIncome && !c.isHidden);

  const renderCategory = useCallback(
    ({ item }: { item: Category }) => (
      <NeumorphicCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.colorDot, { backgroundColor: item.color ?? colors.primary }]} />
          <ThemedText type="default" style={{ flex: 1, fontWeight: '600' }}>
            {item.name}
          </ThemedText>
          <NeumorphicSurface small style={styles.badge}>
            <ThemedText type="small" style={{ color: item.isIncome ? colors.success : colors.danger }}>
              {item.isIncome ? 'Income' : 'Expense'}
            </ThemedText>
          </NeumorphicSurface>
        </View>
        <View style={styles.cardActions}>
          <Pressable onPress={() => handleToggleIncome(item)} style={styles.actionBtn}>
            <ThemedText type="small" themeColor="textSecondary">
              Switch to {item.isIncome ? 'Expense' : 'Income'}
            </ThemedText>
          </Pressable>
          {!item.isIncome && (
            <Pressable onPress={() => handleToggleDeductible(item)} style={styles.actionBtn}>
              <ThemedText
                type="small"
                style={{ color: item.isDeductible ? colors.success : colors.warning }}
              >
                {item.isDeductible ? 'Deductible' : 'Not Deductible'}
              </ThemedText>
            </Pressable>
          )}
          <Pressable onPress={() => handleDelete(item)} style={styles.actionBtn}>
            <ThemedText type="small" style={{ color: colors.danger }}>Delete</ThemedText>
          </Pressable>
        </View>
      </NeumorphicCard>
    ),
    [handleToggleIncome, handleToggleDeductible, handleDelete, colors.primary, colors.success, colors.danger, colors.warning]
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <FlashList
          data={[]}
          keyExtractor={() => 'dummy'}
          renderItem={null}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + Spacing.three,
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View>
              <View style={styles.header}>
                <ThemedText type="title">Categories</ThemedText>
                <Pressable
                  onPress={() => setShowAddForm(!showAddForm)}
                  style={[styles.addButton, { backgroundColor: colors.primary }]}>
                  <SymbolView
                    name={{ ios: showAddForm ? 'xmark' : 'plus', android: showAddForm ? 'close' : 'add', web: showAddForm ? 'close' : 'add' }}
                    size={20}
                    tintColor={colors.primaryText}
                  />
                </Pressable>
              </View>

              {/* Add Form */}
              {showAddForm && (
                <NeumorphicCard style={styles.addForm}>
                  <NeumorphicInput
                    placeholder="Category name"
                    value={newName}
                    onChangeText={setNewName}
                    underlineColorAndroid="transparent"
                  />

                  <View style={styles.toggleRow}>
                    <NeumorphicPressable
                      inset
                      onPress={() => setNewIsIncome(false)}
                      style={[styles.toggleBtn, !newIsIncome && { backgroundColor: colors.danger }]}>
                      <ThemedText type="small" style={{ color: !newIsIncome ? colors.primaryText : colors.danger }}>
                        Expense
                      </ThemedText>
                    </NeumorphicPressable>
                    <NeumorphicPressable
                      inset
                      onPress={() => setNewIsIncome(true)}
                      style={[styles.toggleBtn, newIsIncome && { backgroundColor: colors.success }]}>
                      <ThemedText type="small" style={{ color: newIsIncome ? colors.primaryText : colors.success }}>
                        Income
                      </ThemedText>
                    </NeumorphicPressable>
                  </View>

                  {!newIsIncome && (
                    <View style={styles.toggleRow}>
                      <NeumorphicPressable
                        inset
                        onPress={() => setNewIsDeductible(true)}
                        style={[styles.toggleBtn, newIsDeductible && { backgroundColor: colors.success }]}>
                        <ThemedText type="small" style={{ color: newIsDeductible ? colors.primaryText : colors.success }}>
                          Deductible
                        </ThemedText>
                      </NeumorphicPressable>
                      <NeumorphicPressable
                        inset
                        onPress={() => setNewIsDeductible(false)}
                        style={[styles.toggleBtn, !newIsDeductible && { backgroundColor: colors.warning }]}>
                        <ThemedText type="small" style={{ color: !newIsDeductible ? colors.primaryText : colors.warning }}>
                          Not Deductible
                        </ThemedText>
                      </NeumorphicPressable>
                    </View>
                  )}

                  <View style={styles.colorRow}>
                    {PRESET_COLORS.map((color) => (
                      <Pressable
                        key={color}
                        onPress={() => setSelectedColor(color)}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color },
                          selectedColor === color && [styles.colorOptionSelected, { borderColor: colors.text }],
                        ]}
                      />
                    ))}
                  </View>

                  <NeumorphicButton
                    onPress={handleAdd}
                    disabled={!newName.trim()}
                    style={[styles.saveBtn, !newName.trim() && styles.saveBtnDisabled]}
                  >
                    Add Category
                  </NeumorphicButton>
                </NeumorphicCard>
              )}

              {/* Income Categories */}
              {incomeCategories.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="callout" style={styles.sectionTitle}>
                    Income Categories
                  </ThemedText>
                  {incomeCategories.map((cat) => (
                    <View key={cat.id}>{renderCategory({ item: cat })}</View>
                  ))}
                </View>
              )}

              {/* Expense Categories */}
              {expenseCategories.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="callout" style={styles.sectionTitle}>
                    Expense Categories
                  </ThemedText>
                  {expenseCategories.map((cat) => (
                    <View key={cat.id}>{renderCategory({ item: cat })}</View>
                  ))}
                </View>
              )}

              {categories.length === 0 && (
                <View style={styles.empty}>
                  <ThemedText type="small" themeColor="textSecondary">
                    No categories yet. Tap + to create your first category.
                  </ThemedText>
                </View>
              )}
            </View>
          }
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addForm: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.three,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorOptionSelected: {
    borderWidth: 3,
  },
  saveBtn: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  section: {
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  actionBtn: {
    paddingVertical: Spacing.half,
  },
  empty: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
});
