import { Pressable, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme";

/**
 * Marketing consent checkbox for the sign-up form.
 *
 * Tapping it toggles opt-in to the Sender.net newsletter / updates. Consent is
 * persisted as the `marketing_consent` preference and enforced again
 * server-side by the `sync-marketing-contact` edge function.
 */
export function MarketingConsentCheckbox({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: colors.inputBorder,
            backgroundColor: value ? colors.primary : "transparent",
          },
        ]}
      >
        {value && (
          <SymbolView
            name={{ ios: "checkmark", android: "check", web: "check" }}
            size={14}
            tintColor="#ffffff"
          />
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        Keep me updated with tax tips and product news. You can unsubscribe
        anytime.
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  label: {
    flex: 1,
    lineHeight: 18,
  },
});