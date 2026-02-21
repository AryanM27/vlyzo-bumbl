import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Outfit, outfitService } from "@/services/outfitService";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    View,
} from "react-native";

const { width } = Dimensions.get("window");
const ITEM_WIDTH = (width - 64) / 2;

export default function LikedScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [likedItems, setLikedItems] = useState<Outfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLiked();
  }, []);

  const loadLiked = async () => {
    try {
      setIsLoading(true);
      const data = await outfitService.getLikedOutfits();
      setLikedItems(data);
    } catch (error) {
      console.error("Error loading liked outfits:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Liked Outfits</Text>
        <Text style={[styles.subtitle, { color: theme.text }]}>
          Your curated style collection
        </Text>
      </View>

      <FlatList
        data={likedItems}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              { borderColor: theme.border, backgroundColor: theme.secondary },
            ]}
          >
            <Image
              source={{ uri: item.image_url || "" }}
              style={styles.cardImage}
              contentFit="cover"
            />
            <View style={styles.cardFooter}>
              <Text
                style={[styles.itemName, { color: theme.text }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.text }]}>
                No liked outfits yet. Start swiping on Home!
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
        refreshing={isLoading}
        onRefresh={loadLiked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  card: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH * 1.5,
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
    marginTop: 80,
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
