import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function CurrencySettingsWeb() {
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four }}>
      <ThemedText type="title">Default Currency</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={{ marginTop: Spacing.two, textAlign: 'center', maxWidth: MaxContentWidth }}>
        Currency settings are configured on the mobile app. Please open this screen on your mobile device.
      </ThemedText>
    </ThemedView>
  );
}
