import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "ComfyAir · Dasbor",
  description:
    "Dasbor ComfyAir: setpoint AC malam ini, cuaca luar, kurva tidur, dan perkiraan hemat listrik dalam satu lembar.",
};

export default function Home() {
  return <Dashboard />;
}
