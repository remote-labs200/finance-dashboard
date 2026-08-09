import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard } from "@/components/ui";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ReportsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Reports</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Reports and export will go here
        </ThemedText>
        <NeumorphicCard style={styles.card}>
          <ThemedText type="callout" style={{ fontWeight: "600" }}>
            Coming Soon
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Year-to-date summaries, tax estimates, and CSV exports will be
            available here.
          </ThemedText>
        </NeumorphicCard>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    alignItems: "center",
    paddingVertical: Spacing.six,
  },
});
