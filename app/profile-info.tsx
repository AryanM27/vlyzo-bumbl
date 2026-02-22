import { Button } from "@/components/ui/Button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { outfitService } from "@/services/outfitService";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProfileInfoScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ outfits: 0, wardrobe: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [profileData, statsData] = await Promise.all([
        outfitService.getProfile(),
        outfitService.getUserStats(),
      ]);
      setProfile(profileData);
      setStats(statsData);
      setFullName(profileData.full_name || "");
    } catch (error) {
      console.error("Error loading profile data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [2, 3], // Taller for full length
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      try {
        setIsSaving(true);
        await outfitService.uploadProfilePhoto(result.assets[0].base64);
        await loadData(); // Refresh to see the photo
        Alert.alert("Success", "Full-length photo updated!");
      } catch (error) {
        Alert.alert("Error", "Failed to upload photo.");
        console.error("Error uploading photo:", error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await outfitService.updateProfile({ full_name: fullName });
      Alert.alert("Success", "Profile updated!");
    } catch (error) {
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setIsSaving(false);
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
      <Stack.Screen
        options={{
          title: "Profile Info",
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Photo Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.tint }]}>
            Full-Length Photo
          </Text>
          <Text style={styles.sectionDescription}>
            Upload a clear, full-body photo of yourself. This is used to
            virtually drape items from your wardrobe.
          </Text>
          <TouchableOpacity
            style={[
              styles.photoContainer,
              { borderColor: theme.border, backgroundColor: theme.secondary },
            ]}
            onPress={handleUploadPhoto}
            disabled={isSaving}
          >
            {profile?.full_length_photo_url ? (
              <Image
                source={{ uri: profile.full_length_photo_url }}
                style={styles.photo}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <IconSymbol name="camera.fill" size={40} color={theme.border} />
                <Text style={[styles.placeholderText, { color: theme.border }]}>
                  Tap to Upload
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.tint }]}>
            Your Stats
          </Text>
          <View style={styles.statsGrid}>
            <View
              style={[styles.statCard, { backgroundColor: theme.secondary }]}
            >
              <Text style={[styles.statValue, { color: theme.text }]}>
                {stats.outfits}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text }]}>
                Outfits
              </Text>
            </View>
            <View
              style={[styles.statCard, { backgroundColor: theme.secondary }]}
            >
              <Text style={[styles.statValue, { color: theme.text }]}>
                {stats.wardrobe}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text }]}>
                Items
              </Text>
            </View>
          </View>
        </View>

        {/* Defaults Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.tint }]}>
            Details
          </Text>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Full Name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.secondary,
                },
              ]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your name"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        <Button
          title={isSaving ? "Saving..." : "Save Changes"}
          onPress={handleSave}
          loading={isSaving}
          style={styles.saveButton}
        />
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
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    opacity: 0.6,
    lineHeight: 20,
    marginBottom: 16,
  },
  photoContainer: {
    width: "100%",
    height: 350,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    borderStyle: "dashed",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 16,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    opacity: 0.7,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  saveButton: {
    marginTop: 8,
    marginBottom: 40,
  },
});
