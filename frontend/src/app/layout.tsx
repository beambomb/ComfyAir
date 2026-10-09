import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ComfortProvider } from "@/components/ComfortProvider";
import Taskbar from "@/components/Taskbar";
import "./globals.css";

// Headlines: Fraunces with the SOFT and optical-size axes (variable font, no weight list).
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
  variable: "--font-display",
  display: "swap",
});

// Body text.
const text = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
});

// Data, labels, receipt. Not a variable font, so weights are listed.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ComfyAir · Suhu AC yang pas sepanjang malam",
    template: "%s",
  },
  description:
    "ComfyAir membaca cuaca di luar, menyarankan setpoint AC, mengatur kurva suhu tidur, dan menghitung perkiraan hemat listrik dalam Rupiah. Tanpa alat tambahan.",
};

export const viewport: Viewport = {
  themeColor: "#F3EEE5",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${text.variable} ${mono.variable}`}
    >
      <body>
        <ComfortProvider>
          <Taskbar />
          {children}
        </ComfortProvider>
      </body>
    </html>
  );
}
