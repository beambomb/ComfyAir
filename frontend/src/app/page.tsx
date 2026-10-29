import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "ComfyAir · Dasbor",
  description:
    "Dasbor ComfyAir: setpoint AC dari cuaca luar, grafik suhu malam, dan perkiraan hemat listrik sesuai spesifikasi AC-mu.",
};

export default function Home() {
  return <Dashboard />;
}
