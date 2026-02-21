import { Button } from "@/components/ui/Button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { outfitService } from "@/services/outfitService";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [p, s] = await Promise.all([
        outfitService.getProfile(),
        outfitService.getUserStats(),
      ]);
      setProfile(p);
      setStats(s);
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background, justifyContent: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Image source={{ uri: profile?.avatar_url }} style={styles.avatar} />
          <Text style={[styles.title, { color: theme.text }]}>
            {profile?.full_name}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text }]}>
            {profile?.bio}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {stats?.wardrobe}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text }]}>Items</Text>
          </View>
          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {stats?.outfits}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text }]}>
              Outfits
            </Text>
          </View>
          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {stats?.likes}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text }]}>Likes</Text>
          </View>
        </View>

        <View style={styles.actionSection}>
          <Button
            title="Edit Profile"
            variant="outline"
            onPress={() => {}}
            style={{ marginBottom: 12 }}
          />
          <Button title="Sign Out" variant="secondary" onPress={() => {}} />
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
    paddingTop: 80,
    paddingBottom: 120,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    borderWidth: 4,
    borderColor: "#1f7a8c",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.6,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(31, 122, 140, 0.05)",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    justifyContent: "space-around",
    marginBottom: 40,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: "60%",
    alignSelf: "center",
  },
  actionSection: {
    width: "100%",
  },
});
