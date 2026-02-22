import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { outfitService, WardrobeItem } from "@/services/outfitService";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");
const ITEM_WIDTH = (width - 64) / 2;

export default function WardrobeScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadWardrobe();
  }, []);

  const loadWardrobe = async () => {
    try {
      setIsLoading(true);
      const data = await outfitService.getMyWardrobe();
      setItems((data as any) || []);
    } catch (error) {
      console.error("Error loading wardrobe:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      try {
        setIsUploading(true);
        await outfitService.uploadWardrobeImage(
          result.assets[0].base64,
          "single",
        );
        await loadWardrobe();
      } catch (error) {
        console.error("Upload error:", error);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const categorizedItems = useMemo(() => {
    const categories: Record<string, WardrobeItem[]> = {
      Top: [],
      Bottom: [],
      Outerwear: [],
      Accessory: [],
    };
    items.forEach((item) => {
      if (categories[item.category]) categories[item.category].push(item);
      else categories.Top.push(item);
    });
    return categories;
  }, [items]);

  const renderSection = (title: string, data: WardrobeItem[]) => {
    if (data.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {title}
        </Text>
        <View style={styles.row}>
          {data.map((item) => (
            <View
              key={item.id}
              style={[
                styles.card,
                { borderColor: theme.border, backgroundColor: theme.secondary },
              ]}
            >
              <Image
                source={{ uri: item.image_url }}
                style={styles.cardImage}
                contentFit="contain"
              />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Extracted</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text
                  style={[styles.itemName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Wardrobe</Text>
          <Text style={[styles.subtitle, { color: theme.text }]}>
            Your AI segregated closet
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.addCard,
            {
              borderColor: theme.tint,
              backgroundColor:
                colorScheme === "light" ? "#f0f9fa" : "rgba(31, 122, 140, 0.1)",
            },
          ]}
          onPress={handleAddItem}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color={theme.tint} />
          ) : (
            <View style={styles.addContent}>
              <IconSymbol name="camera.fill" size={32} color={theme.tint} />
              <Text style={[styles.addText, { color: theme.tint }]}>
                Upload OOTD for Segregation
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={theme.tint}
            style={styles.loader}
          />
        ) : (
          <>
            {renderSection("Tops", categorizedItems.Top)}
            {renderSection("Bottoms", categorizedItems.Bottom)}
            {renderSection("Outerwear", categorizedItems.Outerwear)}
            {renderSection("Accessories", categorizedItems.Accessory)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    marginBottom: 24,
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
  addCard: {
    marginHorizontal: 24,
    height: 100,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  addContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addText: {
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH * 1.3,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "75%",
    marginTop: 8,
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(31, 122, 140, 0.8)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  cardFooter: {
    padding: 8,
    flex: 1,
    justifyContent: "center",
  },
  itemName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  loader: {
    marginTop: 40,
  },
});
