import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import NotificationBell from '@/components/notification-bell';

export default function MainLayout() {
  return (
    <View style={{ flex: 1 }}>
      <AppTabs />
      <NotificationBell />
    </View>
  );
}
