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

export default function SignupScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password) {
      Alert.alert(
        "Missing information",
        "Please enter both email and password.",
      );
      return;
    }

    setIsLoading(true);
    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    setIsLoading(false);

    if (error) {
      Alert.alert("Signup Error", error.message);
    } else if (!session) {
      Alert.alert(
        "Success!",
        "Please check your email for a confirmation link.",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Join Vlyzo</Text>
          <Text style={[styles.subtitle, { color: theme.text }]}>
            Create your profile and start shaping the future of fashion.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Full Name"
            placeholder="Virgil Abloh"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
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

          <View style={styles.terms}>
            <Text style={[styles.termsText, { color: theme.text }]}>
              By signing up, you agree to our{" "}
              <Text style={[styles.link, { color: theme.tint }]}>
                Terms of Service
              </Text>
            </Text>
          </View>

          <Button
            title="Create Account"
            onPress={handleSignup}
            loading={isLoading}
            style={styles.signupButton}
          />

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.text }]}>
              Already a member?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.link, { color: theme.tint }]}>Sign In</Text>
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
    paddingVertical: 40,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.6,
    lineHeight: 22,
  },
  form: {
    width: "100%",
  },
  terms: {
    marginVertical: 16,
  },
  termsText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: "center",
  },
  signupButton: {
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
