import type { Metadata } from "next";
import AccountView from "@/components/AccountView";

export const metadata: Metadata = {
  title: "Akun - ComfyAir",
  description:
    "Autentikasi pengguna, profil preferensi AC, serta informasi jaringan, cloud, dan model machine learning ComfyAir.",
};

export default function AkunPage() {
  return <AccountView />;
}
