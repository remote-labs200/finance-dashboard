import { type PropsWithChildren } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
} from "react-native";

import { Neumorphism } from "@/constants/theme";
import { useNeumorphism, useTheme } from "@/hooks/use-theme";

export type NeumorphicPressableProps = PressableProps & {
  inset?: boolean;
  surfaceColor?: string;
};

/**
 * A pressable neumorphic card. Extrudes by default; use `inset` for
 * toggle chips and pressed-looking controls.
 */
export function NeumorphicPressable({
  children,
  style,
  inset = false,
  surfaceColor,
  ...props
}: PropsWithChildren<NeumorphicPressableProps>) {
  const theme = useTheme();
  const neo = useNeumorphism();
  const backgroundColor = surfaceColor ?? theme.card ?? theme.background;

  return (
    <Pressable
      android_ripple={{ color: "rgba(0, 0, 0, 0.06)" }}
      style={(state) => [
        styles.card,
        {
          backgroundColor,
          shadowColor: neo.shadowDark,
          ...Platform.select({
            android: { elevation: state.pressed ? 1 : 3 },
            web: {
              boxShadow: inset
                ? state.pressed
                  ? neo.extrudedSmall
                  : neo.inset
                : state.pressed
                  ? neo.inset
                  : neo.extruded,
            },
          }),
        },
        state.pressed && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Neumorphism.radiusContainer,
    padding: 16,
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    borderWidth: 0,
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
});
