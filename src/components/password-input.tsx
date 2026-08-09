import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useNeumorphism, useThemeColors } from "@/hooks/use-theme";

export interface PasswordRules {
  minLength?: boolean;
  hasNumber?: boolean;
  hasUppercase?: boolean;
  hasSymbol?: boolean;
}

function validatePassword(password: string): PasswordRules {
  return {
    minLength: password.length >= 8,
    hasNumber: /\d/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };
}

function getValidationMessage(rules: PasswordRules): string | null {
  if (
    rules.minLength &&
    rules.hasNumber &&
    rules.hasUppercase &&
    rules.hasSymbol
  ) {
    return null;
  }
  return "Password does not meet requirements";
}

interface PasswordInputProps extends Omit<TextInputProps, "secureTextEntry"> {
  showValidation?: boolean;
}

export function PasswordInput({
  value,
  onChangeText,
  showValidation = false,
  ...rest
}: PasswordInputProps) {
  const [secureEntry, setSecureEntry] = useState(true);
  const rules = validatePassword(value ?? "");
  const colors = useThemeColors();
  const neo = useNeumorphism();

  return (
    <View>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.card ?? colors.background,
            shadowColor: neo.shadowDark,
            ...Platform.select({
              android: { elevation: 2 },
              web: { boxShadow: neo.insetDeep },
            }),
          },
        ]}
      >
        <SymbolView
          name={{ ios: "lock.fill", android: "lock", web: "lock" }}
          size={18}
          tintColor={colors.textTertiary}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureEntry}
          style={[styles.input, { color: colors.text }]}
          placeholderTextColor={colors.textTertiary}
          {...rest}
        />
        <Pressable
          onPress={() => setSecureEntry((prev) => !prev)}
          style={styles.eyeButton}
          hitSlop={8}
        >
          <SymbolView
            name={
              secureEntry
                ? { ios: "eye", android: "visibility", web: "visibility" }
                : {
                    ios: "eye.slash",
                    android: "visibility_off",
                    web: "visibility_off",
                  }
            }
            size={20}
            tintColor={colors.textTertiary}
          />
        </Pressable>
      </View>

      {showValidation && value ? (
        <View style={styles.validationContainer}>
          <ValidationRule label="At least 8 characters" met={rules.minLength} />
          <ValidationRule label="At least one number" met={rules.hasNumber} />
          <ValidationRule
            label="At least one uppercase letter"
            met={rules.hasUppercase}
          />
          <ValidationRule
            label="At least one symbol (!@#$...)"
            met={rules.hasSymbol}
          />
        </View>
      ) : null}
    </View>
  );
}

function ValidationRule({ label, met }: { label: string; met?: boolean }) {
  const colors = useThemeColors();
  const color = met ? colors.success : colors.textTertiary;

  return (
    <View style={styles.ruleRow}>
      <SymbolView
        name={
          met
            ? {
                ios: "checkmark.circle.fill",
                android: "check_circle",
                web: "check_circle",
              }
            : {
                ios: "circle",
                android: "radio_button_unchecked",
                web: "radio_button_unchecked",
              }
        }
        size={14}
        tintColor={color}
      />
      <ThemedText type="small" style={[styles.ruleLabel, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.two + 4,
    fontSize: 16,
  },
  eyeButton: {
    padding: Spacing.two,
    justifyContent: "center",
    alignItems: "center",
  },
  validationContainer: {
    marginTop: Spacing.one,
    gap: 4,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ruleLabel: {
    fontSize: 12,
  },
});
