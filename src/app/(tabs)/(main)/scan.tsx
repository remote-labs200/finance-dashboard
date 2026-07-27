import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColors } from '@/hooks/use-theme';
import { useSQLiteContext } from '@/db/provider';
import { useAuthStore } from '@/stores/use-auth-store';
import { createTransaction } from '@/db/transaction-repo';
import { findAccountsByUser } from '@/db/account-repo';
import { findCategoriesByUser } from '@/db/category-repo';
import { aiExtractReceipt, isAIEnabled } from '@/lib/ai-service';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/format';

interface ReceiptData {
  merchant: string | null;
  amount: number | null;
  date: string | null;
  items: Array<{ description: string; amount: number }>;
  tax: number | null;
  total: number | null;
}

export default function ScanScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const colors = useThemeColors();

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera permission is needed to scan receipts.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      await processImage(result.assets[0].uri, result.assets[0].base64 ?? undefined);
    }
  }, []);

  const pickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library permission is needed to select receipts.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
      mediaTypes: ['images'],
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      await processImage(result.assets[0].uri, result.assets[0].base64 ?? undefined);
    }
  }, []);

  const processImage = useCallback(async (uri: string, base64?: string) => {
    if (!isAIEnabled()) {
      Alert.alert(
        'AI not configured',
        'Receipt OCR requires the AI service to be configured. Please set up EXPO_PUBLIC_AI_EDGE_FUNCTION_URL in your .env file.'
      );
      return;
    }

    setLoading(true);
    try {
      // In a real implementation, we'd upload the image to Supabase Storage first
      // For now, we use the local URI
      const extraction = await aiExtractReceipt(uri);
      if (extraction) {
        setReceiptData(extraction);
      } else {
        Alert.alert('Extraction failed', 'Could not extract data from the receipt. Please try again or enter manually.');
      }
    } catch {
      Alert.alert('Error', 'Failed to process the receipt image.');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAsTransaction = useCallback(async () => {
    if (!user || !receiptData) return;

    const amountCents = Math.round((receiptData.total ?? receiptData.amount ?? 0) * 100);
    if (amountCents === 0) {
      Alert.alert('No amount', 'Could not detect an amount from the receipt.');
      return;
    }

    // Get first account and expense category
    const [accounts, categories] = await Promise.all([
      findAccountsByUser(db, user.id),
      findCategoriesByUser(db, user.id),
    ]);

    const expenseCategory = categories.find((c) => !c.isIncome);

    await createTransaction(db, {
      userId: user.id,
      amountCents: -Math.abs(amountCents), // Expenses are negative
      currencyCode: 'USD',
      accountId: accounts[0]?.id ?? '',
      categoryId: expenseCategory?.id ?? '',
      note: receiptData.merchant ?? 'Receipt scan',
      date: receiptData.date ?? new Date().toISOString().split('T')[0],
    });

    Alert.alert('Saved', 'Transaction created from receipt.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }, [db, user, receiptData, router]);

  const reset = useCallback(() => {
    setImageUri(null);
    setReceiptData(null);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="title">Scan Receipt</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Take a photo or select an image to extract receipt data
          </ThemedText>

          {/* Action buttons */}
          {!imageUri && (
            <View style={styles.actions}>
              <Pressable onPress={takePhoto} style={[styles.actionBtn, { borderColor: colors.divider, backgroundColor: colors.backgroundElement }]}>
                <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} size={32} tintColor={colors.primary} />
                <ThemedText type="callout" style={{ fontWeight: '600' }}>Take Photo</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Use your camera</ThemedText>
              </Pressable>

              <Pressable onPress={pickImage} style={[styles.actionBtn, { borderColor: colors.divider, backgroundColor: colors.backgroundElement }]}>
                <SymbolView name={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }} size={32} tintColor={colors.success} />
                <ThemedText type="callout" style={{ fontWeight: '600' }}>Choose Image</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">From your gallery</ThemedText>
              </Pressable>
            </View>
          )}

          {/* Image preview */}
          {imageUri && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
              <Pressable onPress={reset} style={styles.resetBtn}>
                <ThemedText type="small" style={{ color: colors.primary }}>Choose different image</ThemedText>
              </Pressable>
            </View>
          )}

          {/* Loading state */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <ThemedText type="default" themeColor="textSecondary">
                Analyzing receipt...
              </ThemedText>
            </View>
          )}

          {/* Extracted data */}
          {receiptData && !loading && (
            <View style={[styles.resultsCard, { borderColor: colors.cardBorder }]}>
              <ThemedText type="callout" style={styles.resultsTitle}>Extracted Data</ThemedText>

              {receiptData.merchant && (
                <View style={styles.resultRow}>
                  <ThemedText type="small" themeColor="textSecondary">Merchant</ThemedText>
                  <ThemedText type="default">{receiptData.merchant}</ThemedText>
                </View>
              )}

              {receiptData.amount && (
                <View style={styles.resultRow}>
                  <ThemedText type="small" themeColor="textSecondary">Amount</ThemedText>
                  <ThemedText type="default">{formatCurrency(Math.round(receiptData.amount * 100), 'USD')}</ThemedText>
                </View>
              )}

              {receiptData.date && (
                <View style={styles.resultRow}>
                  <ThemedText type="small" themeColor="textSecondary">Date</ThemedText>
                  <ThemedText type="default">{receiptData.date}</ThemedText>
                </View>
              )}

              {receiptData.tax && (
                <View style={styles.resultRow}>
                  <ThemedText type="small" themeColor="textSecondary">Tax</ThemedText>
                  <ThemedText type="default">{formatCurrency(Math.round(receiptData.tax * 100), 'USD')}</ThemedText>
                </View>
              )}

              {receiptData.total && (
                <View style={[styles.resultRow, styles.totalRow, { borderTopColor: colors.divider }]}>
                  <ThemedText type="callout" style={{ fontWeight: '700' }}>Total</ThemedText>
                  <ThemedText type="headline" style={{ color: colors.danger }}>
                    {formatCurrency(Math.round(receiptData.total * 100), 'USD')}
                  </ThemedText>
                </View>
              )}

              {receiptData.items.length > 0 && (
                <View style={[styles.itemsSection, { borderTopColor: colors.divider }]}>
                  <ThemedText type="small" themeColor="textSecondary">Items</ThemedText>
                  {receiptData.items.map((item, i) => (
                    <View key={i} style={styles.itemRow}>
                      <ThemedText type="small" style={{ flex: 1 }}>{item.description}</ThemedText>
                      <ThemedText type="small">{formatCurrency(Math.round(item.amount * 100), 'USD')}</ThemedText>
                    </View>
                  ))}
                </View>
              )}

              <Pressable onPress={saveAsTransaction} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                <ThemedText type="default" style={{ color: colors.primaryText, fontWeight: '600' }}>
                  Save as Expense
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* AI not configured message */}
          {!isAIEnabled() && !imageUri && (
            <View style={[styles.infoCard, { borderColor: colors.warning + '4D', backgroundColor: colors.warning + '14' }]}>
              <SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' }} size={20} tintColor={colors.warning} />
              <View style={styles.infoContent}>
                <ThemedText type="small" style={{ fontWeight: '600' }}>AI Service Not Configured</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Set EXPO_PUBLIC_AI_EDGE_FUNCTION_URL in your .env to enable receipt scanning.
                </ThemedText>
              </View>
            </View>
          )}

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.one,
  },
  previewContainer: {
    gap: Spacing.two,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: Spacing.three,
  },
  resetBtn: {
    alignSelf: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  resultsCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.two,
  },
  resultsTitle: {
    fontWeight: '600',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.half,
  },
  totalRow: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemsSection: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  saveBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  infoCard: {
    flexDirection: 'row',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  infoContent: {
    flex: 1,
    gap: 2,
  },
});
