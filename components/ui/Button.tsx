import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    ViewStyle,
} from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline";
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export const Button = ({
  title,
  onPress,
  loading = false,
  variant = "primary",
  style,
  textStyle,
  disabled = false,
}: ButtonProps) => {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];

  const getVariantStyle = () => {
    switch (variant) {
      case "primary":
        return { backgroundColor: theme.tint };
      case "secondary":
        return { backgroundColor: theme.secondary };
      case "outline":
        return {
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: theme.tint,
        };
      default:
        return { backgroundColor: theme.tint };
    }
  };

  const getTextColor = () => {
    if (variant === "outline") return theme.tint;
    if (variant === "secondary" && colorScheme === "light") return theme.text;
    return "#ffffff";
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        getVariantStyle(),
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    marginVertical: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.5,
  },
});
