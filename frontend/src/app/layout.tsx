import type { Metadata, Viewport } from "next";
import { Barlow } from "next/font/google";
import { ComfortProvider } from "@/components/ComfortProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ComfyAir",
    template: "%s",
  },
  description:
    "Pengaturan suhu AC adaptif berbasis machine learning dan estimasi penghematan listrik bulanan.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={barlow.variable}>
      <body>
        <ComfortProvider>
          <a className="skip-link" href="#main-content">
            Langsung ke konten utama
          </a>
          <Header />
          {children}
          <Footer />
        </ComfortProvider>
      </body>
    </html>
  );
}
