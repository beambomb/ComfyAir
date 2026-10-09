import type { Metadata } from "next";
import ComfortExperience from "@/components/ComfortExperience";
import SleepCurve from "@/components/SleepCurve";
import HowItWorks from "@/components/HowItWorks";
import Colophon from "@/components/Colophon";
import SectionNav from "@/components/SectionNav";

export const metadata: Metadata = {
  title: "ComfyAir · Presentasi",
  description:
    "Presentasi lengkap ComfyAir: simulasi setpoint AC dari cuaca live, kurva suhu tidur, dan perkiraan hemat listrik dalam Rupiah.",
};

export default function Presentasi() {
  return (
    <>
      <a className="skip-link" href="#simulasi">
        Langsung ke simulasi
      </a>
      <SectionNav />
      <main id="isi">
        <ComfortExperience />
        <SleepCurve />
        <HowItWorks />
      </main>
      <Colophon />
    </>
  );
}
