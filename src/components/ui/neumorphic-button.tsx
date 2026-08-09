import { type PropsWithChildren } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type TextStyle,
} from "react-native";

import { Neumorphism } from "@/constants/theme";
import { useNeumorphism, useTheme } from "@/hooks/use-theme";

export type NeumorphicButtonProps = PressableProps & {
  variant?: "primary" | "secondary" | "ghost";
  textStyle?: TextStyle;
};

export function NeumorphicButton({
  children,
  style,
  variant = "primary",
  textStyle,
  ...props
}: PropsWithChildren<NeumorphicButtonProps>) {
  const theme = useTheme();
  const neo = useNeumorphism();
  const isPrimary = variant === "primary";
  const backgroundColor = isPrimary ? neo.accent : theme.background;
  const textColor = isPrimary ? "#ffffff" : theme.text;

  return (
    <Pressable
      android_ripple={{ color: "rgba(0, 0, 0, 0.08)" }}
      style={(state) => [
        styles.button,
        {
          backgroundColor,
          shadowColor: neo.shadowDark,
          ...Platform.select({
            android: { elevation: state.pressed ? 2 : 4 },
            web: {
              boxShadow: state.pressed ? neo.extrudedHover : neo.extruded,
            },
          }),
        },
        state.pressed && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      <Text style={[styles.label, { color: textColor }, textStyle]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: Neumorphism.radiusButton,
    flexDirection: "row",
  },
  label: {
    fontWeight: "600",
    fontSize: 16,
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
});
