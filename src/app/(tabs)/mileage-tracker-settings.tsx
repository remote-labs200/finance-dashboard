import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicInput,
  NeumorphicPressable,
  NeumorphicSurface,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Vehicle card
// ---------------------------------------------------------------------------

interface Vehicle {
  id: string;
  name: string;
  make: string;
  year: string;
  isPrimary: boolean;
}

function VehicleCard({
  vehicle,
  onTogglePrimary,
  onRemove,
}: {
  vehicle: Vehicle;
  onTogglePrimary: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <NeumorphicCard style={styles.vehicleCard}>
      <View style={styles.vehicleTop}>
        <SymbolView
          name={{
            ios: "car.fill",
            android: "directions_car",
            web: "directions_car",
          }}
          size={24}
          tintColor={vehicle.isPrimary ? theme.primary : theme.text}
        />
        <View style={styles.vehicleInfo}>
          <ThemedText type="default" style={{ fontWeight: "600" }}>
            {vehicle.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {vehicle.year} {vehicle.make}
          </ThemedText>
        </View>
        {vehicle.isPrimary && (
          <NeumorphicSurface small style={styles.primaryBadge}>
            <ThemedText
              type="small"
              style={{ color: theme.primary, fontWeight: "600" }}
            >
              Primary
            </ThemedText>
          </NeumorphicSurface>
        )}
      </View>
      <View style={styles.vehicleActions}>
        {!vehicle.isPrimary && (
          <NeumorphicButton
            variant="secondary"
            style={styles.actionBtn}
            onPress={() => onTogglePrimary(vehicle.id)}
          >
            Set as Primary
          </NeumorphicButton>
        )}
        <NeumorphicButton
          variant="ghost"
          style={[styles.actionBtn, { borderColor: theme.danger }]}
          textStyle={{ color: theme.danger }}
          onPress={() => onRemove(vehicle.id)}
        >
          Remove
        </NeumorphicButton>
      </View>
    </NeumorphicCard>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: "1",
    name: "My Car",
    make: "Toyota Camry",
    year: "2022",
    isPrimary: true,
  },
  {
    id: "2",
    name: "Weekend Van",
    make: "Honda Odyssey",
    year: "2020",
    isPrimary: false,
  },
];

export default function MileageTrackerSettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [gpsTracking, setGpsTracking] = useState(true);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [ratePerMile, setRatePerMile] = useState("0.655");
  const [autoClassify, setAutoClassify] = useState(true);
  const [vehicles, setVehicles] = useState(INITIAL_VEHICLES);

  const handleTogglePrimary = useCallback((id: string) => {
    setVehicles((prev) => prev.map((v) => ({ ...v, isPrimary: v.id === id })));
  }, []);

  const handleRemoveVehicle = useCallback((id: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const handleAddVehicle = useCallback(() => {
    setVehicles((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: `Vehicle ${prev.length + 1}`,
        make: "",
        year: String(new Date().getFullYear()),
        isPrimary: prev.length === 0,
      },
    ]);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safe}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + Spacing.three,
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={20}
              tintColor={theme.primary}
            />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            Mileage Tracker Settings
          </ThemedText>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
        >
          {/* GPS & permissions */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              GPS &amp; Permissions
            </ThemedText>
            <NeumorphicCard style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleBody}>
                  <ThemedText type="default" style={{ fontWeight: "500" }}>
                    GPS Tracking
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Use GPS to automatically detect trip start and end.
                  </ThemedText>
                </View>
                <Switch
                  value={gpsTracking}
                  onValueChange={setGpsTracking}
                  trackColor={{ false: theme.inputBorder, true: theme.primary }}
                  thumbColor="#fff"
                />
              </View>
              {gpsTracking && (
                <>
                  <View
                    style={[styles.divider, { backgroundColor: theme.divider }]}
                  />
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleBody}>
                      <ThemedText type="default" style={{ fontWeight: "500" }}>
                        Background Tracking
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Continue tracking even when the app is in the
                        background.
                      </ThemedText>
                    </View>
                    <Switch
                      value={backgroundTracking}
                      onValueChange={setBackgroundTracking}
                      trackColor={{
                        false: theme.inputBorder,
                        true: theme.primary,
                      }}
                      thumbColor="#fff"
                    />
                  </View>
                </>
              )}
            </NeumorphicCard>
          </View>

          {/* Rate per mile */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Rate Per Mile
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.sectionSub}
            >
              Standard IRS mileage rate or your custom rate for deductions.
            </ThemedText>
            <NeumorphicCard style={styles.rateCard}>
              <ThemedText type="default" style={{ fontWeight: "600" }}>
                Rate
              </ThemedText>
              <View style={styles.rateInputRow}>
                <ThemedText
                  type="default"
                  style={{
                    color: theme.placeholder,
                    fontWeight: "600",
                    fontSize: 18,
                  }}
                >
                  $
                </ThemedText>
                <NeumorphicInput
                  containerStyle={styles.rateInputWrap}
                  style={styles.rateInput}
                  value={ratePerMile}
                  onChangeText={setRatePerMile}
                  keyboardType="decimal-pad"
                  placeholder="0.000"
                />
                <ThemedText type="default" themeColor="textSecondary">
                  / mile
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                IRS 2026 standard rate: $0.655/mile
              </ThemedText>
            </NeumorphicCard>
          </View>

          {/* Auto-classify */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Trip Classification
            </ThemedText>
            <NeumorphicCard style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleBody}>
                  <ThemedText type="default" style={{ fontWeight: "500" }}>
                    Auto-Classify Trips
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Automatically mark trips as business or personal based on
                    location and time patterns.
                  </ThemedText>
                </View>
                <Switch
                  value={autoClassify}
                  onValueChange={setAutoClassify}
                  trackColor={{ false: theme.inputBorder, true: theme.primary }}
                  thumbColor="#fff"
                />
              </View>
            </NeumorphicCard>
          </View>

          {/* Vehicle profiles */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="callout" style={styles.sectionTitle}>
                Vehicle Profiles
              </ThemedText>
              <NeumorphicPressable
                onPress={handleAddVehicle}
                style={styles.addBtn}
              >
                <SymbolView
                  name={{ ios: "plus", android: "add", web: "add" }}
                  size={14}
                  tintColor={theme.primary}
                />
                <ThemedText
                  type="default"
                  style={{ color: theme.primary, fontWeight: "600" }}
                >
                  Add
                </ThemedText>
              </NeumorphicPressable>
            </View>
            {vehicles.length === 0 ? (
              <NeumorphicCard style={styles.emptyCard}>
                <ThemedText type="default" themeColor="textSecondary">
                  No vehicles added yet. Tap "Add" to create one.
                </ThemedText>
              </NeumorphicCard>
            ) : (
              vehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  onTogglePrimary={handleTogglePrimary}
                  onRemove={handleRemoveVehicle}
                />
              ))
            )}
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <SymbolView
              name={{ ios: "info.circle", android: "info", web: "info" }}
              size={16}
              tintColor={theme.primary}
            />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.infoText}
            >
              Mileage data is stored locally and included in CSV/PDF exports.
              GPS tracking requires location permissions.
            </ThemedText>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </View>
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerTitle: { flex: 1 },
  backBtn: { padding: Spacing.one },
  scroll: {
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  sectionSub: {
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  card: {
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  toggleBody: {
    flex: 1,
    gap: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  rateCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  rateInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  rateInputWrap: {
    minWidth: 120,
    flex: 1,
  },
  rateInput: {
    fontSize: 24,
    fontWeight: "700",
    minWidth: 100,
  },
  vehicleCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  vehicleTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  vehicleInfo: {
    flex: 1,
    gap: 1,
  },
  primaryBadge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
  },
  vehicleActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.two,
  },
  actionBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    minHeight: 40,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.half,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
    padding: 10,
  },
  emptyCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: "center",
  },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, lineHeight: 18 },
});
