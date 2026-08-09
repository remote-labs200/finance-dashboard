import { type PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";

import { Neumorphism } from "@/constants/theme";
import { useNeumorphism, useTheme } from "@/hooks/use-theme";

export type NeumorphicSurfaceProps = ViewProps & {
  inset?: boolean;
  deep?: boolean;
  small?: boolean;
  surfaceColor?: string;
};

/**
 * A small neumorphic well/surface for icon containers, chips, and inner
 * elements that should appear pressed into the parent card.
 */
export function NeumorphicSurface({
  children,
  style,
  inset = true,
  deep = false,
  small = false,
  surfaceColor,
  ...otherProps
}: PropsWithChildren<NeumorphicSurfaceProps>) {
  const theme = useTheme();
  const neo = useNeumorphism();
  const backgroundColor = surfaceColor ?? theme.card ?? theme.background;
  const shadow = deep ? neo.insetDeep : small ? neo.insetSmall : neo.inset;

  return (
    <View
      style={[
        styles.surface,
        {
          backgroundColor,
          shadowColor: neo.shadowDark,
          ...Platform.select({
            android: { elevation: inset ? 1 : 2 },
            web: { boxShadow: inset ? shadow : neo.extruded },
          }),
        },
        style,
      ]}
      {...otherProps}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: Neumorphism.radiusInner,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    borderWidth: 0,
  },
});
