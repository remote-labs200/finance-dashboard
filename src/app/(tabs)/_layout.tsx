import { Stack } from 'expo-router';

export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(main)" />
      <Stack.Screen name="transaction" options={{ presentation: 'modal' }} />
      <Stack.Screen name="accounts" options={{ presentation: 'modal' }} />
      <Stack.Screen name="categories" options={{ presentation: 'modal' }} />
      <Stack.Screen name="insights" options={{ presentation: 'modal' }} />
      <Stack.Screen name="clients" options={{ presentation: 'modal' }} />
      <Stack.Screen name="mileage" options={{ presentation: 'modal' }} />
      <Stack.Screen name="forecast" options={{ presentation: 'modal' }} />
      <Stack.Screen name="tax-config" options={{ presentation: 'modal' }} />
      <Stack.Screen name="currency-settings" options={{ presentation: 'modal' }} />
      <Stack.Screen name="cloud-sync" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
