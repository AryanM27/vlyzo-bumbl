import { IconSymbol } from "@/components/ui/icon-symbol";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Outfit, outfitService } from "@/services/outfitService";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    loadOutfits();
  }, []);

  const loadOutfits = async () => {
    try {
      setIsLoading(true);
      const data = await outfitService.getPublicOutfits();
      setOutfits(data);
      setCurrentIndex(0);
    } catch (error: any) {
      console.log("Supabase Fetch Error:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onSwipeComplete = useCallback(
    (direction: "left" | "right") => {
      const outfit = outfits[currentIndex];
      if (direction === "right") {
        outfitService.toggleLikeOutfit(outfit);
      }

      // Move to next card
      setCurrentIndex((prev) => prev + 1);
      translateX.value = 0;
      translateY.value = 0;
    },
    [outfits, currentIndex],
  );

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        const direction = event.translationX > 0 ? "right" : "left";
        translateX.value = withSpring(
          event.translationX > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH,
          {
            velocity: event.velocityX,
          },
        );
        runOnJS(onSwipeComplete)(direction);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-10, 0, 10],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const renderCard = () => {
    if (currentIndex >= outfits.length) {
      return (
        <View style={styles.emptyContainer}>
          <IconSymbol name="sparkles" size={64} color={theme.tint} />
          <ThemedText style={styles.emptyText}>
            You've seen everything!
          </ThemedText>
        </View>
      );
    }

    const currentOutfit = outfits[currentIndex];

    return (
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.cardContainer, cardStyle]}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                borderWidth: 3,
                borderRadius: 24,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 5,
              },
            ]}
          >
            <Image
              source={{ uri: currentOutfit.image_url || "" }}
              style={styles.cardImage}
              contentFit="cover"
            />

            <View style={styles.overlay} />

            <Animated.View style={[styles.likeBadge, likeOpacity]}>
              <ThemedText style={styles.badgeText}>YAY</ThemedText>
            </Animated.View>

            <Animated.View style={[styles.nopeBadge, nopeOpacity]}>
              <ThemedText style={[styles.badgeText, { color: "#FF4136" }]}>
                NAY
              </ThemedText>
            </Animated.View>

            {/* <View style={styles.cardFooter}>
              <ThemedText style={styles.cardTitle}>
                {currentOutfit.title}
              </ThemedText>
              <ThemedText style={styles.cardDesc}>
                {currentOutfit.description}
              </ThemedText>
              <View style={styles.tagContainer}>
                <View
                  style={[styles.tag, { backgroundColor: theme.tint + "40" }]}
                >
                  <ThemedText style={[styles.tagText, { color: "white" }]}>
                    Draped on Avatar
                  </ThemedText>
                </View>
              </View>
            </View> */}
          </View>
        </Animated.View>
      </GestureDetector>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.header}>
          <Link href="/settings" asChild>
            <TouchableOpacity style={styles.settingsButton}>
              <IconSymbol name="gearshape.fill" size={24} color={theme.text} />
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.deckContainer}>
          {isLoading ? (
            <ActivityIndicator size="large" color={theme.tint} />
          ) : (
            renderCard()
          )}
        </View>
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 60,
    right: 24,
    zIndex: 10,
  },
  settingsButton: {
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 20,
  },
  deckContainer: {
    flex: 1,
    padding: 16,
    paddingBottom: 16,
  },
  cardContainer: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: "white",
    overflow: "hidden",
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  cardFooter: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  cardTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "white",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 16,
  },
  tagContainer: {
    flexDirection: "row",
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "700",
  },
  likeBadge: {
    position: "absolute",
    top: 100,
    left: 40,
    borderWidth: 4,
    borderColor: "#2ECC40",
    paddingHorizontal: 15,
    borderRadius: 10,
    transform: [{ rotate: "-15deg" }],
    zIndex: 20,
  },
  nopeBadge: {
    position: "absolute",
    top: 100,
    right: 40,
    borderWidth: 4,
    borderColor: "#FF4136",
    paddingHorizontal: 15,
    borderRadius: 10,
    transform: [{ rotate: "15deg" }],
    zIndex: 20,
  },
  badgeText: {
    fontSize: 40,
    fontWeight: "900",
    color: "#2ECC40",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    opacity: 0.5,
    marginTop: 16,
    marginBottom: 24,
  },
  refreshButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
});
