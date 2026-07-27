import { View, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function ForecastWebScreen() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="title">Cash Flow Forecast</ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
          Forecasting is available on the mobile app.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
});
