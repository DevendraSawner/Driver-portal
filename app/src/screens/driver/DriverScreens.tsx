import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { errorMessage } from "../../api/client";
import { Button, Empty, ErrorText, Field, Loading, Muted, Screen } from "../../components/ui";
import {
  useAcceptBooking,
  useAvailability,
  useCompleteTrip,
  useConfirmPayment,
  useDriverProfile,
  useFees,
  useKycStatus,
  useLedger,
  useMarkArrived,
  useMarkEnRoute,
  usePayFees,
  useRejectBooking,
  useRequests,
  useSettlements,
  useStartTrip,
  useSubmitKyc,
  useUpdateDriverProfile,
  useWallet,
} from "../../hooks/queries";
import { useAuth } from "../../store/auth";
import { canTrackLocation, startLocationTracking, stopLocationTracking } from "../../services/location";
import { getPushProvider } from "../../services/notifications";
import { formatMoney, idempotencyKey } from "../../utils/format";
import type { Booking } from "../../types/models";
import type { DriverStackParamList } from "../../navigation/types";

function todayEarning(entries: { amountMinor: number; direction: string; createdAt: string; account: string }[] | undefined, complete: boolean): string {
  if (!entries || !complete) {
    return "Unavailable";
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const total = entries
    .filter((entry) => entry.account === "DRIVER_PAYABLE" && entry.direction === "CREDIT" && new Date(entry.createdAt) >= start)
    .reduce((sum, entry) => sum + entry.amountMinor, 0);
  return formatMoney(total);
}

export function DriverOnboardingScreen({ navigation }: NativeStackScreenProps<DriverStackParamList, "Onboarding">) {
  const update = useUpdateDriverProfile();
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  return (
    <Screen title="Driver onboarding">
      <Field value={fullName} onChangeText={setFullName} placeholder="Full name" />
      <Field value={city} onChangeText={setCity} placeholder="City" />
      {update.isError ? <ErrorText message={errorMessage(update.error)} /> : null}
      <Button label="Save profile" onPress={() => update.mutate({ fullName, city }, { onSuccess: () => navigation.navigate("Kyc") })} />
    </Screen>
  );
}

export function KycScreen({ navigation }: NativeStackScreenProps<DriverStackParamList, "Kyc">) {
  const submit = useSubmitKyc();
  const [license, setLicense] = useState("");
  const [identity, setIdentity] = useState("");
  const [photo, setPhoto] = useState("");
  return (
    <Screen title="KYC">
      <Field value={license} onChangeText={setLicense} placeholder="Driving licence file key" />
      <Field value={identity} onChangeText={setIdentity} placeholder="Identity proof file key" />
      <Field value={photo} onChangeText={setPhoto} placeholder="Profile photo file key" />
      {submit.isError ? <ErrorText message={errorMessage(submit.error)} /> : null}
      <Button
        label="Submit documents"
        onPress={() =>
          submit.mutate(
            [
              { type: "DRIVING_LICENSE", fileKey: license, mimeType: "image/jpeg" },
              { type: "IDENTITY_PROOF", fileKey: identity, mimeType: "image/jpeg" },
              { type: "PROFILE_PHOTO", fileKey: photo, mimeType: "image/jpeg" },
            ],
            { onSuccess: () => navigation.replace("KycStatus") },
          )
        }
      />
    </Screen>
  );
}

export function KycStatusScreen({ navigation }: NativeStackScreenProps<DriverStackParamList, "KycStatus">) {
  const query = useKycStatus();
  return (
    <Screen title="KYC status">
      {query.isLoading ? <Loading /> : null}
      {query.isError ? <ErrorText message={errorMessage(query.error)} /> : null}
      {query.data ? <Text>{query.data.kycStatus}{query.data.kycRejectionReason ? ` · ${query.data.kycRejectionReason}` : ""}</Text> : null}
      <Button label="Continue" onPress={() => navigation.replace("Home")} />
    </Screen>
  );
}

export function DriverHomeScreen({ navigation }: NativeStackScreenProps<DriverStackParamList, "Home">) {
  const profile = useDriverProfile();
  const availability = useAvailability();
  const requests = useRequests();
  const wallet = useWallet();
  const ledger = useLedger();
  const online = profile.data?.onlineStatus === "ONLINE";
  const active = requests.data?.find((item) => ["DRIVER_ACCEPTED", "DRIVER_ON_THE_WAY", "DRIVER_ARRIVED", "TRIP_STARTED"].includes(item.status));
  const todayTrips = "Unavailable";
  useEffect(() => {
    if (canTrackLocation(online, active?.status ?? null)) {
      startLocationTracking({ online, bookingStatus: active?.status ?? null });
      return () => stopLocationTracking();
    }
    stopLocationTracking();
    return undefined;
  }, [online, active?.status]);
  return (
    <Screen title="Driver home">
      {profile.isLoading ? <Loading /> : null}
      {profile.isError ? <ErrorText message={errorMessage(profile.error)} /> : null}
      <Button label={online ? "Go offline" : "Go online"} disabled={availability.isPending} onPress={() => availability.mutate(!online)} />
      {availability.isError ? <ErrorText message={errorMessage(availability.error)} /> : null}
      <Text>Today's trips: {todayTrips}</Text>
      <Text>Today's earnings: {ledger.isError ? "Unavailable" : todayEarning(ledger.data?.items, (ledger.data?.pagination.totalPages ?? 1) <= 1)}</Text>
      <Text>Outstanding platform fees: {wallet.data ? formatMoney(wallet.data.outstandingFeeMinor, wallet.data.currency) : wallet.isError ? "Unavailable" : "—"}</Text>
      <Text>Rating: Unavailable</Text>
      <Text>Active booking: {active ? `${active.referenceCode} · ${active.status}` : "None"}</Text>
      <Button label="Booking requests" onPress={() => navigation.navigate("Requests")} />
      <Button label="Earnings" onPress={() => navigation.navigate("Earnings")} />
      <Button label="Notifications" onPress={() => navigation.navigate("Notifications")} />
      <Button label="Profile" onPress={() => navigation.navigate("Profile")} />
      <Button label="Settings" onPress={() => navigation.navigate("Settings")} />
    </Screen>
  );
}

function RequestFacts({ booking }: { booking: Booking }) {
  return (
    <>
      <Text>Pickup: {booking.pickup.address}</Text>
      <Text>Destination: {booking.destination.address}</Text>
      <Text>When: {booking.scheduledAt}</Text>
      <Text>Estimated earning: {formatMoney(booking.driverEarningMinor, booking.currency)}</Text>
      <Text>Type: {booking.type}</Text>
      <Text>Vehicle: {booking.vehicle.brand} {booking.vehicle.model} · {booking.vehicle.vehicleType}</Text>
    </>
  );
}

export function RequestsScreen({ navigation }: NativeStackScreenProps<DriverStackParamList, "Requests">) {
  const query = useRequests();
  return (
    <Screen title="Booking requests">
      {query.isLoading ? <Loading /> : null}
      {query.isError ? <ErrorText message={errorMessage(query.error)} /> : null}
      {query.data?.length === 0 ? <Empty text="No requests right now." /> : null}
      {query.data?.map((booking) => (
        <Button key={booking.id} label={`${booking.referenceCode} · ${booking.pickup.address}`} onPress={() => navigation.navigate("RequestDetails", { id: booking.id })} />
      ))}
    </Screen>
  );
}

export function RequestDetailsScreen({ route, navigation }: NativeStackScreenProps<DriverStackParamList, "RequestDetails">) {
  const query = useRequests();
  const accept = useAcceptBooking();
  const reject = useRejectBooking();
  const booking = query.data?.find((item) => item.id === route.params.id);
  if (query.isLoading) return <Screen title="Booking details"><Loading /></Screen>;
  if (!booking) return <Screen title="Booking details"><Empty text="This request is no longer available." /></Screen>;
  return (
    <Screen title="Booking details">
      <RequestFacts booking={booking} />
      {accept.isError ? <ErrorText message={errorMessage(accept.error)} /> : null}
      {reject.isError ? <ErrorText message={errorMessage(reject.error)} /> : null}
      <Button label="Accept" onPress={() => accept.mutate(booking.id, { onSuccess: () => navigation.replace("Navigation", { id: booking.id }) })} />
      <Button label="Reject" onPress={() => reject.mutate({ id: booking.id, reason: "Driver declined" }, { onSuccess: () => navigation.goBack() })} />
    </Screen>
  );
}

export function NavigationScreen({ route, navigation }: NativeStackScreenProps<DriverStackParamList, "Navigation">) {
  const enRoute = useMarkEnRoute();
  const arrived = useMarkArrived();
  return (
    <Screen title="Navigation">
      {enRoute.isError ? <ErrorText message={errorMessage(enRoute.error)} /> : null}
      {arrived.isError ? <ErrorText message={errorMessage(arrived.error)} /> : null}
      <Button label="I am on the way" onPress={() => enRoute.mutate(route.params.id)} />
      <Button label="I have arrived" onPress={() => arrived.mutate(route.params.id, { onSuccess: () => navigation.replace("Arrived", { id: route.params.id }) })} />
    </Screen>
  );
}

export function ArrivedScreen({ route, navigation }: NativeStackScreenProps<DriverStackParamList, "Arrived">) {
  return (
    <Screen title="Arrived">
      <Muted text="Ask the customer for the trip start code." />
      <Button label="Enter start code" onPress={() => navigation.navigate("StartTrip", { id: route.params.id })} />
    </Screen>
  );
}

export function StartTripScreen({ route, navigation }: NativeStackScreenProps<DriverStackParamList, "StartTrip">) {
  const start = useStartTrip();
  const [otp, setOtp] = useState("");
  return (
    <Screen title="Start trip">
      <Field value={otp} onChangeText={setOtp} placeholder="Trip start code" />
      {start.isError ? <ErrorText message={errorMessage(start.error)} /> : null}
      <Button label="Start trip" onPress={() => start.mutate({ id: route.params.id, otp }, { onSuccess: () => navigation.replace("ActiveTrip", { id: route.params.id }) })} />
    </Screen>
  );
}

export function ActiveTripScreen({ route, navigation }: NativeStackScreenProps<DriverStackParamList, "ActiveTrip">) {
  const complete = useCompleteTrip();
  return (
    <Screen title="Active trip">
      {complete.isError ? <ErrorText message={errorMessage(complete.error)} /> : null}
      <Button label="Complete trip" onPress={() => complete.mutate(route.params.id, { onSuccess: () => navigation.replace("CompleteTrip", { id: route.params.id }) })} />
    </Screen>
  );
}

export function CompleteTripScreen({ navigation }: NativeStackScreenProps<DriverStackParamList, "CompleteTrip">) {
  const confirm = useConfirmPayment();
  const [paymentId, setPaymentId] = useState("");
  return (
    <Screen title="Trip complete">
      <Field value={paymentId} onChangeText={setPaymentId} placeholder="Direct payment id to confirm" />
      {confirm.isError ? <ErrorText message={errorMessage(confirm.error)} /> : null}
      <Button label="Confirm direct payment" onPress={() => confirm.mutate(paymentId, { onSuccess: () => navigation.replace("PaymentConfirmation") })} />
    </Screen>
  );
}

export function DriverPaymentConfirmationScreen() {
  return (
    <Screen title="Payment confirmation">
      <Muted text="The confirmation result comes from the payment API. This screen does not store a local payment record." />
    </Screen>
  );
}

export function EarningsScreen({ navigation }: NativeStackScreenProps<DriverStackParamList, "Earnings">) {
  const wallet = useWallet();
  return (
    <Screen title="Earnings">
      {wallet.isLoading ? <Loading /> : null}
      {wallet.isError ? <ErrorText message={errorMessage(wallet.error)} /> : null}
      {wallet.data ? (
        <Text>Payable {formatMoney(wallet.data.payableMinor, wallet.data.currency)}. Lifetime earning {formatMoney(wallet.data.lifetimeEarningMinor, wallet.data.currency)}.</Text>
      ) : null}
      <Button label="Wallet" onPress={() => navigation.navigate("Wallet")} />
      <Button label="Platform fees" onPress={() => navigation.navigate("Fees")} />
      <Button label="Settlements" onPress={() => navigation.navigate("Settlements")} />
      <Button label="Transactions" onPress={() => navigation.navigate("Transactions")} />
    </Screen>
  );
}

export function WalletScreen() {
  const wallet = useWallet();
  if (wallet.isLoading) return <Screen title="Wallet"><Loading /></Screen>;
  if (wallet.isError || !wallet.data) return <Screen title="Wallet"><ErrorText message={errorMessage(wallet.error)} /></Screen>;
  return (
    <Screen title="Wallet">
      <Text>Payable {formatMoney(wallet.data.payableMinor, wallet.data.currency)}</Text>
      <Text>Outstanding fees {formatMoney(wallet.data.outstandingFeeMinor, wallet.data.currency)}</Text>
    </Screen>
  );
}

export function FeesScreen() {
  const fees = useFees();
  const pay = usePayFees();
  return (
    <Screen title="Platform fees">
      {fees.isLoading ? <Loading /> : null}
      {fees.isError ? <ErrorText message={errorMessage(fees.error)} /> : null}
      {fees.data?.length === 0 ? <Empty text="No platform fees." /> : null}
      {fees.data?.map((fee) => <Text key={fee.id}>{fee.status} · {formatMoney(fee.amountMinor, fee.currency)}</Text>)}
      {pay.isError ? <ErrorText message={errorMessage(pay.error)} /> : null}
      <Button label="Pay outstanding fees" onPress={() => pay.mutate(idempotencyKey(), { onSuccess: (result) => { if (result && typeof result === "object" && "checkoutUrl" in result && typeof result.checkoutUrl === "string") { void Linking.openURL(result.checkoutUrl); } } })} />
    </Screen>
  );
}

export function SettlementsScreen() {
  const query = useSettlements();
  return (
    <Screen title="Settlements">
      {query.isLoading ? <Loading /> : null}
      {query.isError ? <ErrorText message={errorMessage(query.error)} /> : null}
      {query.data?.items.length === 0 ? <Empty text="No settlements." /> : null}
      {query.data?.items.map((item) => <Text key={item.id}>{item.direction} · {item.status} · {formatMoney(item.amountMinor, item.currency)}</Text>)}
    </Screen>
  );
}

export function TransactionsScreen() {
  const query = useLedger();
  return (
    <Screen title="Transaction history">
      {query.isLoading ? <Loading /> : null}
      {query.isError ? <ErrorText message={errorMessage(query.error)} /> : null}
      {query.data?.items.length === 0 ? <Empty text="No transactions." /> : null}
      {query.data?.items.map((item) => <Text key={item.id}>{item.direction} · {formatMoney(item.amountMinor, item.currency)} · {item.memo}</Text>)}
    </Screen>
  );
}

export function RatingsScreen() {
  return <Screen title="Ratings"><Empty text="A ratings total is not available from the API." /></Screen>;
}

export function DriverNotificationsScreen() {
  const provider = getPushProvider();
  return (
    <Screen title="Notifications">
      <Muted text={provider ? "Push delivery is configured." : "Firebase Cloud Messaging is not connected. Register a push provider to receive messages."} />
    </Screen>
  );
}

export function DriverProfileScreen() {
  const profile = useDriverProfile();
  return (
    <Screen title="Profile">
      {profile.isLoading ? <Loading /> : null}
      {profile.isError ? <ErrorText message={errorMessage(profile.error)} /> : null}
      {profile.data ? <Text>{profile.data.fullName} · {profile.data.kycStatus}</Text> : null}
    </Screen>
  );
}

export function DriverSettingsScreen() {
  const { logout } = useAuth();
  return (
    <Screen title="Settings">
      <Button label="Sign out" onPress={() => void logout()} />
    </Screen>
  );
}
