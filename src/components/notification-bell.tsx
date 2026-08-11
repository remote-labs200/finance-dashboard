/**
 * NotificationBell — bell icon with unread badge.
 *
 * Placed inline in the dashboard header on mobile.
 * Tapping navigates to /notifications.
 */
 
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { useResolvedThemeName } from '@/hooks/use-theme';
import { Colors } from '@/constants/theme';
import { useBadgeCount } from '@/stores/use-notification-store';

export default function NotificationBell() {
  const badgeCount = useBadgeCount();
  const router = useRouter();
  const themeName = useResolvedThemeName();
  const colors = Colors[themeName];

  return (
    <Pressable
      style={styles.container}
      onPress={() => router.push('/(tabs)/notifications')}
      hitSlop={12}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
        <Ionicons name="notifications-outline" size={20} color={colors.primaryText} />
        {badgeCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.danger }]}>
            <ThemedText style={styles.badgeText} themeColor="primaryText">
              {badgeCount > 99 ? '99+' : badgeCount}
            </ThemedText>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
container: {},
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
});
