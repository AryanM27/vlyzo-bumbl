import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { outfitService } from "@/services/outfitService";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
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

  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadWardrobe();
  }, []);

  const loadWardrobe = async () => {
    try {
      setIsLoading(true);
      const data = await outfitService.getMyWardrobe();
      setItems(data || []);
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
        const fileName = `${Date.now()}.jpg`;
        await outfitService.uploadWardrobeImage(
          result.assets[0].base64,
          fileName,
        );
        await loadWardrobe();
      } catch (error) {
        console.error("Upload error:", error);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Wardrobe</Text>
        <Text style={[styles.subtitle, { color: theme.text }]}>
          Manage your digital closet
        </Text>
      </View>

      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={
          <TouchableOpacity
            style={[
              styles.addCard,
              {
                borderColor: theme.tint,
                backgroundColor:
                  colorScheme === "light"
                    ? "#f0f9fa"
                    : "rgba(31, 122, 140, 0.1)",
              },
            ]}
            onPress={handleAddItem}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color={theme.tint} />
            ) : (
              <View style={styles.addContent}>
                <IconSymbol name="plus" size={32} color={theme.tint} />
                <Text style={[styles.addText, { color: theme.tint }]}>
                  Add Item
                </Text>
              </View>
            )}
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { borderColor: theme.border }]}>
            <Image
              source={{ uri: item.image_url }}
              style={styles.cardImage}
              contentFit="cover"
            />
            <View style={styles.cardFooter}>
              <Text
                style={[styles.itemName, { color: theme.text }]}
                numberOfLines={1}
              >
                {item.name || "Untitled"}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.text }]}>
                No items in your wardrobe yet. Tap the + to add one!
              </Text>
            </View>
          ) : (
            <ActivityIndicator
              size="large"
              color={theme.tint}
              style={styles.loader}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 60,
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
  listContent: {
    padding: 24,
    paddingTop: 0,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  addCard: {
    width: "100%",
    height: 160,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  addContent: {
    alignItems: "center",
  },
  addText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  card: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH * 1.3,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  cardImage: {
    width: "100%",
    height: "80%",
  },
  cardFooter: {
    padding: 8,
    flex: 1,
    justifyContent: "center",
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
    textAlign: "center",
  },
  loader: {
    marginTop: 40,
  },
});
