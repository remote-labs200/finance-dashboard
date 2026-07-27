import { useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { PasswordInput } from '@/components/password-input';
import { useSQLiteContext } from '@/db/provider';
import { Spacing } from '@/constants/theme';
import { useAuthStore } from '@/stores/use-auth-store';
import { useThemeColors } from '@/hooks/use-theme';

const bgImage = require('../../../assets/images/signup.png');

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
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
      <ImageBackground source={bgImage} style={styles.bgImage}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}>
              {/* Top 65% — heading overlay on wave */}
              <View style={styles.topSection}>
                <ThemedText type="title" style={styles.title}>
                  Create Account
                </ThemedText>
                <ThemedText type="callout" style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }]}>
                  Sign Up
                </ThemedText>
              </View>

              {/* Bottom 35% — white card with form */}
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                {/* Email input */}
                <View style={[styles.inputContainer, { borderColor: colors.divider }]}>
                  <SymbolView
                    name={{ ios: 'envelope.fill', android: 'email', web: 'email' }}
                    size={18}
                    tintColor={colors.textTertiary}
                  />
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

                {/* Password input */}
                <PasswordInput
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  showValidation
                />

                {/* Confirm Password */}
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

                {/* Sign Up button */}
                <Pressable
                  onPress={handleSignUp}
                  disabled={loading}
                  style={({ pressed }) => [
                    pressed && styles.pressed,
                    { backgroundColor: colors.primary },
                    styles.button,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                    {loading ? 'Creating...' : 'Sign Up'}
                  </ThemedText>
                </Pressable>

                {/* Ghost link */}
                <Link href="/(auth)/sign-in" asChild>
                  <ThemedText type="link" style={styles.linkButton}>
                    Already have an account? Sign In
                  </ThemedText>
                </Link>

                {/* Footer */}
                <ThemedText type="small" themeColor="textTertiary" style={styles.footer}>
                  SmoothTax &middot; v1.0.0
                </ThemedText>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgImage: {
    flex: 1,
    width: '100%',
  },
  safeArea: {
    flex: 1,
  },
  topSection: {
    flex: 0.65,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },
  title: {
    color: '#ffffff',
  },
  subtitle: {
    marginTop: Spacing.three,
    fontSize: 18,
    lineHeight: 24,
  },
  card: {
    flex: 0.35,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  scrollContent: {
    flexGrow: 1,
  },
  flex: {
    flex: 1,
  },
  inputContainer: {
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
    paddingVertical: Spacing.two + 4,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  linkButton: {
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
  },
});
