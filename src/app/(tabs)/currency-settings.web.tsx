import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard } from "@/components/ui";
import { MaxContentWidth, Spacing } from "@/constants/theme";

export default function CurrencySettingsWeb() {
  return (
    <ThemedView
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: Spacing.four,
      }}
    >
      <NeumorphicCard
        style={{
          maxWidth: MaxContentWidth,
          width: "100%",
          alignItems: "center",
          padding: Spacing.four,
        }}
      >
        <ThemedText type="title">Default Currency</ThemedText>
        <ThemedText
          type="default"
          themeColor="textSecondary"
          style={{ marginTop: Spacing.two, textAlign: "center" }}
        >
          Currency settings are configured on the mobile app. Please open this
          screen on your mobile device.
        </ThemedText>
      </NeumorphicCard>
    </ThemedView>
  );
}
