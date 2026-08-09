import { type PropsWithChildren } from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";

import { Neumorphism } from "@/constants/theme";
import { useNeumorphism, useTheme } from "@/hooks/use-theme";

export type NeumorphicCardProps = ViewProps & {
  surfaceColor?: string;
  inset?: boolean;
};

export function NeumorphicCard({
  children,
  style,
  surfaceColor,
  inset,
  ...otherProps
}: PropsWithChildren<NeumorphicCardProps>) {
  const theme = useTheme();
  const neo = useNeumorphism();
  const backgroundColor = surfaceColor ?? theme.card ?? theme.background;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor,
          shadowColor: neo.shadowDark,
          ...Platform.select({
            android: { elevation: inset ? 2 : 4 },
            web: {
              boxShadow: inset ? neo.inset : neo.extruded,
            },
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
  card: {
    borderRadius: Neumorphism.radiusContainer,
    padding: 20,
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    borderWidth: 0,
  },
});
