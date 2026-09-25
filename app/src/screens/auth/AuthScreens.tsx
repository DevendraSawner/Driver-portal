import { useEffect, useState } from "react";
import { Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button, ErrorText, Field, PasswordField, Screen } from "../../components/ui";
import { errorMessage } from "../../api/client";
import { useResendOtp, useVerifyOtp } from "../../hooks/queries";
import { useAuth } from "../../store/auth";
import type { AuthStackParamList } from "../../navigation/types";

export function SplashScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, "Splash">) {
  const { seenOnboarding } = useAuth();
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace(seenOnboarding ? "Login" : "Onboarding"), 600);
    return () => clearTimeout(timer);
  }, [navigation, seenOnboarding]);
  return (
    <Screen title="Driver on demand">
      <Text>Your car. A professional driver.</Text>
    </Screen>
  );
}

export function OnboardingScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, "Onboarding">) {
  const { completeOnboarding } = useAuth();
  return (
    <Screen title="How it works">
      <Text>You keep your car. A verified driver comes to you and drives it.</Text>
      <Button label="Continue" onPress={() => void completeOnboarding().then(() => navigation.replace("Login"))} />
    </Screen>
  );
}

export function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, "Login">) {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen title="Sign in">
      <Field value={phone} onChangeText={setPhone} placeholder="+919876543210" />
      <PasswordField value={password} onChangeText={setPassword} placeholder="Password" />
      {error ? <ErrorText message={error} /> : null}
      <Button label="Sign in" onPress={() => void login(phone.trim(), password).catch((caught) => setError(errorMessage(caught)))} />
      <Button label="Create account" onPress={() => navigation.navigate("Register")} />
    </Screen>
  );
}

export function RegisterScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, "Register">) {
  const { register } = useAuth();
  const [role, setRole] = useState<"USER" | "DRIVER">("USER");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen title="Register">
      <Button label={role === "USER" ? "Customer selected" : "Switch to customer"} onPress={() => setRole("USER")} />
      <Button label={role === "DRIVER" ? "Driver selected" : "Switch to driver"} onPress={() => setRole("DRIVER")} />
      <Field value={fullName} onChangeText={setFullName} placeholder="Full name" />
      <Field value={phone} onChangeText={setPhone} placeholder="+919876543210" />
      <PasswordField value={password} onChangeText={setPassword} placeholder="Password" />
      {error ? <ErrorText message={error} /> : null}
      <Button
        label="Register"
        onPress={() =>
          void register({ role, fullName: fullName.trim(), phone: phone.trim(), password })
            .then(() => navigation.navigate("Otp", { phone: phone.trim(), purpose: "REGISTER" }))
            .catch((caught) => setError(errorMessage(caught)))
        }
      />
    </Screen>
  );
}

export function OtpScreen({ route, navigation }: NativeStackScreenProps<AuthStackParamList, "Otp">) {
  const verify = useVerifyOtp();
  const resend = useResendOtp();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen title="Verify phone">
      <Field value={code} onChangeText={setCode} placeholder="6-digit code" />
      {error ? <ErrorText message={error} /> : null}
      {message ? <Text>{message}</Text> : null}
      <Button
        label="Verify"
        onPress={() =>
          void verify.mutateAsync({ phone: route.params.phone, purpose: route.params.purpose, code })
            .then(() => navigation.replace("Login"))
            .catch((caught) => setError(errorMessage(caught)))
        }
      />
      <Button label="Resend" onPress={() => void resend.mutateAsync({ phone: route.params.phone, purpose: route.params.purpose }).then(() => setMessage("If the account can receive a code, it has been sent.")).catch((caught) => setError(errorMessage(caught)))} />
    </Screen>
  );
}
