import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: colorScheme === "dark" ? "#666" : "#999",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginBottom: Platform.OS === "ios" ? 0 : 8,
        },
      }}
    >
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: "Wardrobe",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="tshirt.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[styles.centerButton, { backgroundColor: theme.tint }]}
            >
              <IconSymbol size={30} name="house.fill" color="#ffffff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="liked"
        options={{
          title: "Liked",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="heart.fill" color={color} />
          ),
        }}
      />
      {/* Hide the profile tab from bottom nav but keep the screen file */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Platform.OS === "ios" ? -20 : -30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
});
