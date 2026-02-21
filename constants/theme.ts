/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#022b3a", // Jet Black
    background: "#ffffff", // White
    tint: "#1f7a8c", // Teal
    icon: "#1f7a8c", // Teal
    tabIconDefault: "#bfdbf7", // Pale Sky
    tabIconSelected: "#1f7a8c", // Teal
    secondary: "#e1e5f2", // Lavender
    border: "#bfdbf7", // Pale Sky
  },
  dark: {
    text: "#ffffff", // White
    background: "#022b3a", // Jet Black
    tint: "#1f7a8c", // Teal
    icon: "#bfdbf7", // Pale Sky
    tabIconDefault: "#1f7a8c", // Teal
    tabIconSelected: "#bfdbf7", // Pale Sky
    secondary: "#1f7a8c", // Teal (Darkened Teal or shifted)
    border: "#1f7a8c", // Teal
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
