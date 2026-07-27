import { Pressable, StyleSheet, View, ImageBackground } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme';

export default function WelcomeScreen() {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      {/* Top 65% — Wave background */}
      <ImageBackground
        source={require('@/assets/images/welcome.png')}
        style={styles.waveBg}
        resizeMode="cover">
        <SafeAreaView style={styles.waveSafeArea}>
          <View style={styles.waveContent}>
            <ThemedText type="title" style={styles.waveTitle}>
              SmoothTax
            </ThemedText>
            <ThemedText type="callout" style={styles.waveTagline}>
              For freelancers who want to stay ahead of their money
            </ThemedText>
          </View>
        </SafeAreaView>
      </ImageBackground>

      {/* Bottom 35% — White card */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardContent}>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}>
              <ThemedText type="smallBold" style={{ color: colors.primaryText }}>
                Create Account
              </ThemedText>
            </Pressable>
          </Link>

          <Link href="/(auth)/sign-in" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                { borderColor: colors.divider, opacity: pressed ? 0.7 : 1 },
              ]}>
              <ThemedText type="smallBold" themeColor="text">
                I already have an account
              </ThemedText>
            </Pressable>
          </Link>

          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            SmoothTax &middot; v1.0.0
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  waveBg: { flex: 0.65, justifyContent: 'flex-end' },
  waveSafeArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.four,
  },
  waveContent: { gap: Spacing.one },
  waveTitle: { color: '#ffffff', lineHeight: 52 },
  waveTagline: { color: 'rgba(255,255,255,0.8)', marginTop: Spacing.one },
  card: {
    flex: 0.35,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: Spacing.four,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.two,
  },
  primaryBtn: {
    paddingVertical: Spacing.two,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryBtn: {
    paddingVertical: Spacing.two,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  footer: { textAlign: 'center', paddingTop: Spacing.four, fontSize: 12 },
});
