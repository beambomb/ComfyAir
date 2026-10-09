import { MODES, type Mode } from "@/lib/comfort";
import styles from "./SegmentDisplay.module.css";

// Seven-segment geometry. Hexagonal segments in a w x h box with thickness t:
//  aaa
// f   b
//  ggg
// e   c
//  ddd
type SegmentName = "a" | "b" | "c" | "d" | "e" | "f" | "g";
const SEGMENT_NAMES: SegmentName[] = ["a", "b", "c", "d", "e", "f", "g"];

const hSeg = (x1: number, x2: number, y: number, t: number) =>
  `${x1},${y} ${x1 + t / 2},${y - t / 2} ${x2 - t / 2},${y - t / 2} ${x2},${y} ${x2 - t / 2},${y + t / 2} ${x1 + t / 2},${y + t / 2}`;

const vSeg = (y1: number, y2: number, x: number, t: number) =>
  `${x},${y1} ${x + t / 2},${y1 + t / 2} ${x + t / 2},${y2 - t / 2} ${x},${y2} ${x - t / 2},${y2 - t / 2} ${x - t / 2},${y1 + t / 2}`;

function segments(w: number, h: number, t: number, gap: number): Record<SegmentName, string> {
  const left = t / 2;
  const right = w - t / 2;
  const top = t / 2;
  const mid = h / 2;
  const bottom = h - t / 2;
  return {
    a: hSeg(left + gap, right - gap, top, t),
    b: vSeg(top + gap, mid - gap, right, t),
    c: vSeg(mid + gap, bottom - gap, right, t),
    d: hSeg(left + gap, right - gap, bottom, t),
    e: vSeg(mid + gap, bottom - gap, left, t),
    f: vSeg(top + gap, mid - gap, left, t),
    g: hSeg(left + gap, right - gap, mid, t),
  };
}

const DIGITS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  " ": "",
  C: "adef",
};

const BIG = segments(46, 78, 10, 1.1);
const SMALL = segments(26, 44, 6.5, 0.9);

function Digit({
  char,
  x,
  y,
  shapes,
  lit,
}: {
  char: string;
  x: number;
  y: number;
  shapes: Record<SegmentName, string>;
  lit: boolean;
}) {
  const on = lit ? (DIGITS[char] ?? "") : "";
  return (
    <g transform={`translate(${x} ${y}) skewX(-7)`}>
      {SEGMENT_NAMES.map((name) => (
        <polygon
          key={name}
          points={shapes[name]}
          className={on.includes(name) ? styles.on : styles.ghost}
        />
      ))}
    </g>
  );
}

// Mode labels across the top row of the glass.
const MODE_X: Record<Mode, { x: number; anchor: "start" | "middle" | "end" }> = {
  ECO: { x: 14, anchor: "start" },
  SLEEP: { x: 110, anchor: "middle" },
  COMFORT: { x: 206, anchor: "end" },
};

type SegmentDisplayProps = {
  setpoint: number;
  mode: Mode;
  power: boolean;
  outdoorTemp: number;
  humidity: number;
};

export default function SegmentDisplay({
  setpoint,
  mode,
  power,
  outdoorTemp,
  humidity,
}: SegmentDisplayProps) {
  const digits = String(setpoint).padStart(2, " ").slice(-2);
  const label = power
    ? `Layar remote: ${setpoint} derajat Celsius, mode ${mode}`
    : "Layar remote mati";

  return (
    <svg className={styles.display} viewBox="0 0 220 132" role="img" aria-label={label}>
      {MODES.map((m) => (
        <text
          key={m}
          x={MODE_X[m].x}
          y={17}
          textAnchor={MODE_X[m].anchor}
          className={`${styles.text} ${power && m === mode ? styles.textOn : styles.textGhost}`}
        >
          {m}
        </text>
      ))}

      {/* Keyed so the redraw flicker replays whenever the number or power changes. */}
      <g key={`${setpoint}|${power}`} className={styles.digits}>
        <Digit char={digits[0]} x={40} y={30} shapes={BIG} lit={power} />
        <Digit char={digits[1]} x={96} y={30} shapes={BIG} lit={power} />
        <circle
          cx={153}
          cy={37}
          r={5.5}
          className={power ? styles.ringOn : styles.ringGhost}
        />
        <Digit char="C" x={165} y={30} shapes={SMALL} lit={power} />
      </g>

      <text x={14} y={125} className={`${styles.text} ${power ? styles.textOn : styles.textGhost}`}>
        LUAR {outdoorTemp}°C
      </text>
      <text
        x={206}
        y={125}
        textAnchor="end"
        className={`${styles.text} ${power ? styles.textOn : styles.textGhost}`}
      >
        RH {humidity}%
      </text>
    </svg>
  );
}
