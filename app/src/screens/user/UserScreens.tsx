import { useState } from "react";
import { Linking, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button, Empty, ErrorText, Field, Loading, Muted, Screen } from "../../components/ui";
import { errorMessage } from "../../api/client";
import {
  activeBooking,
  useBooking,
  useBookingLocation,
  useBookings,
  useCancelBooking,
  useCreateBooking,
  useCreateComplaint,
  useCreateRating,
  useCreateVehicle,
  useDeclareDirectPayment,
  useMe,
  useNotifications,
  usePayment,
  useStartPlatformPayment,
  useUpdateMe,
  useVehicles,
} from "../../hooks/queries";
import { useAuth } from "../../store/auth";
import { formatMoney, idempotencyKey } from "../../utils/format";
import type { UserStackParamList } from "../../navigation/types";

export function UserHomeScreen({ navigation }: NativeStackScreenProps<UserStackParamList, "Home">) {
  const bookings = useBookings();
  const active = activeBooking(bookings.data?.items);
  const recent = bookings.data?.items.slice(0, 3) ?? [];
  return (
    <Screen title="Home">
      <Button label="Book driver now" onPress={() => navigation.navigate("BookDriver", { type: "IMMEDIATE" })} />
      <Button label="Schedule driver" onPress={() => navigation.navigate("BookDriver", { type: "SCHEDULED" })} />
      <Button label="View active booking" onPress={() => navigation.navigate("TripDetails", { id: active?.id })} />
      <Button label="My vehicles" onPress={() => navigation.navigate("Vehicles")} />
      <Button label="Booking history" onPress={() => navigation.navigate("History")} />
      <Button label="Profile" onPress={() => navigation.navigate("Profile")} />
      {bookings.isLoading ? <Loading /> : null}
      {bookings.isError ? <ErrorText message={errorMessage(bookings.error)} /> : null}
      <Text style={{ marginTop: 16, fontWeight: "600" }}>Recent bookings</Text>
      {recent.length === 0 ? <Empty text="No bookings yet." /> : recent.map((item) => (
        <Button key={item.id} label={`${item.referenceCode} · ${item.status}`} onPress={() => navigation.navigate("BookingDetails", { id: item.id })} />
      ))}
    </Screen>
  );
}

export function VehiclesScreen({ navigation }: NativeStackScreenProps<UserStackParamList, "Vehicles">) {
  const query = useVehicles();
  return (
    <Screen title="My vehicles">
      {query.isLoading ? <Loading /> : null}
      {query.isError ? <ErrorText message={errorMessage(query.error)} /> : null}
      {query.data?.length === 0 ? <Empty text="You have not added a vehicle." /> : null}
      {query.data?.map((vehicle) => <Text key={vehicle.id}>{vehicle.registrationNumber} · {vehicle.brand} {vehicle.model}</Text>)}
      <Button label="Add vehicle" onPress={() => navigation.navigate("AddVehicle")} />
    </Screen>
  );
}

export function AddVehicleScreen({ navigation }: NativeStackScreenProps<UserStackParamList, "AddVehicle">) {
  const create = useCreateVehicle();
  const [registrationNumber, setRegistration] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  return (
    <Screen title="Add vehicle">
      <Field value={registrationNumber} onChangeText={setRegistration} placeholder="Registration number" />
      <Field value={brand} onChangeText={setBrand} placeholder="Brand" />
      <Field value={model} onChangeText={setModel} placeholder="Model" />
      {create.isError ? <ErrorText message={errorMessage(create.error)} /> : null}
      <Button label="Save" disabled={create.isPending} onPress={() => create.mutate({ registrationNumber, vehicleType: "SEDAN", brand, model, transmission: "MANUAL", fuelType: "PETROL" }, { onSuccess: () => navigation.goBack() })} />
    </Screen>
  );
}

export function BookDriverScreen({ route, navigation }: NativeStackScreenProps<UserStackParamList, "BookDriver">) {
  const vehicles = useVehicles();
  const create = useCreateBooking();
  const [vehicleId, setVehicleId] = useState("");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [when, setWhen] = useState("");
  const [fare, setFare] = useState("");
  const [requirements, setRequirements] = useState("");
  return (
    <Screen title={route.params.type === "IMMEDIATE" ? "Book driver now" : "Schedule driver"}>
      {vehicles.data?.map((vehicle) => (
        <Button key={vehicle.id} label={`${vehicleId === vehicle.id ? "Selected: " : ""}${vehicle.registrationNumber}`} onPress={() => setVehicleId(vehicle.id)} />
      ))}
      <Field value={pickup} onChangeText={setPickup} placeholder="Pickup address" />
      <Field value={destination} onChangeText={setDestination} placeholder="Destination address" />
      {route.params.type === "SCHEDULED" ? <Field value={when} onChangeText={setWhen} placeholder="Date and time ISO, 2026-09-25T10:00:00.000Z" /> : null}
      <Field value={fare} onChangeText={setFare} placeholder="Estimated fare in rupees" />
      <Field value={requirements} onChangeText={setRequirements} placeholder="Additional requirements" />
      <Muted text="Requirements are kept on this screen. The booking API does not store that field yet." />
      {create.isError ? <ErrorText message={errorMessage(create.error)} /> : null}
      <Button
        label="Request driver"
        disabled={create.isPending}
        onPress={() => {
          const rupees = Number(fare);
          if (!vehicleId || !Number.isFinite(rupees) || rupees <= 0) {
            return;
          }
          create.mutate(
            {
              vehicleId,
              type: route.params.type,
              scheduledAt: route.params.type === "SCHEDULED" ? when : undefined,
              pickup: { address: pickup, lat: 0, lng: 0 },
              destination: { address: destination, lat: 0, lng: 0 },
              estimatedFareMinor: Math.round(rupees * 100),
            },
            { onSuccess: (booking) => navigation.replace("BookingConfirmation", { id: booking.id }) },
          );
        }}
      />
    </Screen>
  );
}

