import { View, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function MileageWebScreen() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="title">Mileage Tracker</ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
          Mileage tracking is available on the mobile app.
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
