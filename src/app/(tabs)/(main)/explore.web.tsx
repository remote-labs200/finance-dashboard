import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { StyleSheet, SafeAreaView } from 'react-native';

export default function TransactionsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Transactions</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Transaction list and management will go here
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
});
