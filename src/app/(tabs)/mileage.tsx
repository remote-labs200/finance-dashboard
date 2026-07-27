import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSQLiteContext } from '@/db/provider';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/use-auth-store';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

interface MileageEntry {
  id: string;
  date: string;
  purpose: string;
  miles: number;
  startLocation: string;
  endLocation: string;
}

const IRS_RATE_PER_MILE = 0.67; // 2024 standard mileage rate

async function loadLocation() {
  // Lazy import to avoid Metro bundling issues with expo-location
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-location');
  } catch {
    return null;
  }
}

export default function MileageScreen() {
  const colors = useThemeColors();
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const [entries, setEntries] = useState<MileageEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trackingStart, setTrackingStart] = useState<any>(null);

  const loadEntries = useCallback(async () => {
    if (!user) return;

    try {
      // Check if mileage_entries table exists, create if not
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS mileage_entries (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        purpose TEXT NOT NULL,
        miles REAL NOT NULL,
        start_lat REAL,
        start_lng REAL,
        end_lat REAL,
        end_lng REAL,
        start_location TEXT,
        end_location TEXT,
        created_at TEXT NOT NULL
      )
    `);

    const rows = await db.getAllAsync<{
      id: string;
      date: string;
      purpose: string;
      miles: number;
      start_location: string;
      end_location: string;
    }>(
      `SELECT * FROM mileage_entries WHERE user_id = ? ORDER BY date DESC`,
      user.id
    );

    setEntries(rows.map((r) => ({
      id: r.id,
      date: r.date,
      purpose: r.purpose,
      miles: r.miles,
      startLocation: r.start_location ?? '',
      endLocation: r.end_location ?? '',
    })));
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('closed')) return;
      console.warn('loadEntries error:', e);
    }
  }, [db, user]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  }, [loadEntries]);

  const startTracking = useCallback(async () => {
    const Location = await loadLocation();
    if (!Location) {
      Alert.alert('Unavailable', 'Location services are not available on this platform.');
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location permission is needed to track mileage.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setTrackingStart(location);
      setIsTracking(true);
      Alert.alert('Tracking started', 'Drive to your destination, then tap "Stop Tracking".');
    } catch (e: any) {
      Alert.alert('Location error', e?.message ?? 'Could not get current location.');
    }
  }, []);

  const saveTrip = useCallback(async (purpose: string) => {
    if (!user || !trackingStart) return;

    const Location = await loadLocation();
    if (!Location) {
      Alert.alert('Unavailable', 'Location services are not available.');
      return;
    }

    try {
      const endLocation = await Location.getCurrentPositionAsync({});

      // Calculate distance in miles using Haversine formula
      const R = 3959; // Earth's radius in miles
      const dLat = ((endLocation.coords.latitude - trackingStart.coords.latitude) * Math.PI) / 180;
      const dLon = ((endLocation.coords.longitude - trackingStart.coords.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((trackingStart.coords.latitude * Math.PI) / 180) *
        Math.cos((endLocation.coords.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const miles = Math.round(R * c * 10) / 10;

      if (miles < 0.1) {
        Alert.alert('Too short', 'Distance is less than 0.1 miles. No entry recorded.');
        setIsTracking(false);
        setTrackingStart(null);
        return;
      }

      const id = `mile_${Date.now()}`;
      const now = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO mileage_entries (id, user_id, date, purpose, miles, start_lat, start_lng, end_lat, end_lng, start_location, end_location, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        user.id,
        now.split('T')[0],
        purpose || 'Business',
        miles,
        trackingStart.coords.latitude,
        trackingStart.coords.longitude,
        endLocation.coords.latitude,
        endLocation.coords.longitude,
        `${trackingStart.coords.latitude.toFixed(4)}, ${trackingStart.coords.longitude.toFixed(4)}`,
        `${endLocation.coords.latitude.toFixed(4)}, ${endLocation.coords.longitude.toFixed(4)}`,
        now
      );

      setIsTracking(false);
      setTrackingStart(null);
      loadEntries();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to get end location.');
      setIsTracking(false);
      setTrackingStart(null);
    }
  }, [db, user, trackingStart, loadEntries]);

  const stopTracking = useCallback(async () => {
    if (!user || !trackingStart) return;

    if (Platform.OS === 'ios' && Alert.prompt) {
      Alert.prompt(
        'Trip Purpose',
        'What was this trip for?',
        (purpose: string) => saveTrip(purpose || 'Business'),
        undefined,
        'Business'
      );
    } else {
      // Android doesn't support Alert.prompt, save with default purpose
      saveTrip('Business');
    }
  }, [saveTrip, trackingStart, user]);

  const deleteEntry = useCallback((id: string) => {
    Alert.alert('Delete Entry', 'Remove this mileage entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await db.runAsync('DELETE FROM mileage_entries WHERE id = ?', id);
          loadEntries();
        },
      },
    ]);
  }, [db, loadEntries]);

  const totalMiles = entries.reduce((sum, e) => sum + e.miles, 0);
  const totalDeduction = totalMiles * IRS_RATE_PER_MILE;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="title">Mileage</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Track business miles for tax deductions
              </ThemedText>

              {/* Summary */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { borderColor: colors.cardBorder }]}>
                  <ThemedText type="small" themeColor="textSecondary">Total Miles</ThemedText>
                  <ThemedText type="headline">{totalMiles.toFixed(1)}</ThemedText>
                </View>
                <View style={[styles.summaryCard, { borderColor: colors.cardBorder }]}>
                  <ThemedText type="small" themeColor="textSecondary">Deduction Value</ThemedText>
                  <ThemedText type="headline" style={{ color: colors.success }}>
                    ${totalDeduction.toFixed(2)}
                  </ThemedText>
                </View>
              </View>

              <ThemedText type="small" themeColor="textSecondary">
                IRS standard rate: ${IRS_RATE_PER_MILE}/mile (2024)
              </ThemedText>

              {/* Tracking button */}
              <Pressable
                onPress={isTracking ? stopTracking : startTracking}
                style={[styles.trackBtn, { backgroundColor: isTracking ? colors.danger : colors.primary }]}>
                <SymbolView
                  name={{
                    ios: isTracking ? 'stop.fill' : 'location.fill',
                    android: isTracking ? 'stop' : 'location_on',
                    web: isTracking ? 'stop' : 'location_on',
                  }}
                  size={24}
                  tintColor={colors.primaryText}
                />
                <ThemedText type="callout" style={{ color: colors.primaryText, fontWeight: '600' }}>
                  {isTracking ? 'Stop Tracking' : 'Start Tracking'}
                </ThemedText>
              </Pressable>

              <ThemedText type="callout" style={styles.sectionTitle}>History</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onLongPress={() => deleteEntry(item.id)}
              style={[styles.entryCard, { borderColor: colors.cardBorder }]}>
              <View style={styles.entryHeader}>
                <View style={styles.entryLeft}>
                  <ThemedText type="callout" style={{ fontWeight: '600' }}>{item.purpose}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{item.date}</ThemedText>
                </View>
                <View style={styles.entryRight}>
                  <ThemedText type="callout" style={{ fontWeight: '600' }}>
                    {item.miles.toFixed(1)} mi
                  </ThemedText>
                  <ThemedText type="small" style={{ color: colors.success }}>
                    ${(item.miles * IRS_RATE_PER_MILE).toFixed(2)}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <SymbolView name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }} size={48} tintColor={colors.textSecondary} />
              <ThemedText type="default" themeColor="textSecondary">
                No mileage entries yet
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Tap "Start Tracking" to log a business trip.
              </ThemedText>
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  summaryCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.one,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  sectionTitle: {
    fontWeight: '600',
    paddingTop: Spacing.one,
  },
  entryCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    marginBottom: Spacing.two,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryLeft: {
    flex: 1,
    gap: 2,
  },
  entryRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
});
