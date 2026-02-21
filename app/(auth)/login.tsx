import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(
        "Missing information",
        "Please enter both email and password.",
      );
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      Alert.alert("Login Error", error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Vlyzo</Text>
          <Text style={[styles.subtitle, { color: theme.text }]}>
            Elevate your style. Welcome back.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="style@vlyzo.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={[styles.forgotPasswordText, { color: theme.tint }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            style={styles.loginButton}
          />

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.text }]}>
              New to Vlyzo?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
              <Text style={[styles.link, { color: theme.tint }]}>
                Join the movement
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    marginBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.6,
    lineHeight: 24,
  },
  form: {
    width: "100%",
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "600",
  },
  loginButton: {
    marginTop: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    opacity: 0.7,
  },
  link: {
    fontSize: 14,
    fontWeight: "700",
  },
});