export function BookingConfirmationScreen({ route, navigation }: NativeStackScreenProps<UserStackParamList, "BookingConfirmation">) {
  const query = useBooking(route.params.id);
  if (query.isLoading) return <Screen title="Confirmation"><Loading /></Screen>;
  if (query.isError || !query.data) return <Screen title="Confirmation"><ErrorText message={errorMessage(query.error)} /></Screen>;
  return (
    <Screen title="Booking confirmed">
      <Text>{query.data.referenceCode}</Text>
      <Text>{formatMoney(query.data.estimatedFareMinor, query.data.currency)}</Text>
      <Button label="Continue" onPress={() => navigation.replace("Searching", { id: query.data.id })} />
    </Screen>
  );
}

function BookingStatusScreen({ id, title, next }: { id: string; title: string; next?: (status: string) => void }) {
  const query = useBooking(id);
  if (query.isLoading) return <Screen title={title}><Loading /></Screen>;
  if (query.isError || !query.data) return <Screen title={title}><ErrorText message={errorMessage(query.error)} /></Screen>;
  const booking = query.data;
  return (
    <Screen title={title}>
      <Text>{booking.referenceCode} · {booking.status}</Text>
      <Text>Pickup: {booking.pickup.address}</Text>
      <Text>Destination: {booking.destination.address}</Text>
      <Text>Driver: {booking.driver?.fullName ?? "Not assigned"}</Text>
      {next ? <Button label="Refresh view" onPress={() => next(booking.status)} /> : null}
    </Screen>
  );
}

export function SearchingScreen({ route, navigation }: NativeStackScreenProps<UserStackParamList, "Searching">) {
  return <BookingStatusScreen id={route.params.id} title="Searching for a driver" next={(status) => { if (status !== "SEARCHING_DRIVER" && status !== "PENDING") navigation.replace("Assigned", { id: route.params.id }); }} />;
}

export function AssignedScreen({ route, navigation }: NativeStackScreenProps<UserStackParamList, "Assigned">) {
  return <BookingStatusScreen id={route.params.id} title="Driver assigned" next={() => navigation.navigate("Tracking", { id: route.params.id })} />;
}

export function TrackingScreen({ route }: NativeStackScreenProps<UserStackParamList, "Tracking">) {
  const booking = useBooking(route.params.id);
  const trackable = Boolean(booking.data && ["DRIVER_ON_THE_WAY", "DRIVER_ARRIVED", "TRIP_STARTED"].includes(booking.data.status));
  const location = useBookingLocation(route.params.id, trackable);
  return (
    <Screen title="Driver tracking">
      {booking.isLoading ? <Loading /> : null}
      {location.data ? <Text>{location.data.lat}, {location.data.lng}</Text> : <Empty text="Location is shown only while the driver is on the way or the trip is active." />}
      {location.isError ? <ErrorText message={errorMessage(location.error)} /> : null}
    </Screen>
  );
}

export function TripDetailsScreen({ route, navigation }: NativeStackScreenProps<UserStackParamList, "TripDetails">) {
  const id = route.params.id;
  if (!id) return <Screen title="Trip details"><Empty text="There is no active booking." /></Screen>;
  return <BookingStatusScreen id={id} title="Trip details" next={() => navigation.navigate("Payment", { id })} />;
}

export function PaymentScreen({ route, navigation }: NativeStackScreenProps<UserStackParamList, "Payment">) {
  const booking = useBooking(route.params.id);
  const platform = useStartPlatformPayment();
  const direct = useDeclareDirectPayment();
  const [error, setError] = useState<string | null>(null);
  const pay = (mode: "platform" | "direct") => {
    const request = mode === "platform" ? platform.mutateAsync({ bookingId: route.params.id, idempotencyKey: idempotencyKey() }) : direct.mutateAsync({ bookingId: route.params.id, idempotencyKey: idempotencyKey() });
    void request
      .then(async (payment) => {
        if (payment.checkoutUrl) {
          await Linking.openURL(payment.checkoutUrl);
        }
        navigation.replace("PaymentConfirmation", { id: payment.id });
      })
      .catch((caught) => setError(errorMessage(caught)));
  };
  return (
    <Screen title="Payment">
      {booking.data ? <Text>Fare {formatMoney(booking.data.estimatedFareMinor, booking.data.currency)}. Fee {formatMoney(booking.data.platformFeeMinor, booking.data.currency)}.</Text> : null}
      {error ? <ErrorText message={error} /> : null}
      <Button label="Pay with UPI or QR" onPress={() => pay("platform")} />
      <Button label="Pay driver directly by UPI" onPress={() => pay("direct")} />
      <Muted text="Platform payment opens PhonePe checkout. On a phone that is UPI intent. On a larger screen PhonePe shows a QR code." />
    </Screen>
  );
}

