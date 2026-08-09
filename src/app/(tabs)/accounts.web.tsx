import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NeumorphicCard } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AccountsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <NeumorphicCard style={styles.card}>
          <ThemedText type="title">Accounts</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Account management will go here
          </ThemedText>
        </NeumorphicCard>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  card: {
    alignItems: 'center',
    gap: Spacing.two,
  },
});
