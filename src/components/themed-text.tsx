import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFontScale } from '@/stores/use-ui-prefs';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'callout' | 'headline' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

const BASE_STYLES = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 28,
    fontWeight: 600,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 600,
  },
  callout: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: 500,
  },
  headline: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const fontScale = useFontScale();

  const baseStyle =
    type === 'default' ? BASE_STYLES.default :
    type === 'title' ? BASE_STYLES.title :
    type === 'small' ? BASE_STYLES.small :
    type === 'smallBold' ? BASE_STYLES.smallBold :
    type === 'subtitle' ? BASE_STYLES.subtitle :
    type === 'callout' ? BASE_STYLES.callout :
    type === 'headline' ? BASE_STYLES.headline :
    type === 'link' ? BASE_STYLES.link :
    type === 'linkPrimary' ? BASE_STYLES.linkPrimary :
    type === 'code' ? BASE_STYLES.code :
    undefined;

  const scaledStyle = baseStyle && fontScale !== 1
    ? {
        fontSize: baseStyle.fontSize ? Math.round(baseStyle.fontSize * fontScale) : undefined,
        lineHeight: 'lineHeight' in baseStyle && baseStyle.lineHeight
          ? Math.round(baseStyle.lineHeight * fontScale)
          : undefined,
      }
    : {};

  const linkStyle = type === 'link' || type === 'linkPrimary'
    ? { color: theme.primary }
    : {};

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        baseStyle,
        scaledStyle,
        linkStyle,
        style,
      ]}
      {...rest}
    />
  );
}
