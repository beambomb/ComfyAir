"use client";

import { useEffect, useState } from "react";
import {
  fetchComfortFeedback,
  fetchHealth,
  fetchModelInfo,
  fetchPreferences,
  loginUser,
  logoutUser,
  registerUser,
  type ComfortFeedbackSummary,
  type HealthInfo,
  type ModelInfo,
} from "@/lib/api";
import { formatRupiah } from "@/lib/comfort";
import {
  AUTH_STORAGE_KEY,
  kwToPk,
  pkToKw,
  useComfortDispatch,
  useComfortState,
} from "./ComfortProvider";
import styles from "./AccountView.module.css";

export default function AccountView() {
  const { city, controls, auth, wsConnected, feedbackVersion } = useComfortState();
  const dispatch = useComfortDispatch();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [feedback, setFeedback] = useState<ComfortFeedbackSummary | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((h) => {
        if (!controller.signal.aborted) {
          setHealth(h);
          setBackendOffline(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setBackendOffline(true);
      });

    fetchModelInfo(controller.signal)
      .then((m) => {
        if (!controller.signal.aborted) setModelInfo(m);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;
    fetchComfortFeedback(auth.accessToken)
      .then((fb) => {
        if (active) setFeedback(fb);
      })
      .catch(() => {
        if (active) setFeedback(null);
      });
    return () => {
      active = false;
    };
  }, [auth.accessToken, feedbackVersion]);

  async function completeLogin(
    accessToken: string,
    refreshToken: string,
    user: NonNullable<typeof auth.user>,
  ) {
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ accessToken, refreshToken }),
    );
    dispatch({ type: "auth/login", user, accessToken, refreshToken });

    const pref = await fetchPreferences(accessToken).catch(() => null);
    if (pref) {
      dispatch({ type: "acPower/set", value: pkToKw(pref.ac_power_pk) });
      dispatch({ type: "tariff/set", value: pref.electricity_rate_per_kwh });
      if (pref.preferred_city) dispatch({ type: "city/set", city: pref.preferred_city });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res =
        mode === "login"
          ? await loginUser(email, password)
          : await registerUser(name, email, password);
      await completeLogin(res.access_token, res.refresh_token, res.user);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Autentikasi gagal");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setMode("login");
    setEmail("demo@comfyair.id");
    setPassword("comfyair123");
    setError(null);
    setSubmitting(true);
    try {
      const res = await loginUser("demo@comfyair.id", "comfyair123");
      await completeLogin(res.access_token, res.refresh_token, res.user);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal terhubung ke server autentikasi");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await logoutUser(auth.refreshToken);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    dispatch({ type: "auth/logout" });
  }

  const calibrationText =
    feedback && feedback.feedback_count > 0
      ? `${feedback.personal_bias_c > 0 ? "+" : ""}${feedback.personal_bias_c}°C (${feedback.feedback_count} respon)`
      : "Default";

  return (
    <main id="main-content" className={styles.main}>
      <div className="container">
        <section aria-labelledby="account-heading" className={styles.accountSection}>
          <div className={styles.sectionHeader}>
            <h1 id="account-heading" className={styles.heading}>
              Akun
            </h1>
            {auth.status === "authenticated" ? (
              <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
                Keluar
              </button>
            ) : null}
          </div>

          {auth.status === "authenticated" && auth.user ? (
            <dl className={styles.profileList}>
              <div className={styles.profileRow}>
                <dt>Nama</dt>
                <dd>{auth.user.name}</dd>
              </div>
              <div className={styles.profileRow}>
                <dt>Email</dt>
                <dd>{auth.user.email}</dd>
              </div>
              <div className={styles.profileRow}>
                <dt>Kota</dt>
                <dd>{city}</dd>
              </div>
              <div className={styles.profileRow}>
                <dt>Daya AC</dt>
                <dd>{kwToPk(controls.acPowerKw)} PK</dd>
              </div>
              <div className={styles.profileRow}>
                <dt>Tarif listrik</dt>
                <dd>{formatRupiah(controls.tariffPerKwh)}/kWh</dd>
              </div>
            </dl>
          ) : (
            <div className={styles.authWrap}>
              <div role="radiogroup" aria-label="Mode akun" className={styles.authToggle}>
                <label className={styles.toggleOpt} data-checked={mode === "login" ? "" : undefined}>
                  <input
                    type="radio"
                    name="auth-mode"
                    checked={mode === "login"}
                    onChange={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className={styles.radioInput}
                  />
                  Masuk
                </label>
                <label
                  className={styles.toggleOpt}
                  data-checked={mode === "register" ? "" : undefined}
                >
                  <input
                    type="radio"
                    name="auth-mode"
                    checked={mode === "register"}
                    onChange={() => {
                      setMode("register");
                      setError(null);
                    }}
                    className={styles.radioInput}
                  />
                  Daftar
                </label>
              </div>

              <form onSubmit={handleSubmit} className={styles.authForm}>
                {mode === "register" ? (
                  <div className={styles.fieldGroup}>
                    <label htmlFor="auth-name" className={styles.fieldLabel}>
                      Nama
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={styles.fieldControl}
                      placeholder="Nama lengkap"
                    />
                  </div>
                ) : null}

                <div className={styles.fieldGroup}>
                  <label htmlFor="auth-email" className={styles.fieldLabel}>
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={styles.fieldControl}
                    placeholder="nama@contoh.id"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="auth-password" className={styles.fieldLabel}>
                    Kata sandi
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.fieldControl}
                    placeholder="Minimal 6 karakter"
                  />
                </div>

                {error ? <p className={styles.errorText}>{error}</p> : null}

                <div className={styles.formActions}>
                  <button type="submit" className={styles.submitBtn} disabled={submitting}>
                    {submitting ? "Memproses" : mode === "login" ? "Masuk" : "Daftar"}
                  </button>
                  <button
                    type="button"
                    className={styles.demoBtn}
                    disabled={submitting}
                    onClick={handleDemoLogin}
                  >
                    Gunakan akun demo
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

        <section aria-labelledby="system-heading" className={styles.systemSection}>
          <h2 id="system-heading" className={styles.subheading}>
            Informasi Sistem
          </h2>

          <div className={styles.pillarGrid}>
            <div className={styles.pillarCol}>
              <h3 className={styles.pillarTitle}>Jaringan</h3>
              <dl className={styles.kvList}>
                <div className={styles.kvRow}>
                  <dt>API</dt>
                  <dd className={health ? styles.accentVal : undefined}>
                    {health
                      ? `Terhubung (${health.latencyMs} ms)`
                      : backendOffline
                        ? "Offline"
                        : "Memeriksa"}
                  </dd>
                </div>
                <div className={styles.kvRow}>
                  <dt>WebSocket</dt>
                  <dd className={wsConnected ? styles.accentVal : undefined}>
                    {wsConnected ? "Aktif" : "Nonaktif"}
                  </dd>
                </div>
                <div className={styles.kvRow}>
                  <dt>IP klien</dt>
                  <dd>{health?.client_ip ?? "-"}</dd>
                </div>
              </dl>
            </div>

            <div className={styles.pillarCol}>
              <h3 className={styles.pillarTitle}>Komputasi Awan</h3>
              <dl className={styles.kvList}>
                <div className={styles.kvRow}>
                  <dt>Basis data</dt>
                  <dd>{health?.storage_backend ?? "-"}</dd>
                </div>
                <div className={styles.kvRow}>
                  <dt>Server</dt>
                  <dd>{health?.server_hostname ?? "-"}</dd>
                </div>
                <div className={styles.kvRow}>
                  <dt>Cuaca</dt>
                  <dd>Open-Meteo HTTPS</dd>
                </div>
              </dl>
            </div>

            <div className={styles.pillarCol}>
              <h3 className={styles.pillarTitle}>Model ML</h3>
              <dl className={styles.kvList}>
                <div className={styles.kvRow}>
                  <dt>Algoritma</dt>
                  <dd className={modelInfo?.loaded ? styles.accentVal : undefined}>
                    {modelInfo?.model_name ?? "-"}
                  </dd>
                </div>
                <div className={styles.kvRow}>
                  <dt>Kalibrasi</dt>
                  <dd>{calibrationText}</dd>
                </div>
                <div className={styles.kvRow}>
                  <dt>Evaluasi</dt>
                  <dd>
                    {modelInfo?.cv_r2_mean != null && modelInfo?.test_mae != null
                      ? `CV R² ${modelInfo.cv_r2_mean} (MAE ${modelInfo.test_mae}°C)`
                      : "-"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {modelInfo && modelInfo.benchmarks.length > 0 ? (
            <div className={styles.benchmarkBlock}>
              <h3 className={styles.benchmarkTitle}>Perbandingan Model ML</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Model</th>
                      <th scope="col">CV R²</th>
                      <th scope="col">Test R²</th>
                      <th scope="col">MAE (°C)</th>
                      <th scope="col">RMSE (°C)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelInfo.benchmarks.map((row) => {
                      const active = row.model_name === modelInfo.model_name;
                      return (
                        <tr key={row.model_name}>
                          <td className={active ? styles.winnerCell : undefined}>
                            {row.model_name}
                          </td>
                          <td>{row.cv_r2_mean.toFixed(4)}</td>
                          <td>{row.test_r2.toFixed(4)}</td>
                          <td>{row.test_mae.toFixed(4)}</td>
                          <td>{row.test_rmse.toFixed(4)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
