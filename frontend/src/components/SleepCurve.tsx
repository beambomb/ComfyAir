import styles from "./SleepCurve.module.css";

// One illustrative night in Yogyakarta. x is hours after 21.00 (0..10).
// The outdoor curve is a typical pattern, not live data (the caption says so).
const OUTDOOR: [number, number][] = [
  [0, 27.2],
  [1, 26.7],
  [2, 26.1],
  [3, 25.6],
  [4, 25.2],
  [5, 24.8],
  [6, 24.5],
  [7, 24.2],
  [8, 24.0],
  [9, 24.1],
  [10, 24.8],
];

// ComfyAir sleep profile (backend/schema.sql sleep_profiles defaults: bed 22.00,
// wake 06.00, 24 / 26 / 25 C), moved in whole-degree steps like a real remote.
const SETPOINT_STEPS = [
  { from: 1, to: 2.5, temp: 24 },
  { from: 2.5, to: 3.5, temp: 25 },
  { from: 3.5, to: 8, temp: 26 },
  { from: 8, to: 10, temp: 25 },
];

const HABIT = { from: 1, to: 10, temp: 18 };

const PHASES = [
  { from: 1, to: 3.5, name: "Mulai tidur", temp: 24 },
  { from: 3.5, to: 8, name: "Tidur nyenyak", temp: 26 },
  { from: 8, to: 10, name: "Bangun", temp: 25 },
];

const ANNOTATION_HOUR = 6;
const Y_MIN = 16;
const Y_MAX = 30;
const Y_TICKS = [18, 20, 22, 24, 26, 28];

type Layout = {
  name: "wide" | "compact";
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  tickSize: number;
  bandSize: number;
  lineSize: number;
  xTicks: number[];
};

