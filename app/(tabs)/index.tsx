import { IconSymbol } from "@/components/ui/icon-symbol";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { HelloWave } from "@/components/hello-wave";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/Button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Outfit, outfitService } from "@/services/outfitService";

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadOutfits();
  }, []);

  const loadOutfits = async () => {
    try {
      setIsLoading(true);
      const data = await outfitService.getPublicOutfits();
      setOutfits(data);
    } catch (error: any) {
      // Intentionally silent or logged for production, but Alert helps the user debug their connection
      console.log("Supabase Fetch Error:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartProcessing = async () => {
    setIsProcessing(true);
    // Demonstrate "Heavy Backend Processing"
    await outfitService.processOutfitImage("sample_uri");
    setIsProcessing(false);
    Alert.alert("Processing Complete", "Your AI style analysis is ready!");
  };

  return (
    <ThemedView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedText style={styles.title}>Vlyzo</ThemedText>
          <HelloWave />
        </View>
        <Link href="/settings" asChild>
          <TouchableOpacity style={styles.settingsButton}>
            <IconSymbol name="gearshape.fill" size={24} color={theme.text} />
          </TouchableOpacity>
        </Link>
      </View>

      <FlatList
        data={outfits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            <ThemedView style={styles.processingSection}>
              <ThemedText style={styles.subtitle}>
                Backend Processing
              </ThemedText>
              <ThemedText style={styles.description}>
                Trigger an AI style check using Supabase Edge Functions.
              </ThemedText>
              <Button
                title={isProcessing ? "Analyzing..." : "Start AI Process"}
                onPress={handleStartProcessing}
                loading={isProcessing}
                variant="secondary"
              />
            </ThemedView>

            <ThemedText style={styles.sectionTitle}>Trending Now</ThemedText>
          </>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { borderColor: theme.border }]}>
            <View
              style={[
                styles.imagePlaceholder,
                { backgroundColor: theme.secondary },
              ]}
            >
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.cardImage}
                />
              ) : (
                <ThemedText style={styles.placeholderText}>No Image</ThemedText>
              )}
            </View>
            <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={theme.tint} />
          ) : (
            <ThemedText style={styles.emptyText}>
              No outfits found in the backend.
            </ThemedText>
          )
        }
        refreshing={isLoading}
        onRefresh={loadOutfits}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingsButton: {
    padding: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 16,
  },
  processingSection: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#1f7a8c",
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
    padding: 12,
  },
  imagePlaceholder: {
    height: 200,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  placeholderText: {
    opacity: 0.3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    opacity: 0.5,
  },
});
