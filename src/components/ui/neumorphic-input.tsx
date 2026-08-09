import { type PropsWithChildren, type ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { Neumorphism } from "@/constants/theme";
import { useNeumorphism, useTheme } from "@/hooks/use-theme";

export type NeumorphicInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export function NeumorphicInput({
  style,
  containerStyle,
  leftIcon,
  rightIcon,
  ...props
}: PropsWithChildren<NeumorphicInputProps>) {
  const theme = useTheme();
  const neo = useNeumorphism();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          shadowColor: neo.shadowDark,
          ...Platform.select({
            android: { elevation: 2 },
            web: { boxShadow: neo.insetDeep },
          }),
        },
        containerStyle,
      ]}
    >
      {leftIcon != null && <View style={styles.icon}>{leftIcon}</View>}
      <TextInput
        style={[styles.input, { color: theme.text }, style]}
        placeholderTextColor={theme.placeholder}
        {...props}
      />
      {rightIcon != null && <View style={styles.icon}>{rightIcon}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Neumorphism.radiusButton,
    borderWidth: 1,
    borderColor: "rgba(128, 128, 128, 0.08)",
    overflow: "hidden",
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: "transparent",
  },
  icon: {
    paddingLeft: 18,
    paddingRight: 4,
  },
});
