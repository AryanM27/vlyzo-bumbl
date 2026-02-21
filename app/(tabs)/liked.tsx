import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function LikedScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            Liked Outfits
          </Text>
          <Text style={[styles.subtitle, { color: theme.text }]}>
            Your curated collection
          </Text>
        </View>

        <View
          style={[
            styles.placeholder,
            {
              backgroundColor:
                colorScheme === "light"
                  ? theme.secondary
                  : "rgba(255,255,255,0.05)",
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.placeholderText, { color: theme.text }]}>
            Your saved outfits will appear here.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.6,
    marginTop: 4,
  },
  placeholder: {
    height: 300,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 16,
    opacity: 0.5,
  },
});
