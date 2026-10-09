"use client";

import { formatRupiah, formatTariff, MODE_LABEL, monthlyBill } from "@/lib/comfort";
import { useComfortDispatch, useComfortState, type WeatherState } from "./ComfortProvider";
import { useRecommendation, type ApiLink } from "./useRecommendation";
import SentenceForm from "./SentenceForm";
import Remote from "./Remote";
import Receipt from "./Receipt";
import styles from "./ComfortExperience.module.css";

function weatherSource(weather: WeatherState, touched: boolean): string {
  if (touched) {
    const own = "Sumber cuaca: angka kamu sendiri";
    return weather.status === "live"
      ? `${own} · live ${Math.round(weather.temp)}°C, ${Math.round(weather.humidity)}%`
      : own;
  }
  switch (weather.status) {
    case "loading":
      return "Sumber cuaca: sedang dibaca dari Open-Meteo…";
    case "live":
      return `Sumber cuaca: live dari Open-Meteo, pukul ${weather.observedAt} WIB`;
    case "sample":
      return "Sumber cuaca: angka contoh. Data live tidak terjangkau.";
  }
}

const API_STATUS: Record<ApiLink, string> = {
  unknown: "Menghubungi API ComfyAir…",
  online: "API ComfyAir terhubung",
  offline: "Offline · rumus adaptif ASHRAE 55, dihitung di browser",
};

export default function ComfortExperience() {
  const { weather, controls } = useComfortState();
  const dispatch = useComfortDispatch();
  const { rec, link } = useRecommendation(controls.outdoorTemp, controls.humidity, controls.mode);
  const bill = monthlyBill(rec.savingsPercent);

  const announcement = controls.power
    ? `Setpoint disarankan ${rec.setpoint} derajat Celsius, mode ${MODE_LABEL[controls.mode]}. Perkiraan hemat ${formatRupiah(bill.savedRp)} per bulan.`
    : "AC dimatikan.";

  return (
    <>
      <section id="simulasi" aria-labelledby="judul-simulasi" tabIndex={-1} className={styles.hero}>
        <div className={`wrap ${styles.heroGrid}`}>
          <div className={styles.copy}>
            <p className={`label ${styles.eyebrow}`}>Simulasi setpoint AC</p>
            <h1 id="judul-simulasi" className={`headline ${styles.title}`}>
              Suhu yang pas, sepanjang <em>malam</em>.
            </h1>
            <p className={styles.lede}>
              ComfyAir membaca cuaca di luar, lalu menyarankan satu angka untuk remote AC-mu. Tanpa
              alat tambahan. Tanpa terbangun jam tiga pagi karena kedinginan.
            </p>

            <SentenceForm
              outdoorTemp={controls.outdoorTemp}
              humidity={controls.humidity}
              mode={controls.mode}
              onTempStep={(delta) => dispatch({ type: "temp/step", delta })}
              onHumidityStep={(delta) => dispatch({ type: "humidity/step", delta })}
              onModeChange={(mode) => dispatch({ type: "mode/set", mode })}
            />

            <p className={styles.hint}>Ubah angkanya. Remote-nya ikut menyesuaikan.</p>
            <p className={styles.source}>{weatherSource(weather, controls.touched)}</p>
          </div>

          <div className={styles.device}>
            <div className={styles.stage}>
              <p className={styles.note}>
                <span className={styles.noteText}>angka ini yang kamu set</span>
                <svg
                  className={styles.arrow}
                  viewBox="0 0 110 64"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M9 5 C 10 30, 38 50, 99 44.5" />
                  <path d="M89 38.6 Q 94.5 41.6, 100 44.6 Q 94.8 48.4, 90.6 51.6" />
                </svg>
              </p>
              <Remote
                setpoint={rec.setpoint}
                source={rec.source}
                mode={controls.mode}
                power={controls.power}
                outdoorTemp={controls.outdoorTemp}
                humidity={controls.humidity}
                onModeCycle={() => dispatch({ type: "mode/cycle" })}
                onPowerToggle={() => dispatch({ type: "power/toggle" })}
              />
            </div>
            <p className={styles.api} data-link={link}>
              <span className={styles.marker} aria-hidden="true" />
              {API_STATUS[link]}
            </p>
          </div>
        </div>

        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </section>

      <section id="hemat" aria-labelledby="judul-hemat" className={styles.savings}>
        <div className={`wrap ${styles.savingsGrid}`}>
          <div className={styles.savingsCopy}>
            <p className={`label ${styles.eyebrow}`}>Hitungan per bulan</p>
            <h2 id="judul-hemat" className={`headline ${styles.heading}`}>
              Satu derajat, terasa di <em>tagihan</em>.
            </h2>
            <p className={styles.body}>
              Setiap 1°C di atas kebiasaan 20°C, kompresor kerja lebih santai. Model ComfyAir
              menghitungnya sekitar 6,5% per derajat. Struknya ikut berubah setiap kamu
              mengutak-atik remote.
            </p>

            <div className={styles.pull}>
              <p className={styles.pullNumber}>6,5%</p>
              <p className={styles.pullCaption}>lebih hemat per 1°C, dibanding AC di 20°C</p>
            </div>

            <p className={`label ${styles.assumptionsTitle}`}>Asumsi hitungan</p>
            <dl className={styles.assumptions}>
              <div>
                <dt>Daya AC</dt>
                <dd>1 PK, kira-kira 800 W</dd>
              </div>
              <div>
                <dt>Pemakaian</dt>
                <dd>8 jam per malam, 30 malam</dd>
              </div>
              <div>
                <dt>Tarif listrik</dt>
                <dd>{formatTariff()} per kWh</dd>
              </div>
              <div>
                <dt>Patokan</dt>
                <dd>AC di 20°C</dd>
              </div>
            </dl>
            <p className={styles.footnote}>
              Ini simulasi, bukan tagihan PLN. Angka aslinya tergantung AC, ruangan, dan
              kebiasaanmu.
            </p>
          </div>

          <div className={styles.receiptColumn}>
            <Receipt rec={rec} />
          </div>
        </div>
      </section>
    </>
  );
}