export function PaymentConfirmationScreen({ route }: NativeStackScreenProps<UserStackParamList, "PaymentConfirmation">) {
  const payment = usePayment(route.params.id);
  return (
    <Screen title="Payment confirmation">
      {payment.isError ? <ErrorText message={errorMessage(payment.error)} /> : null}
      {payment.data ? <Text>{payment.data.status} · {payment.data.rail} · {formatMoney(payment.data.amountMinor, payment.data.currency)}</Text> : <Loading />}
    </Screen>
  );
}

export function HistoryScreen({ navigation }: NativeStackScreenProps<UserStackParamList, "History">) {
  const query = useBookings();
  return (
    <Screen title="Booking history">
      {query.isLoading ? <Loading /> : null}
      {query.isError ? <ErrorText message={errorMessage(query.error)} /> : null}
      {query.data?.items.length === 0 ? <Empty text="No bookings yet." /> : null}
      {query.data?.items.map((item) => <Button key={item.id} label={`${item.referenceCode} · ${item.status}`} onPress={() => navigation.navigate("BookingDetails", { id: item.id })} />)}
    </Screen>
  );
}

export function BookingDetailsScreen({ route, navigation }: NativeStackScreenProps<UserStackParamList, "BookingDetails">) {
  const cancel = useCancelBooking();
  return (
    <Screen title="Booking details">
      <BookingStatusScreen id={route.params.id} title="Details" />
      {cancel.isError ? <ErrorText message={errorMessage(cancel.error)} /> : null}
      <Button label="Cancel booking" onPress={() => cancel.mutate({ id: route.params.id, reason: "Cancelled by customer" })} />
      <Button label="Rate driver" onPress={() => navigation.navigate("Rating", { id: route.params.id })} />
      <Button label="Complaint" onPress={() => navigation.navigate("Complaint", { bookingId: route.params.id })} />
    </Screen>
  );
}

export function RatingScreen({ route }: NativeStackScreenProps<UserStackParamList, "Rating">) {
  const rating = useCreateRating();
  return (
    <Screen title="Rating">
      {rating.isSuccess ? <Text>Rating submitted.</Text> : null}
      {rating.isError ? <ErrorText message={errorMessage(rating.error)} /> : null}
      <Button label="Submit 5 stars" onPress={() => rating.mutate({ bookingId: route.params.id, score: 5 })} />
    </Screen>
  );
}

export function ComplaintScreen({ route }: NativeStackScreenProps<UserStackParamList, "Complaint">) {
  const complaint = useCreateComplaint();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  return (
    <Screen title="Complaint">
      <Field value={subject} onChangeText={setSubject} placeholder="Subject" />
      <Field value={body} onChangeText={setBody} placeholder="What happened" />
      {complaint.isError ? <ErrorText message={errorMessage(complaint.error)} /> : null}
      <Button label="Submit" onPress={() => complaint.mutate({ bookingId: route.params.bookingId, subject, body })} />
    </Screen>
  );
}

export function NotificationsScreen() {
  const query = useNotifications();
  return (
    <Screen title="Notifications">
      {query.isLoading ? <Loading /> : null}
      {query.isError ? <ErrorText message={errorMessage(query.error)} /> : null}
      {query.data?.items.length === 0 ? <Empty text="No notifications." /> : null}
      {query.data?.items.map((item) => <Text key={item.id}>{item.title}</Text>)}
    </Screen>
  );
}

export function ProfileScreen() {
  const query = useMe();
  const update = useUpdateMe();
  const [city, setCity] = useState("");
  return (
    <Screen title="Profile">
      {query.isLoading ? <Loading /> : null}
      {query.data ? <Text>{query.data.fullName} · {query.data.phone}</Text> : null}
      <Field value={city} onChangeText={setCity} placeholder="City" />
      {update.isError ? <ErrorText message={errorMessage(update.error)} /> : null}
      <Button label="Save city" onPress={() => update.mutate({ city })} />
    </Screen>
  );
}

export function SettingsScreen() {
  const { logout } = useAuth();
  return (
    <Screen title="Settings">
      <Muted text="Push delivery is prepared through a provider interface and is not connected to a Firebase project yet." />
      <Button label="Sign out" onPress={() => void logout()} />
    </Screen>
  );
}
