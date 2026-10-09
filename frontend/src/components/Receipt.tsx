import {
  ENERGY,
  formatKwh,
  formatPercent,
  formatRupiah,
  formatTariff,
  monthlyBill,
  type Recommendation,
} from "@/lib/comfort";
import styles from "./Receipt.module.css";

// Decorative barcode. Bar and gap widths come from the character codes of the
// receipt code, so the pattern is fixed and identical on server and client.
const BARCODE_TEXT = "COMFYAIR-R01";
const BARCODE = (() => {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const push = (w: number, gap: number) => {
    bars.push({ x, w });
    x += w + gap;
  };
  push(1, 1);
  push(1, 2);
  for (const char of BARCODE_TEXT) {
    const code = char.charCodeAt(0);
    push(1 + (code % 3), 1 + ((code >> 2) % 2));
    push(1 + ((code >> 1) % 3), 1 + ((code >> 3) % 3));
  }
  push(1, 1);
  push(1, 0);
  return { bars, width: x };
})();

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function Receipt({ rec }: { rec: Recommendation }) {
  const bill = monthlyBill(rec.savingsPercent);
  const percent = formatPercent(rec.savingsPercent);

  return (
    <div className={styles.receipt}>
      <div className={styles.paper}>
        <p className={styles.header}>COMFYAIR · STRUK SIMULASI</p>
        <p className={styles.subheader}>Yogyakarta · {ENERGY.nightsPerMonth} malam</p>

        <dl className={styles.rows}>
          <Row term="KASIR" value={rec.source === "api" ? "API ComfyAir" : "Rumus ASHRAE 55"} />
        </dl>

        <dl className={`${styles.rows} ${styles.ruled}`}>
          <Row
            term={`AC 1 PK × ${ENERGY.hoursPerNight} jam × ${ENERGY.nightsPerMonth}`}
            value={formatKwh(bill.baselineKwh)}
          />
          <Row term="Tarif per kWh" value={formatTariff()} />
          <Row term={`Biaya di ${ENERGY.baselineSetpoint}°C`} value={formatRupiah(bill.baselineRp)} />
        </dl>

        <dl className={`${styles.rows} ${styles.ruled}`}>
          <Row term="Setelan ComfyAir" value={`${rec.setpoint}°C`} />
          <Row term="Lebih hemat" value={percent} />
          <Row term={`Biaya di ${rec.setpoint}°C`} value={formatRupiah(bill.optimizedRp)} />
        </dl>

        <dl className={`${styles.rows} ${styles.total}`}>
          <div className={styles.row}>
            <dt>HEMAT / BULAN</dt>
            <dd>{formatRupiah(bill.savedRp)}</dd>
          </div>
        </dl>
        <p className={styles.totalNote}>{percent} lebih hemat</p>

        <svg
          className={styles.barcode}
          viewBox={`0 0 ${BARCODE.width} 30`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          aria-hidden="true"
          focusable="false"
        >
          {BARCODE.bars.map((bar) => (
            <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={30} />
          ))}
        </svg>
        <p className={styles.code} aria-hidden="true">
          {BARCODE_TEXT}
        </p>
        <p className={styles.signoff}>Terima kasih. Selamat tidur.</p>
      </div>
    </div>
  );
}
