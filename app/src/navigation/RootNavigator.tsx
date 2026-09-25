import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen, OnboardingScreen, OtpScreen, RegisterScreen, SplashScreen } from "../screens/auth/AuthScreens";
import {
  AddVehicleScreen,
  AssignedScreen,
  BookDriverScreen,
  BookingConfirmationScreen,
  BookingDetailsScreen,
  ComplaintScreen,
  HistoryScreen,
  NotificationsScreen,
  PaymentConfirmationScreen,
  PaymentScreen,
  ProfileScreen,
  RatingScreen,
  SearchingScreen,
  SettingsScreen,
  TrackingScreen,
  TripDetailsScreen,
  UserHomeScreen,
  VehiclesScreen,
} from "../screens/user/UserScreens";
import {
  ActiveTripScreen,
  ArrivedScreen,
  CompleteTripScreen,
  DriverHomeScreen,
  DriverNotificationsScreen,
  DriverOnboardingScreen,
  DriverPaymentConfirmationScreen,
  DriverProfileScreen,
  DriverSettingsScreen,
  EarningsScreen,
  FeesScreen,
  KycScreen,
  KycStatusScreen,
  NavigationScreen,
  RatingsScreen,
  RequestDetailsScreen,
  RequestsScreen,
  SettlementsScreen,
  StartTripScreen,
  TransactionsScreen,
  WalletScreen,
} from "../screens/driver/DriverScreens";
import { useAuth } from "../store/auth";
import type { AuthStackParamList, DriverStackParamList, UserStackParamList } from "./types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const UserStack = createNativeStackNavigator<UserStackParamList>();
const DriverStack = createNativeStackNavigator<DriverStackParamList>();

function AuthNavigator() {
  const { seenOnboarding } = useAuth();
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Splash" component={SplashScreen} />
      {seenOnboarding ? null : <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />}
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="Otp" component={OtpScreen} />
    </AuthStack.Navigator>
  );
}

function UserNavigator() {
  return (
    <UserStack.Navigator>
      <UserStack.Screen name="Home" component={UserHomeScreen} options={{ title: "Home" }} />
      <UserStack.Screen name="Vehicles" component={VehiclesScreen} />
      <UserStack.Screen name="AddVehicle" component={AddVehicleScreen} />
      <UserStack.Screen name="BookDriver" component={BookDriverScreen} />
      <UserStack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
      <UserStack.Screen name="Searching" component={SearchingScreen} />
      <UserStack.Screen name="Assigned" component={AssignedScreen} />
      <UserStack.Screen name="Tracking" component={TrackingScreen} />
      <UserStack.Screen name="TripDetails" component={TripDetailsScreen} />
      <UserStack.Screen name="Payment" component={PaymentScreen} />
      <UserStack.Screen name="PaymentConfirmation" component={PaymentConfirmationScreen} />
      <UserStack.Screen name="History" component={HistoryScreen} />
      <UserStack.Screen name="BookingDetails" component={BookingDetailsScreen} />
      <UserStack.Screen name="Rating" component={RatingScreen} />
      <UserStack.Screen name="Complaint" component={ComplaintScreen} />
      <UserStack.Screen name="Notifications" component={NotificationsScreen} />
      <UserStack.Screen name="Profile" component={ProfileScreen} />
      <UserStack.Screen name="Settings" component={SettingsScreen} />
    </UserStack.Navigator>
  );
}

function DriverNavigator() {
  return (
    <DriverStack.Navigator initialRouteName="Home">
      <DriverStack.Screen name="Onboarding" component={DriverOnboardingScreen} />
      <DriverStack.Screen name="Kyc" component={KycScreen} />
      <DriverStack.Screen name="KycStatus" component={KycStatusScreen} />
      <DriverStack.Screen name="Home" component={DriverHomeScreen} />
      <DriverStack.Screen name="Requests" component={RequestsScreen} />
      <DriverStack.Screen name="RequestDetails" component={RequestDetailsScreen} />
      <DriverStack.Screen name="Navigation" component={NavigationScreen} />
      <DriverStack.Screen name="Arrived" component={ArrivedScreen} />
      <DriverStack.Screen name="StartTrip" component={StartTripScreen} />
      <DriverStack.Screen name="ActiveTrip" component={ActiveTripScreen} />
      <DriverStack.Screen name="CompleteTrip" component={CompleteTripScreen} />
      <DriverStack.Screen name="PaymentConfirmation" component={DriverPaymentConfirmationScreen} />
      <DriverStack.Screen name="Earnings" component={EarningsScreen} />
      <DriverStack.Screen name="Wallet" component={WalletScreen} />
      <DriverStack.Screen name="Fees" component={FeesScreen} />
      <DriverStack.Screen name="Settlements" component={SettlementsScreen} />
      <DriverStack.Screen name="Transactions" component={TransactionsScreen} />
      <DriverStack.Screen name="Ratings" component={RatingsScreen} />
      <DriverStack.Screen name="Notifications" component={DriverNotificationsScreen} />
      <DriverStack.Screen name="Profile" component={DriverProfileScreen} />
      <DriverStack.Screen name="Settings" component={DriverSettingsScreen} />
    </DriverStack.Navigator>
  );
}

export function RootNavigator() {
  const { ready, user } = useAuth();
  if (!ready) {
    return null;
  }
  return (
    <NavigationContainer>
      {!user ? <AuthNavigator /> : user.role === "DRIVER" ? <DriverNavigator /> : <UserNavigator />}
    </NavigationContainer>
  );
}
