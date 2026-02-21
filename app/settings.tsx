import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { supabase } from "@/lib/supabase";
import { Stack, useRouter } from "expo-router";
import React from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];
  const router = useRouter();

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) {
            Alert.alert("Error", error.message);
          } else {
            router.replace("/(auth)/login");
          }
        },
      },
    ]);
  };

  const SettingItem = ({
    icon,
    label,
    onPress,
    destructive = false,
  }: {
    icon: string;
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.item, { borderBottomColor: theme.border }]}
      onPress={onPress}
    >
      <View style={styles.itemLeft}>
        <IconSymbol
          name={icon as any}
          size={22}
          color={destructive ? "#ff4444" : theme.text}
        />
        <Text
          style={[
            styles.itemLabel,
            { color: destructive ? "#ff4444" : theme.text },
          ]}
        >
          {label}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={theme.border} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: "Settings",
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.tint }]}>
            Account
          </Text>
          <SettingItem
            icon="person.fill"
            label="Profile Information"
            onPress={() => router.push("/profile-info")}
          />
          <SettingItem icon="lock.fill" label="Security" onPress={() => {}} />
          <SettingItem
            icon="bell.fill"
            label="Notifications"
            onPress={() => {}}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.tint }]}>App</Text>
          <SettingItem
            icon="paintbrush.fill"
            label="Appearance"
            onPress={() => {}}
          />
          <SettingItem
            icon="questionmark.circle.fill"
            label="Help & Support"
            onPress={() => {}}
          />
          <SettingItem
            icon="info.circle.fill"
            label="About Vlyzo"
            onPress={() => {}}
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            icon="rectangle.portrait.and.arrow.right"
            label="Sign Out"
            onPress={handleSignOut}
            destructive
          />
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
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
    opacity: 0.8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
});
