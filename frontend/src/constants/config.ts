export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Admin Panel",
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
  pagination: {
    defaultPage: 1,
    defaultLimit: 10,
    limitOptions: [10, 25, 50, 100],
  },
  tokenKey: "accessToken",
} as const;