const WIDE: Layout = {
  name: "wide",
  width: 1000,
  height: 460,
  left: 56,
  right: 980,
  top: 64,
  bottom: 410,
  tickSize: 14,
  bandSize: 13,
  lineSize: 15,
  xTicks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

const COMPACT: Layout = {
  name: "compact",
  width: 380,
  height: 520,
  left: 40,
  right: 368,
  top: 84,
  bottom: 470,
  tickSize: 13,
  bandSize: 13,
  lineSize: 14,
  xTicks: [1, 3, 5, 7, 9],
};

function hourLabel(x: number): string {
  return `${String((21 + x) % 24).padStart(2, "0")}.00`;
}

function decimal(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

function setpointAt(hour: number): number | null {
  if (hour < SETPOINT_STEPS[0].from) return null;
  const step = SETPOINT_STEPS.find((s) => hour >= s.from && hour < s.to);
  return (step ?? SETPOINT_STEPS[SETPOINT_STEPS.length - 1]).temp;
}

const round = (n: number) => Math.round(n * 10) / 10;

function scales(layout: Layout) {
  const x = (hour: number) => round(layout.left + (hour / 10) * (layout.right - layout.left));
  const y = (temp: number) =>
    round(layout.bottom - ((temp - Y_MIN) / (Y_MAX - Y_MIN)) * (layout.bottom - layout.top));
  return { x, y };
}

/** Smooth curve through the points (Catmull-Rom converted to cubic Bezier). */
function smoothPath(points: [number, number][]): string {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = round(p1[0] + (p2[0] - p0[0]) / 6);
    const c1y = round(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = round(p2[0] - (p3[0] - p1[0]) / 6);
    const c2y = round(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function Chart({ layout }: { layout: Layout }) {
  const { x, y } = scales(layout);
  const wide = layout.name === "wide";

  const outdoor = smoothPath(OUTDOOR.map(([h, t]) => [x(h), y(t)]));
  const setpoint =
    `M${x(SETPOINT_STEPS[0].from)} ${y(SETPOINT_STEPS[0].temp)}` +
    SETPOINT_STEPS.map((s, i) => (i === 0 ? "" : ` V${y(s.temp)}`) + ` H${x(s.to)}`).join("");

  const dotX = x(ANNOTATION_HOUR);
  const dotY = y(HABIT.temp);

  return (
    <svg
      className={`${styles.chart} ${wide ? styles.wide : styles.compact}`}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* Sleep phases */}
      {PHASES.map((phase, i) => {
        const x1 = x(phase.from);
        const x2 = x(phase.to);
        const mid = round((x1 + x2) / 2);
        return (
          <g key={phase.name}>
            <rect
              x={x1}
              y={layout.top}
              width={round(x2 - x1)}
              height={layout.bottom - layout.top}
              className={i % 2 === 0 ? styles.bandA : styles.bandB}
            />
            {wide ? (
              <text x={x1 + 10} y={layout.top - 18} className={styles.bandLabel} fontSize={layout.bandSize}>
                {phase.name} · {phase.temp}°
              </text>
            ) : (
              <text x={mid} y={layout.top - 40} textAnchor="middle" className={styles.bandLabel} fontSize={layout.bandSize}>
                <tspan x={mid}>{phase.name}</tspan>
                <tspan x={mid} dy={18}>
                  {phase.temp}°
                </tspan>
              </text>
            )}
          </g>
        );
      })}

      {/* Grid and axes */}
      {Y_TICKS.map((t) => (
        <g key={t}>
          <line x1={layout.left} x2={layout.right} y1={y(t)} y2={y(t)} className={styles.grid} />
          <text
            x={layout.left - 8}
            y={y(t)}
            dy="0.35em"
            textAnchor="end"
            className={styles.tick}
            fontSize={layout.tickSize}
          >
            {t}°
          </text>
        </g>
      ))}
      <line x1={layout.left} x2={layout.right} y1={layout.bottom} y2={layout.bottom} className={styles.axis} />
      {layout.xTicks.map((h) => (
        <g key={h}>
          <line x1={x(h)} x2={x(h)} y1={layout.bottom} y2={layout.bottom + 6} className={styles.axis} />
          <text
            x={x(h)}
            y={layout.bottom + (wide ? 28 : 26)}
            textAnchor="middle"
            className={styles.tick}
            fontSize={layout.tickSize}
          >
            {hourLabel(h)}
          </text>
        </g>
      ))}

      {/* Lines */}
      <path d={outdoor} className={styles.outdoor} />
      <line x1={x(HABIT.from)} x2={x(HABIT.to)} y1={y(HABIT.temp)} y2={y(HABIT.temp)} className={styles.habit} />
      <path d={setpoint} className={styles.setpoint} />
      <circle cx={x(SETPOINT_STEPS[0].from)} cy={y(SETPOINT_STEPS[0].temp)} r={4.5} className={styles.setpointStart} />

      {/* Direct labels instead of a legend */}
      <text x={x(0) + 4} y={y(OUTDOOR[0][1]) - 14} className={styles.labelOutdoor} fontSize={layout.lineSize}>
        suhu luar
      </text>
      <text x={x(wide ? 4.6 : 4.3)} y={y(26) - 12} className={styles.labelSetpoint} fontSize={layout.lineSize}>
        ComfyAir
      </text>
      {wide ? (
        <text x={x(10)} y={y(HABIT.temp) - 12} textAnchor="end" className={styles.labelHabit} fontSize={layout.lineSize}>
          setelan umum · 18°
        </text>
      ) : (
        <text x={x(1) + 2} y={y(HABIT.temp) - 10} className={styles.labelHabit} fontSize={layout.lineSize}>
          setelan umum · 18°
        </text>
      )}

      {/* 03.00 on the usual 18 C setting */}
      <circle cx={dotX} cy={dotY} r={5} className={styles.annotationDot} />
      {wide ? (
        <>
          <line x1={dotX} x2={dotX} y1={dotY - 9} y2={y(20.6)} className={styles.leader} />
          <text x={dotX + 8} y={y(20.6) + 4} className={styles.annotation} fontSize={layout.tickSize}>
            03.00 · terbangun kedinginan, cari selimut
          </text>
        </>
      ) : (
        <>
          <line x1={dotX} x2={dotX} y1={dotY - 9} y2={y(20.15)} className={styles.leader} />
          <text x={layout.right} y={y(21.2)} textAnchor="end" className={styles.annotation} fontSize={layout.tickSize}>
            <tspan x={layout.right}>03.00 · terbangun</tspan>
            <tspan x={layout.right} dy={17}>
              kedinginan, cari selimut
            </tspan>
          </text>
        </>
      )}
    </svg>
  );
}

const HOURS = OUTDOOR.map(([h]) => h);

export default function SleepCurve() {
  return (
    <section id="kurva-tidur" aria-labelledby="judul-kurva" className={styles.night}>
      <div className="wrap">
        <div className={styles.intro}>
          <p className={`label ${styles.eyebrow}`}>Kurva tidur · 21.00 sampai 07.00</p>
          <h2 id="judul-kurva" className={`headline ${styles.heading}`}>
            Tubuhmu tidak butuh 18°C <em>semalaman</em>.
          </h2>
          <p className={styles.body}>
            Suhu tubuh turun saat kamu terlelap, lalu naik lagi menjelang pagi. ComfyAir mengikuti
            ritme itu dengan langkah satu derajat, karena remote AC memang cuma kenal angka bulat.
          </p>
        </div>

        <figure className={styles.figure}>
          <Chart layout={WIDE} />
          <Chart layout={COMPACT} />
          {/* Hidden via a wrapper div: a <table> ignores the 1px box of .visually-hidden
              and would otherwise widen the page on phones. Placed before the figcaption
              so the caption stays the figure's last child. */}
          <div className="visually-hidden">
            <table>
              <caption>Data kurva tidur per jam</caption>
              <thead>
                <tr>
                  <th scope="col">Jam</th>
                  <th scope="col">Suhu luar (°C)</th>
                  <th scope="col">Setelan ComfyAir (°C)</th>
                  <th scope="col">Setelan umum (°C)</th>
                </tr>
              </thead>
              <tbody>
                {HOURS.map((h, i) => {
                  const comfy = setpointAt(h);
                  return (
                    <tr key={h}>
                      <th scope="row">{hourLabel(h)}</th>
                      <td>{decimal(OUTDOOR[i][1])}</td>
                      <td>{comfy === null ? "AC belum menyala" : comfy}</td>
                      <td>{h < HABIT.from ? "AC belum menyala" : HABIT.temp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <figcaption className={styles.caption}>
            Ilustrasi satu malam di Yogyakarta. Garis suhu luar adalah pola khas, bukan data live.
            Setelan ComfyAir memakai profil tidur bawaan: tidur 22.00, bangun 06.00.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
