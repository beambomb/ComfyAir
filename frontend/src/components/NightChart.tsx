import {
  SETPOINT_STEPS,
  WINDOW_HOURS,
  hourLabel,
  type OutdoorPoint,
} from "@/lib/night";
import styles from "./NightChart.module.css";

// Compact night chart for the dashboard. Draws the outdoor line (real hourly
// forecast when available, otherwise a sample curve) against the stepped
// ComfyAir setpoint line, 21.00 to 07.00. A separate component from SleepCurve
// so the Presentasi chart output never changes.

const Y_MIN = 16;
const Y_MAX = 30;
const Y_TICKS = [18, 22, 26];
const X_TICKS = [0, 2, 4, 6, 8, 10];

const BOX = { width: 640, height: 300, left: 44, right: 624, top: 30, bottom: 250 };

const round = (n: number) => Math.round(n * 10) / 10;

function xScale(hour: number): number {
  return round(BOX.left + (hour / WINDOW_HOURS) * (BOX.right - BOX.left));
}
function yScale(temp: number): number {
  return round(BOX.bottom - ((temp - Y_MIN) / (Y_MAX - Y_MIN)) * (BOX.bottom - BOX.top));
}

/** Smooth Catmull-Rom path, same technique as SleepCurve. */
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

type NightChartProps = {
  outdoor: OutdoorPoint[];
  /** Hours after 21.00 for the "sekarang" marker, or null when outside the window. */
  nowX: number | null;
  /** Caption that honestly labels the outdoor line (live vs contoh). */
  caption: string;
  outdoorLabel: string;
};

export default function NightChart({ outdoor, nowX, caption, outdoorLabel }: NightChartProps) {
  const outdoorPath = smoothPath(outdoor.map((p) => [xScale(p.x), yScale(p.temp)]));
  const setpointPath =
    `M${xScale(SETPOINT_STEPS[0].from)} ${yScale(SETPOINT_STEPS[0].temp)}` +
    SETPOINT_STEPS.map((s, i) => (i === 0 ? "" : ` V${yScale(s.temp)}`) + ` H${xScale(s.to)}`).join("");

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        role="img"
        aria-label={`Grafik suhu malam ini, pukul 21.00 sampai 07.00. ${caption}`}
      >
        {Y_TICKS.map((t) => (
          <g key={t}>
            <line x1={BOX.left} x2={BOX.right} y1={yScale(t)} y2={yScale(t)} className={styles.grid} />
            <text x={BOX.left - 8} y={yScale(t)} dy="0.35em" textAnchor="end" className={styles.tick}>
              {t}°
            </text>
          </g>
        ))}
        <line x1={BOX.left} x2={BOX.right} y1={BOX.bottom} y2={BOX.bottom} className={styles.axis} />
        {X_TICKS.map((h) => (
          <g key={h}>
            <line x1={xScale(h)} x2={xScale(h)} y1={BOX.bottom} y2={BOX.bottom + 5} className={styles.axis} />
            <text x={xScale(h)} y={BOX.bottom + 22} textAnchor="middle" className={styles.tick}>
              {hourLabel(h)}
            </text>
          </g>
        ))}

        {nowX !== null && (
          <g>
            <line
              x1={xScale(nowX)}
              x2={xScale(nowX)}
              y1={BOX.top}
              y2={BOX.bottom}
              className={styles.now}
            />
            <text x={xScale(nowX)} y={BOX.top - 8} textAnchor="middle" className={styles.nowLabel}>
              sekarang
            </text>
          </g>
        )}

        <path d={outdoorPath} className={styles.outdoor} />
        <path d={setpointPath} className={styles.setpoint} />
        <circle
          cx={xScale(SETPOINT_STEPS[0].from)}
          cy={yScale(SETPOINT_STEPS[0].temp)}
          r={4}
          className={styles.setpointStart}
        />

        <text x={xScale(0) + 4} y={yScale(outdoor[0].temp) - 10} className={styles.labelOutdoor}>
          {outdoorLabel}
        </text>
        <text x={xScale(4.6)} y={yScale(26) - 10} className={styles.labelSetpoint}>
          ComfyAir
        </text>
      </svg>
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  );
}
