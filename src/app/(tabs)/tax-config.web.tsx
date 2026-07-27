import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function TaxConfigWeb() {
  const theme = useTheme();
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four }}>
      <ThemedText type="title">Tax Configuration</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={{ marginTop: Spacing.two, textAlign: 'center', maxWidth: MaxContentWidth }}>
        Tax settings are configured on the mobile app. Please open this screen on your mobile device.
      </ThemedText>
    </ThemedView>
  );
}
