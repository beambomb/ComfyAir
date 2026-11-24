import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "ComfyAir",
  description:
    "Pengaturan suhu AC adaptif berdasarkan cuaca Yogyakarta dan estimasi penghematan listrik bulanan.",
};

export default function Home() {
  return <Dashboard />;
}
