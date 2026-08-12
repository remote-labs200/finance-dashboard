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
import { getPreference, setPreference } from "@/db/preferences-repo";
import { useSQLiteContext } from "@/db/provider";
import {
  createMileageVehicle,
  deleteMileageVehicle,
  findMileageVehiclesByUser,
  setPrimaryVehicle,
  updateMileageVehicle,
} from "@/db/mileage-vehicle-repo";
import type { MileageVehicle } from "@/db/schema";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Vehicle card
// ---------------------------------------------------------------------------

function VehicleCard({
  vehicle,
  onTogglePrimary,
  onRemove,
  onEdit,
}: {
  vehicle: MileageVehicle;
  onTogglePrimary: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (vehicle: MileageVehicle) => void;
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
          variant="secondary"
          style={styles.actionBtn}
          onPress={() => onEdit(vehicle)}
        >
          Edit
        </NeumorphicButton>
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

export default function MileageTrackerSettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);

  const [gpsTracking, setGpsTracking] = useState(true);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [ratePerMile, setRatePerMile] = useState("0.655");
  const [autoClassify, setAutoClassify] = useState(true);
  const [vehicles, setVehicles] = useState<MileageVehicle[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<MileageVehicle | null>(null);
  const [editName, setEditName] = useState("");
  const [editMake, setEditMake] = useState("");
  const [editYear, setEditYear] = useState("");

  const loadVehicles = useCallback(async () => {
    if (!user) return;
    const list = await findMileageVehiclesByUser(db, user.id);
    setVehicles(list);
  }, [db, user]);

  const loadPrefs = useCallback(async () => {
    if (!user) return;
    const [rate, gps, bg, classify] = await Promise.all([
      getPreference(db, user.id, "mileage_rate_per_mile"),
      getPreference(db, user.id, "mileage_gps_tracking"),
      getPreference(db, user.id, "mileage_background_tracking"),
      getPreference(db, user.id, "mileage_auto_classify"),
    ]);
    setRatePerMile(rate || "0.655");
    setGpsTracking(gps !== "false");
    setBackgroundTracking(bg === "true");
    setAutoClassify(classify !== "false");
    setLoaded(true);
  }, [db, user]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    Promise.all([loadPrefs(), loadVehicles()]).then(() => {
      if (mounted) setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, [user, loadPrefs, loadVehicles]);

  const persistRate = useCallback(
    (val: string) => {
      const sanitized = val.replace(/[^0-9.]/g, "");
      setRatePerMile(sanitized);
      if (user)
        setPreference(db, user.id, "mileage_rate_per_mile", sanitized || "0.655");
    },
    [user, db],
  );

  const persistGps = useCallback(
    (val: boolean) => {
      setGpsTracking(val);
      if (user)
        setPreference(db, user.id, "mileage_gps_tracking", val ? "true" : "false");
    },
    [user, db],
  );

  const persistBackground = useCallback(
    (val: boolean) => {
      setBackgroundTracking(val);
      if (user)
        setPreference(
          db,
          user.id,
          "mileage_background_tracking",
          val ? "true" : "false",
        );
    },
    [user, db],
  );

  const persistAutoClassify = useCallback(
    (val: boolean) => {
      setAutoClassify(val);
      if (user)
        setPreference(
          db,
          user.id,
          "mileage_auto_classify",
          val ? "true" : "false",
        );
    },
    [user, db],
  );

  const handleTogglePrimary = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await setPrimaryVehicle(db, user.id, id);
        await loadVehicles();
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("closed")) return;
        console.warn("Failed to set primary vehicle:", e);
      }
    },
    [db, user, loadVehicles],
  );

  const handleRemoveVehicle = useCallback(
    (id: string) => {
      Alert.alert(
        "Remove Vehicle",
        "Remove this vehicle profile?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteMileageVehicle(db, id);
                await loadVehicles();
              } catch (e: unknown) {
                if (e instanceof Error && e.message.includes("closed")) return;
                console.warn("Failed to remove vehicle:", e);
              }
            },
          },
        ],
      );
    },
    [db, loadVehicles],
  );

  const handleAddVehicle = useCallback(() => {
    setEditing({} as MileageVehicle);
    setEditName("");
    setEditMake("");
    setEditYear(String(new Date().getFullYear()));
  }, []);

  const handleEditVehicle = useCallback((v: MileageVehicle) => {
    setEditing(v);
    setEditName(v.name);
    setEditMake(v.make);
    setEditYear(v.year);
  }, []);

  const handleSaveVehicle = useCallback(async () => {
    if (!user) return;
    const name = editName.trim();
    if (!name) {
      Alert.alert("Name required", "Give your vehicle a name.");
      return;
    }
    try {
      if (editing && editing.id) {
        await updateMileageVehicle(db, editing.id, {
          name,
          make: editMake.trim(),
          year: editYear.trim(),
        });
      } else {
        await createMileageVehicle(db, {
          userId: user.id,
          name,
          make: editMake.trim(),
          year: editYear.trim(),
          isPrimary: vehicles.length === 0,
        });
      }
      setEditing(null);
      await loadVehicles();
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("Failed to save vehicle:", e);
    }
  }, [db, user, editing, editName, editMake, editYear, vehicles.length, loadVehicles]);

  const openEditor = !!editing;

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
                  onValueChange={persistGps}
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
                      onValueChange={persistBackground}
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
                  onChangeText={persistRate}
                  keyboardType="decimal-pad"
                  placeholder="0.000"
                />
                <ThemedText type="default" themeColor="textSecondary">
                  / mile
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Used to calculate deductions on the mileage screen.
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
                  onValueChange={persistAutoClassify}
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
                  onEdit={handleEditVehicle}
                />
              ))
            )}
          </View>

          {/* Vehicle editor */}
          {openEditor && (
            <NeumorphicCard style={styles.editorCard}>
              <ThemedText type="callout" style={{ fontWeight: "600" }}>
                {editing && editing.id ? "Edit Vehicle" : "Add Vehicle"}
              </ThemedText>
              <NeumorphicInput
                placeholder="Name (e.g. My Car)"
                value={editName}
                onChangeText={setEditName}
                underlineColorAndroid="transparent"
              />
              <NeumorphicInput
                placeholder="Make (e.g. Toyota Camry)"
                value={editMake}
                onChangeText={setEditMake}
                underlineColorAndroid="transparent"
              />
              <NeumorphicInput
                placeholder="Year (e.g. 2022)"
                value={editYear}
                onChangeText={setEditYear}
                keyboardType="number-pad"
                underlineColorAndroid="transparent"
              />
              <View style={styles.editorActions}>
                <NeumorphicButton
                  variant="secondary"
                  style={styles.editorBtn}
                  onPress={() => setEditing(null)}
                >
                  Cancel
                </NeumorphicButton>
                <NeumorphicButton
                  style={styles.editorBtn}
                  onPress={handleSaveVehicle}
                >
                  Save
                </NeumorphicButton>
              </View>
            </NeumorphicCard>
          )}

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
              Vehicle profiles and settings are saved to your account and synced
              across devices. GPS tracking requires location permissions.
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
    paddingHorizontal: Spacing.two,
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
  editorCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  editorActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  editorBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
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
