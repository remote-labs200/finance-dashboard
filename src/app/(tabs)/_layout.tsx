import { Stack } from 'expo-router';

export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(main)" />
      <Stack.Screen name="transaction" options={{ presentation: 'modal' }} />
      <Stack.Screen name="accounts" options={{ presentation: 'modal' }} />
      <Stack.Screen name="categories" options={{ presentation: 'modal' }} />
      <Stack.Screen name="insights" options={{ presentation: 'modal' }} />
      <Stack.Screen name="mileage" options={{ presentation: 'modal' }} />
      <Stack.Screen name="forecast" options={{ presentation: 'modal' }} />
      <Stack.Screen name="cloud-sync" options={{ presentation: 'modal' }} />
      <Stack.Screen name="personal-profile" />
      <Stack.Screen name="business-info" />
      <Stack.Screen name="tax-profile" />
      <Stack.Screen name="accounting-year" />
      <Stack.Screen name="base-currency" />
      <Stack.Screen name="secondary-currencies" />
      <Stack.Screen name="exchange-rates" />
<Stack.Screen name="safe-monthly-pay" />
      <Stack.Screen name="tax-payments" />
      <Stack.Screen name="recurring-transactions" />
      <Stack.Screen name="bank-connections" />
      <Stack.Screen name="invoicing-integrations" />
      <Stack.Screen name="export-ledger" />
      <Stack.Screen name="receipt-ocr-settings" />
      <Stack.Screen name="ai-financial-insights" />
      <Stack.Screen name="mileage-tracker-settings" />
      <Stack.Screen name="cash-flow-forecasting" />
      <Stack.Screen name="biometric-lock" />
      <Stack.Screen name="two-factor-auth" />
      <Stack.Screen name="help-faqs" />
      <Stack.Screen name="terms-privacy" />
      <Stack.Screen name="app-version" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="notification-preferences" options={{ presentation: 'modal' }} />
      <Stack.Screen name="app-theme" />
      <Stack.Screen name="account" />
      <Stack.Screen name="font-size-style" />
    </Stack>
  );
}
