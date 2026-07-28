import { StyleSheet, View, SafeAreaView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function ScanWebScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.scroll}>
          <ThemedText type="title">Scan Receipt</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Take a photo or select an image to extract receipt data
          </ThemedText>

          <View style={styles.card}>
            <ThemedText type="callout" style={{ fontWeight: '600' }}>Camera Not Available</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Receipt scanning is only available on mobile devices. Use the mobile app to scan receipts.
            </ThemedText>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
    gap: Spacing.one,
    alignItems: 'center',
    paddingVertical: Spacing.six,
  },
});
