import {
  DEFAULT_SLEEP_PROFILE,
  WINDOW_HOURS,
  buildSleepSchedule,
  hourLabel,
  type OutdoorPoint,
  type SetpointStep,
  type SleepPhaseItem,
} from "@/lib/night";
import styles from "./NightChart.module.css";

const Y_MIN = 16;
const Y_MAX = 32;
const Y_TICKS = [18, 22, 26, 30];

type ChartLayout = {
  variant: "wide" | "compact";
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  xTicks: number[];
  fontSize: number;
};

const WIDE: ChartLayout = {
  variant: "wide",
  width: 860,
  height: 250,
  left: 40,
  right: 846,
  top: 26,
  bottom: 214,
  xTicks: [0, 2, 4, 6, 8, 10],
  fontSize: 12,
};

const COMPACT: ChartLayout = {
  variant: "compact",
  width: 340,
  height: 192,
  left: 32,
  right: 328,
  top: 22,
  bottom: 162,
  xTicks: [0, 3, 6, 9],
  fontSize: 11,
};

const round = (n: number) => Math.round(n * 10) / 10;

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

function ChartSvg({
  layout,
  outdoor,
  steps,
  isActive,
  nowX,
}: {
  layout: ChartLayout;
  outdoor: OutdoorPoint[];
  steps: readonly SetpointStep[];
  isActive: boolean;
  nowX: number | null;
}) {
  const xScale = (hour: number) =>
    round(layout.left + (hour / WINDOW_HOURS) * (layout.right - layout.left));
  const yScale = (temp: number) =>
    round(layout.bottom - ((temp - Y_MIN) / (Y_MAX - Y_MIN)) * (layout.bottom - layout.top));

  const outdoorPath = smoothPath(outdoor.map((p) => [xScale(p.x), yScale(p.temp)]));
  const setpointPath =
    `M${xScale(steps[0].from)} ${yScale(steps[0].temp)}` +
    steps.map((s, i) => (i === 0 ? "" : ` V${yScale(s.temp)}`) + ` H${xScale(s.to)}`).join("");

  const nowAnchor =
    nowX === null ? "middle" : nowX < 1 ? "start" : nowX > WINDOW_HOURS - 1 ? "end" : "middle";

  return (
    <svg
      className={`${styles.svg} ${layout.variant === "wide" ? styles.wide : styles.compact}`}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label="Grafik kurva suhu tidur pukul 21.00 hingga 07.00 WIB"
    >
      {Y_TICKS.map((t) => (
        <g key={t}>
          <line
            x1={layout.left}
            x2={layout.right}
            y1={yScale(t)}
            y2={yScale(t)}
            className={styles.gridLine}
          />
          <text
            x={layout.left - 8}
            y={yScale(t)}
            dy="0.35em"
            textAnchor="end"
            className={styles.tick}
            fontSize={layout.fontSize}
          >
            {t}°
          </text>
        </g>
      ))}

      <line
        x1={layout.left}
        x2={layout.right}
        y1={layout.bottom}
        y2={layout.bottom}
        className={styles.axisLine}
      />

      {layout.xTicks.map((h) => (
        <g key={h}>
          <line
            x1={xScale(h)}
            x2={xScale(h)}
            y1={layout.bottom}
            y2={layout.bottom + 5}
            className={styles.axisLine}
          />
          <text
            x={xScale(h)}
            y={layout.bottom + 19}
            textAnchor="middle"
            className={styles.tick}
            fontSize={layout.fontSize}
          >
            {hourLabel(h)}
          </text>
        </g>
      ))}

      {nowX !== null && (
        <g>
          <line
            x1={xScale(nowX)}
            x2={xScale(nowX)}
            y1={layout.top}
            y2={layout.bottom}
            className={styles.nowLine}
          />
          <text
            x={xScale(nowX)}
            y={layout.top - 7}
            textAnchor={nowAnchor}
            className={styles.nowLabel}
            fontSize={layout.fontSize}
          >
            Sekarang
          </text>
        </g>
      )}

      <path d={outdoorPath} className={styles.outdoorLine} />
      <path
        d={setpointPath}
        className={isActive ? styles.setpointLine : `${styles.setpointLine} ${styles.setpointPaused}`}
      />
      <circle
        cx={xScale(steps[0].from)}
        cy={yScale(steps[0].temp)}
        r={3.5}
        className={isActive ? styles.setpointDot : `${styles.setpointDot} ${styles.dotPaused}`}
      />
    </svg>
  );
}

type NightChartProps = {
  outdoor: OutdoorPoint[];
  nowX: number | null;
  steps?: readonly SetpointStep[];
  phases?: readonly SleepPhaseItem[];
  isActive?: boolean;
};

const DEFAULT_SCHEDULE = buildSleepSchedule(DEFAULT_SLEEP_PROFILE);

export default function NightChart({
  outdoor,
  nowX,
  steps = DEFAULT_SCHEDULE.steps,
  phases = DEFAULT_SCHEDULE.phases,
  isActive = true,
}: NightChartProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.chartFrame}>
        <ChartSvg
          layout={WIDE}
          outdoor={outdoor}
          steps={steps}
          isActive={isActive}
          nowX={nowX}
        />
        <ChartSvg
          layout={COMPACT}
          outdoor={outdoor}
          steps={steps}
          isActive={isActive}
          nowX={nowX}
        />
      </div>

      <ul className={styles.phaseGrid} aria-label="Tahapan suhu tidur">
        {phases.map((phase) => {
          const active = isActive && nowX !== null && nowX >= phase.from && nowX < phase.to;
          return (
            <li
              key={phase.name}
              className={styles.phaseColumn}
              data-active={active ? "" : undefined}
            >
              <div className={styles.phaseTop}>
                <span className={styles.phaseTemp}>{phase.temp}°C</span>
                <span className={styles.phaseTitle}>{phase.name}</span>
              </div>
              <p className={styles.phaseTime}>
                {hourLabel(phase.from)}–{hourLabel(phase.to)} WIB
              </p>
              <p className={styles.phaseDetail}>{phase.detail}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
