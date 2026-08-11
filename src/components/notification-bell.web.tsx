/**
 * NotificationBell (web) — inline bell icon rendered inside CustomTabList.
 *
 * Unlike the mobile version which is absolutely positioned, this version
 * renders inline next to the "PaySmooth" brand text in the web tab bar.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Colors, Spacing } from "@/constants/theme";
import { useResolvedThemeName } from "@/hooks/use-theme";
import { useBadgeCount } from "@/stores/use-notification-store";
import { ThemedText } from "./themed-text";

export default function NotificationBell() {
  const badgeCount = useBadgeCount();
  const router = useRouter();
  const themeName = useResolvedThemeName();
  const colors = Colors[themeName];

  return (
    <Pressable
      style={styles.container}
      onPress={() => router.push("/(tabs)/notifications")}
      hitSlop={8}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
        <Ionicons name="notifications-outline" size={16} color={colors.primaryText} />
        {badgeCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.danger }]}>
            <ThemedText style={styles.badgeText} themeColor="primaryText">
              {badgeCount > 99 ? "99+" : badgeCount}
            </ThemedText>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: Spacing.two,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 12,
  },
});
