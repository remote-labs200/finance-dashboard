import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View, TextInput, ImageBackground, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PasswordInput } from '@/components/password-input';
import { useSQLiteContext } from '@/db/provider';
import { Spacing } from '@/constants/theme';
import { useAuthStore } from '@/stores/use-auth-store';
import { useThemeColors } from '@/hooks/use-theme';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const signUp = useAuthStore((state) => state.signUp);
  const db = useSQLiteContext();
  const colors = useThemeColors();

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Passwords Do Not Match', 'Please make sure both passwords are the same.');
      return;
    }

    setLoading(true);
    try {
      await signUp(db, email, password);
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top 65% — Wave background */}
      <ImageBackground
        source={require('@/assets/images/signup.png')}
        style={styles.waveBg}
        resizeMode="cover">
        <SafeAreaView style={styles.waveSafeArea}>
          <ThemedText type="title" style={styles.waveTitle}>
            Get Started
          </ThemedText>
          <ThemedText type="callout" style={styles.waveTagline}>
            Create your free account
          </ThemedText>
        </SafeAreaView>
      </ImageBackground>

      {/* Bottom 35% — Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 20 : 0}
        style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardContent}>
          <View style={[styles.inputRow, { borderColor: colors.divider }]}>
            <ThemedText style={{ color: colors.textTertiary, fontSize: 18 }}>@</ThemedText>
            <TextInput
              placeholder="Email"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, { color: colors.text }]}
            />
          </View>
          <PasswordInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            showValidation
          />
          <PasswordInput
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
          {confirmPassword && password !== confirmPassword ? (
            <ThemedText type="small" style={{ color: colors.error, fontSize: 12 }}>
              Passwords do not match
            </ThemedText>
          ) : null}
          <Pressable
            onPress={handleSignUp}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}>
            <ThemedText type="smallBold" style={{ color: colors.primaryText }}>
              {loading ? 'Creating...' : 'Sign Up'}
            </ThemedText>
          </Pressable>

          <Link href="/(auth)/sign-in" asChild>
            <ThemedText type="link" style={[styles.linkButton, { color: colors.primary }]}>
              Already have an account? Sign In
            </ThemedText>
          </Link>

          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            SmoothTax &middot; v1.0.0
          </ThemedText>
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: Spacing.four,
  },
  waveTitle: { color: '#ffffff', lineHeight: 48 },
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
    gap: Spacing.two,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.two + 4,
    fontSize: 16,
  },
  button: {
    paddingVertical: Spacing.two,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  linkButton: {
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    paddingTop: Spacing.four,
    fontSize: 12,
  },
});
