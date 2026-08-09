import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard } from "@/components/ui";
import { MaxContentWidth, Spacing } from "@/constants/theme";

export default function ForecastWebScreen() {
  return (
    <ThemedView style={styles.container}>
      <NeumorphicCard style={styles.content}>
        <ThemedText type="title">Cash Flow Forecast</ThemedText>
        <ThemedText
          type="default"
          themeColor="textSecondary"
          style={{ marginTop: Spacing.two }}
        >
          Forecasting is available on the mobile app.
        </ThemedText>
      </NeumorphicCard>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    maxWidth: MaxContentWidth,
    width: "100%",
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.two,
  },
});
