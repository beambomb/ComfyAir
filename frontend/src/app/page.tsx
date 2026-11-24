import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "ComfyAir",
  description:
    "Dasbor ComfyAir untuk rekomendasi suhu AC berbasis machine learning dari cuaca real-time.",
};

export default function Home() {
  return <Dashboard />;
}
