import type { Metadata } from "next";
import GraphView from "@/components/GraphView";

export const metadata: Metadata = {
  title: "Grafik - ComfyAir",
  description:
    "Kurva suhu tidur ComfyAir dibandingkan prakiraan suhu luar Yogyakarta pukul 21.00 sampai 07.00 WIB.",
};

export default function GrafikPage() {
  return <GraphView />;
}
