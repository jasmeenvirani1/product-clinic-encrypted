import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import { ReduxProvider } from "@/providers/ReduxProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AntdProvider } from "@/providers/AntdProvider";
import { APP_FULL_NAME, APP_TAGLINE } from "@/constants/brand";
import { THEME_PRELOAD_SCRIPT } from "@/utils/themePreload";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_FULL_NAME,
  description: APP_TAGLINE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${dmSans.variable}`}>
      <head>
        {/* Applies the cached theme synchronously before first paint to prevent
            the default theme flashing while ThemeProvider fetches the real one. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_PRELOAD_SCRIPT }} />
      </head>
      <body className="font-body">
        <ReduxProvider>
          <ThemeProvider>
            <AntdProvider>{children}</AntdProvider>
          </ThemeProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
