import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
  const user = useAuthStore((state) => state.user);
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIsIncome, setNewIsIncome] = useState(false);
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
      isHidden: false,
      sortOrder: categories.length,
    });

    setNewName('');
    setShowAddForm(false);
    await loadCategories();
  }, [db, user, newName, newIsIncome, selectedColor, categories.length, loadCategories]);

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
      <View style={[styles.card, { borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.colorDot, { backgroundColor: item.color ?? colors.primary }]} />
          <ThemedText type="default" style={{ flex: 1, fontWeight: '600' }}>
            {item.name}
          </ThemedText>
          <View style={[styles.badge, { backgroundColor: colors.backgroundElement }]}>
            <ThemedText type="small" style={{ color: item.isIncome ? colors.success : colors.danger }}>
              {item.isIncome ? 'Income' : 'Expense'}
            </ThemedText>
          </View>
        </View>
        <View style={styles.cardActions}>
          <Pressable onPress={() => handleToggleIncome(item)} style={styles.actionBtn}>
            <ThemedText type="small" themeColor="textSecondary">
              Switch to {item.isIncome ? 'Expense' : 'Income'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => handleDelete(item)} style={styles.actionBtn}>
            <ThemedText type="small" style={{ color: colors.danger }}>Delete</ThemedText>
          </Pressable>
        </View>
      </View>
    ),
    [handleToggleIncome, handleDelete, colors.cardBorder, colors.primary, colors.backgroundElement, colors.success, colors.danger]
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={[]}
          keyExtractor={() => 'dummy'}
          renderItem={null}
          contentContainerStyle={styles.scroll}
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
                <View style={[styles.addForm, { borderColor: colors.cardBorder }]}>
                  <TextInput
                    style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
                    placeholder="Category name"
                    value={newName}
                    onChangeText={setNewName}
                    placeholderTextColor={colors.placeholder}
                  />

                  <View style={styles.toggleRow}>
                    <Pressable
                      onPress={() => setNewIsIncome(false)}
                      style={[styles.toggleBtn, { borderColor: colors.inputBorder }, !newIsIncome && { backgroundColor: colors.danger, borderColor: colors.danger }]}>
                      <ThemedText type="small" style={{ color: !newIsIncome ? colors.primaryText : colors.danger }}>
                        Expense
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => setNewIsIncome(true)}
                      style={[styles.toggleBtn, { borderColor: colors.inputBorder }, newIsIncome && { backgroundColor: colors.success, borderColor: colors.success }]}>
                      <ThemedText type="small" style={{ color: newIsIncome ? colors.primaryText : colors.success }}>
                        Income
                      </ThemedText>
                    </Pressable>
                  </View>

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

                  <Pressable
                    onPress={handleAdd}
                    style={[styles.saveBtn, { backgroundColor: colors.primary }, !newName.trim() && styles.saveBtnDisabled]}
                    disabled={!newName.trim()}>
                    <ThemedText type="default" style={{ color: colors.primaryText, fontWeight: '600' }}>
                      Add Category
                    </ThemedText>
                  </Pressable>
                </View>
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
      </SafeAreaView>
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
    borderWidth: 1,
    marginBottom: Spacing.three,
  },
  input: {
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
