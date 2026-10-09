import styles from "./HowItWorks.module.css";

const STEPS = [
  {
    title: "Cuaca luar",
    body: "Suhu dan kelembapan di luar rumah diambil dari Open-Meteo. Untuk Yogyakarta, datanya diperbarui tiap 15 menit.",
  },
  {
    title: "Model ML",
    body: "Model scikit-learn dari tim kami memperkirakan setpoint yang nyaman dari cuaca itu. Selama model belum terpasang, server memakai rumus kenyamanan adaptif ASHRAE 55.",
  },
  {
    title: "Rekomendasi",
    body: "Hasilnya tiga hal: satu angka untuk remote, kurva suhu sepanjang tidur, dan perkiraan hemat dalam Rupiah.",
  },
];

export default function HowItWorks() {
  return (
    <section id="cara-kerja" aria-labelledby="judul-cara-kerja" className={styles.section}>
      <div className="wrap">
        <div className={styles.head}>
          <h2 id="judul-cara-kerja" className={`headline ${styles.heading}`}>
            Cara kerja
          </h2>
          <p className={styles.intro}>Tiga langkah. Tanpa sensor, tanpa colokan baru.</p>
        </div>

        {/* role="list" keeps list semantics in Safari when list-style is removed. */}
        <ol className={styles.steps} role="list">
          {STEPS.map((step, i) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.numeral} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className={styles.title}>{step.title}</p>
              <p className={styles.body}>{step.body}</p>
            </li>
          ))}
        </ol>

        <p className={`label ${styles.stack}`}>
          Next.js · FastAPI · Supabase · <span className={styles.nowrap}>scikit-learn</span>
        </p>
      </div>
    </section>
  );
}
