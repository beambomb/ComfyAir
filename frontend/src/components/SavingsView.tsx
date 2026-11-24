"use client";

import { useState } from "react";
import {
  AC_POWER_OPTIONS,
  MODE_LABEL,
  formatKwh,
  formatPercent,
  formatRupiah,
  monthlyBill,
} from "@/lib/comfort";
import { useComfortDispatch, useComfortState } from "./ComfortProvider";
import { useRecommendation } from "./useRecommendation";
import styles from "./SavingsView.module.css";

export default function SavingsView() {
  const { controls } = useComfortState();
  const dispatch = useComfortDispatch();
  const { rec } = useRecommendation(controls.outdoorTemp, controls.humidity, controls.mode);
  const bill = monthlyBill(rec.savingsPercent, 30, controls.acPowerKw, controls.tariffPerKwh);

  const [tariffInput, setTariffInput] = useState(() => String(controls.tariffPerKwh));

  return (
    <main id="main-content" className={styles.main}>
      <div className="container">
        <h1 className={styles.heading}>Estimasi Penghematan Listrik</h1>

        <p className={styles.desc}>
          Perkiraan biaya listrik AC selama 30 malam (asumsi 8 jam per malam) dibandingkan kebiasaan
          suhu konstan 20°C. Setiap kenaikan 1°C di atas 20°C diperkirakan menghemat kerja kompresor
          sekitar 6,5%.
        </p>

        <div className={styles.savingsGrid}>
          <div className={styles.configCol}>
            <div className={styles.formFields}>
              <div className={styles.fieldGroup}>
                <label htmlFor="ac-power" className={styles.fieldLabel}>
                  Daya AC
                </label>
                <select
                  id="ac-power"
                  className={styles.fieldControl}
                  value={controls.acPowerKw}
                  onChange={(e) =>
                    dispatch({ type: "acPower/set", value: Number(e.target.value) })
                  }
                >
                  {AC_POWER_OPTIONS.map((o) => (
                    <option key={o.kw} value={o.kw}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="ac-tariff" className={styles.fieldLabel}>
                  Tarif listrik (Rp/kWh)
                </label>
                <input
                  id="ac-tariff"
                  className={styles.fieldControl}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="any"
                  value={tariffInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setTariffInput(raw);
                    const parsed = Number(raw);
                    if (raw.trim() !== "" && Number.isFinite(parsed) && parsed > 0) {
                      dispatch({ type: "tariff/set", value: parsed });
                    }
                  }}
                  onBlur={() => {
                    const parsed = Number(tariffInput);
                    if (tariffInput.trim() === "" || !Number.isFinite(parsed) || parsed <= 0) {
                      setTariffInput(String(controls.tariffPerKwh));
                    }
                  }}
                />
              </div>
            </div>

            <p className={styles.baselineSummary}>
              Konsumsi dasar 20°C: {formatKwh(bill.baselineKwh)} per bulan
            </p>
          </div>

          <dl className={styles.costList}>
            <div className={styles.costRow}>
              <dt>Biaya di 20°C</dt>
              <dd>{formatRupiah(bill.baselineRp)}</dd>
            </div>
            <div className={styles.costRow}>
              <dt>
                Biaya di {rec.setpoint}°C (Mode {MODE_LABEL[controls.mode]})
              </dt>
              <dd>{formatRupiah(bill.optimizedRp)}</dd>
            </div>
            <div className={`${styles.costRow} ${styles.totalRow}`}>
              <dt>
                <span className={styles.totalLabel}>Hemat per bulan</span>
                <span className={styles.totalPct}>{formatPercent(rec.savingsPercent)}</span>
              </dt>
              <dd className={styles.totalValue}>{formatRupiah(bill.savedRp)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </main>
  );
}
