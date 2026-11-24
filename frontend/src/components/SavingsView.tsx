"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AC_POWER_OPTIONS,
  MODE_LABEL,
  PERIODS,
  formatKwh,
  formatPercent,
  formatRupiah,
  monthlyBill,
  type PeriodId,
} from "@/lib/comfort";
import {
  createSavingsLog,
  deleteSavingsLog,
  fetchSavingsLogs,
  savePreferences,
  type SavingsLogItem,
} from "@/lib/api";
import { kwToPk, useComfortDispatch, useComfortState } from "./ComfortProvider";
import { useRecommendation } from "./useRecommendation";
import styles from "./SavingsView.module.css";

export default function SavingsView() {
  const { city, controls, auth } = useComfortState();
  const dispatch = useComfortDispatch();
  const { rec } = useRecommendation(
    controls.outdoorTemp,
    controls.humidity,
    controls.mode,
    controls.acPowerKw,
    auth.accessToken,
  );

  const [period, setPeriod] = useState<PeriodId>("monthly");
  const [tariffDraft, setTariffDraft] = useState<string | null>(null);
  const [hoursDraft, setHoursDraft] = useState<string | null>(null);
  const [logs, setLogs] = useState<SavingsLogItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activePeriod = PERIODS.find((p) => p.id === period) ?? PERIODS[2];
  const bill = monthlyBill(
    rec.savingsPercent,
    activePeriod.nights,
    controls.acPowerKw,
    controls.tariffPerKwh,
    controls.hoursPerNight,
  );

  const tariffValue = tariffDraft ?? String(controls.tariffPerKwh);
  const hoursValue = hoursDraft ?? String(controls.hoursPerNight);

  useEffect(() => {
    const token = auth.accessToken;
    if (!token) return;
    let active = true;
    fetchSavingsLogs(token, period)
      .then((rows) => {
        if (active) setLogs(rows);
      })
      .catch(() => {
        if (active) setLogs([]);
      });
    return () => {
      active = false;
    };
  }, [auth.accessToken, period]);

  async function handleSavePreferences() {
    if (!auth.accessToken) return;
    setBusy(true);
    setNotice(null);
    try {
      await savePreferences(auth.accessToken, {
        ac_power_pk: kwToPk(controls.acPowerKw),
        electricity_rate_per_kwh: controls.tariffPerKwh,
        preferred_city: city,
      });
      setNotice("Pengaturan AC disimpan ke akun");
    } catch {
      setNotice("Gagal menyimpan pengaturan");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogSavings() {
    if (!auth.accessToken) return;
    setBusy(true);
    setNotice(null);
    try {
      await createSavingsLog(auth.accessToken, {
        nights: activePeriod.nights,
        hours_per_night: controls.hoursPerNight,
        ac_power_pk: kwToPk(controls.acPowerKw),
        electricity_rate_per_kwh: controls.tariffPerKwh,
        setpoint: rec.setpoint,
      });
      const updated = await fetchSavingsLogs(auth.accessToken, period);
      setLogs(updated);
      setNotice("Penghematan dicatat ke riwayat");
    } catch {
      setNotice("Gagal mencatat penghematan");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteLog(logId: string) {
    if (!auth.accessToken) return;
    try {
      await deleteSavingsLog(auth.accessToken, logId);
      setLogs((prev) => prev.filter((item) => item.log_id !== logId));
    } catch {
      setNotice("Gagal menghapus catatan");
    }
  }

  return (
    <main id="main-content" className={styles.main}>
      <div className="container">
        <div className={styles.topRow}>
          <h1 className={styles.heading}>Estimasi Penghematan Listrik</h1>

          <div role="radiogroup" aria-label="Periode" className={styles.periodSegmented}>
            {PERIODS.map((p) => (
              <label
                key={p.id}
                className={styles.periodOption}
                data-checked={p.id === period ? "" : undefined}
              >
                <input
                  type="radio"
                  name="savings-period"
                  value={p.id}
                  checked={p.id === period}
                  onChange={() => setPeriod(p.id)}
                  className={styles.radioInput}
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        <p className={styles.desc}>
          Perkiraan biaya listrik AC selama {activePeriod.nights} malam ({controls.hoursPerNight} jam
          per malam) dibandingkan kebiasaan suhu konstan 20°C. Setiap kenaikan 1°C di atas 20°C
          diperkirakan menghemat kerja kompresor sekitar 6,5%.
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
                  onChange={(e) => {
                    dispatch({ type: "acPower/set", value: Number(e.target.value) });
                    setNotice(null);
                  }}
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
                  Tarif (Rp/kWh)
                </label>
                <input
                  id="ac-tariff"
                  className={styles.fieldControl}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="any"
                  value={tariffValue}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setTariffDraft(raw);
                    setNotice(null);
                    const parsed = Number(raw);
                    if (raw.trim() !== "" && Number.isFinite(parsed) && parsed > 0) {
                      dispatch({ type: "tariff/set", value: parsed });
                    }
                  }}
                  onBlur={() => setTariffDraft(null)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="ac-hours" className={styles.fieldLabel}>
                  Jam / malam
                </label>
                <input
                  id="ac-hours"
                  className={styles.fieldControl}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={24}
                  step={1}
                  value={hoursValue}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setHoursDraft(raw);
                    setNotice(null);
                    const parsed = Number(raw);
                    if (raw.trim() !== "" && Number.isFinite(parsed) && parsed >= 1 && parsed <= 24) {
                      dispatch({ type: "hours/set", value: Math.round(parsed) });
                    }
                  }}
                  onBlur={() => setHoursDraft(null)}
                />
              </div>
            </div>

            <p className={styles.baselineSummary}>
              Konsumsi dasar 20°C: {formatKwh(bill.baselineKwh)} ({activePeriod.label.toLowerCase()})
            </p>

            {auth.status === "authenticated" ? (
              <div className={styles.actionRow}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={busy}
                  onClick={handleLogSavings}
                >
                  Catat penghematan
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={busy}
                  onClick={handleSavePreferences}
                >
                  Simpan pengaturan
                </button>
                {notice ? <span className={styles.notice}>{notice}</span> : null}
              </div>
            ) : (
              <p className={styles.guestPrompt}>
                <Link href="/akun" className={styles.guestLink}>
                  Masuk di halaman Akun
                </Link>{" "}
                untuk menyimpan pengaturan dan riwayat penghematan.
              </p>
            )}
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
                <span className={styles.totalLabel}>
                  Hemat ({activePeriod.label.toLowerCase()})
                </span>
                <span className={styles.totalPct}>{formatPercent(rec.savingsPercent)}</span>
              </dt>
              <dd className={styles.totalValue}>{formatRupiah(bill.savedRp)}</dd>
            </div>
          </dl>
        </div>

        {auth.status === "authenticated" ? (
          <section aria-labelledby="history-heading" className={styles.historySection}>
            <h2 id="history-heading" className={styles.historyTitle}>
              Riwayat Penghematan
            </h2>

            {logs.length === 0 ? (
              <p className={styles.emptyText}>
                Belum ada catatan penghematan untuk periode ini.
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Tanggal</th>
                      <th scope="col">Dasar 20°C</th>
                      <th scope="col">Optimal</th>
                      <th scope="col">Penghematan</th>
                      <th scope="col">
                        <span className="visually-hidden">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((row) => (
                      <tr key={row.log_id}>
                        <td>{row.log_date}</td>
                        <td>{formatKwh(row.estimated_kwh_baseline)}</td>
                        <td>{formatKwh(row.estimated_kwh_optimized)}</td>
                        <td className={styles.savedCell}>{formatRupiah(row.saved_cost_idr)}</td>
                        <td className={styles.actionCell}>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteLog(row.log_id)}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
