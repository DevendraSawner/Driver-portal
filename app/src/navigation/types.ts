export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Otp: { phone: string; purpose: "REGISTER" | "PASSWORD_RESET" };
};

export type UserStackParamList = {
  Home: undefined;
  Vehicles: undefined;
  AddVehicle: undefined;
  BookDriver: { type: "IMMEDIATE" | "SCHEDULED" };
  BookingConfirmation: { id: string };
  Searching: { id: string };
  Assigned: { id: string };
  Tracking: { id: string };
  TripDetails: { id?: string };
  Payment: { id: string };
  PaymentConfirmation: { id: string };
  History: undefined;
  BookingDetails: { id: string };
  Rating: { id: string };
  Complaint: { bookingId?: string };
  Notifications: undefined;
  Profile: undefined;
  Settings: undefined;
};

export type DriverStackParamList = {
  Onboarding: undefined;
  Kyc: undefined;
  KycStatus: undefined;
  Home: undefined;
  Requests: undefined;
  RequestDetails: { id: string };
  Navigation: { id: string };
  Arrived: { id: string };
  StartTrip: { id: string };
  ActiveTrip: { id: string };
  CompleteTrip: { id: string };
  PaymentConfirmation: undefined;
  Earnings: undefined;
  Wallet: undefined;
  Fees: undefined;
  Settlements: undefined;
  Transactions: undefined;
  Ratings: undefined;
  Notifications: undefined;
  Profile: undefined;
  Settings: undefined;
};
