import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useState } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
    ViewStyle,
} from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input = ({
  label,
  error,
  containerStyle,
  ...props
}: InputProps) => {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor:
              colorScheme === "light"
                ? theme.secondary
                : "rgba(255,255,255,0.05)",
            borderColor: isFocused ? theme.tint : "transparent",
            borderWidth: 1,
          },
        ]}
      >
        <TextInput
          placeholderTextColor={colorScheme === "light" ? "#999" : "#666"}
          style={[styles.input, { color: theme.text }]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    opacity: 0.8,
  },
  inputContainer: {
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  input: {
    fontSize: 16,
    height: "100%",
  },
  errorText: {
    color: "#ff4d4f",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});
