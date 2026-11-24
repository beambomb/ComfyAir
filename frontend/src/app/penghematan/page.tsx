import type { Metadata } from "next";
import SavingsView from "@/components/SavingsView";

export const metadata: Metadata = {
  title: "Penghematan - ComfyAir",
  description:
    "Estimasi penghematan biaya listrik bulanan ComfyAir berdasarkan daya AC dan tarif listrik.",
};

export default function PenghematanPage() {
  return <SavingsView />;
}
