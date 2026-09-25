export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiFailure = {
  success: false;
  message: string;
  errors: { field?: string; message: string; code?: string }[];
};

export type Account = {
  id: string;
  role: "ADMIN" | "DRIVER" | "USER";
  phone: string;
  email: string | null;
  fullName: string;
  status: string;
};
