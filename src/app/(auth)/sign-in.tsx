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
import { supabase } from '@/lib/supabase';
import { useThemeColors } from '@/hooks/use-theme';

const bgImage = require('../../../assets/images/signin.png');

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((state) => state.signIn);
  const db = useSQLiteContext();
  const colors = useThemeColors();

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn(db, email, password);
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!supabase) {
      Alert.alert('Not Available', 'Supabase is not configured. Contact support to reset your password.');
      return;
    }
    const sb = supabase;
    Alert.prompt?.(
      'Reset Password',
      'Enter your email address and we\'ll send you a password reset link.',
      async (input) => {
        if (!input?.trim()) return;
        setLoading(true);
        try {
          const { error } = await sb.auth.resetPasswordForEmail(input.trim(), {
            redirectTo: 'smooth-tax://(auth)/sign-in',
          });
          if (error) throw new Error(error.message);
          Alert.alert('Check Your Email', 'If an account exists with that email, you\'ll receive a password reset link shortly.');
        } catch (e: any) {
          Alert.alert('Error', e.message ?? 'Failed to send reset email.');
        } finally {
          setLoading(false);
        }
      },
      'plain-text',
      '',
      'Send Reset Link'
    ) ?? (
      // Fallback for Android / web where Alert.prompt doesn't exist
      Alert.alert(
        'Reset Password',
        'Enter your email address in the field below.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send Reset Link',
            onPress: async () => {
              if (!email.trim()) {
                Alert.alert('Error', 'Please enter your email address in the email field above first.');
                return;
              }
              setLoading(true);
              try {
                const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
                  redirectTo: 'smooth-tax://(auth)/sign-in',
                });
                if (error) throw new Error(error.message);
                Alert.alert('Check Your Email', 'If an account exists with that email, you\'ll receive a password reset link shortly.');
              } catch (e: any) {
                Alert.alert('Error', e.message ?? 'Failed to send reset email.');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      )
    );
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
      <ImageBackground source={bgImage} style={styles.bgImage}>
        <SafeAreaView style={styles.safeArea}>
          {/* Top 65% — heading overlay on wave */}
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
                  SmoothTax
                </ThemedText>
                <ThemedText type="callout" style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }]}>
                  Sign In
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
                />

                {/* Sign In button */}
                <Pressable
                  onPress={handleSignIn}
                  disabled={loading}
                  style={({ pressed }) => [
                    pressed && styles.pressed,
                    { backgroundColor: colors.primary },
                    styles.button,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </ThemedText>
                </Pressable>

                {/* Forgot Password */}
                <Pressable onPress={handleForgotPassword} style={styles.forgotPassword}>
                  <ThemedText type="link" style={styles.forgotText}>
                    Forgot Password?
                  </ThemedText>
                </Pressable>

                {/* Ghost link */}
                <Link href="/(auth)/sign-up" asChild>
                  <ThemedText type="link" style={styles.linkButton}>
                    Don&apos;t have an account? Sign Up
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
  forgotPassword: {
    alignSelf: 'center',
    marginTop: Spacing.half,
  },
  forgotText: {
    fontSize: 14,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
  },
});
