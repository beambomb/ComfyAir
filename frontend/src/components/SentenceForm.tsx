import { HUMIDITY, MODE_LABEL, MODES, OUTDOOR, type Mode } from "@/lib/comfort";
import styles from "./SentenceForm.module.css";

type StepperProps = {
  value: string;
  atMin: boolean;
  atMax: boolean;
  decreaseLabel: string;
  increaseLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
};

// aria-disabled instead of disabled: at a bound the button keeps keyboard focus.
function Stepper({
  value,
  atMin,
  atMax,
  decreaseLabel,
  increaseLabel,
  onDecrease,
  onIncrease,
}: StepperProps) {
  return (
    <span className={styles.stepper}>
      <button
        type="button"
        className={styles.step}
        aria-label={decreaseLabel}
        aria-disabled={atMin}
        onClick={() => {
          if (!atMin) onDecrease();
        }}
      >
        −
      </button>
      <output className={styles.value}>{value}</output>
      <button
        type="button"
        className={styles.step}
        aria-label={increaseLabel}
        aria-disabled={atMax}
        onClick={() => {
          if (!atMax) onIncrease();
        }}
      >
        +
      </button>
    </span>
  );
}

// A loose pen loop that overshoots where it started, drawn around the chosen mode.
function PenCircle() {
  return (
    <svg
      className={styles.circle}
      viewBox="0 0 120 50"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        pathLength={1}
        d="M14 33 C 6 21, 26 8, 60 6.5 C 92 5, 115 13, 113.5 25.5 C 112 39, 86 45.5, 57 45 C 30 44.5, 7 38.5, 7.5 26 C 8 17, 22 10.5, 44 8.4"
      />
    </svg>
  );
}

type SentenceFormProps = {
  outdoorTemp: number;
  humidity: number;
  mode: Mode;
  onTempStep: (delta: 1 | -1) => void;
  onHumidityStep: (delta: 5 | -5) => void;
  onModeChange: (mode: Mode) => void;
};

export default function SentenceForm({
  outdoorTemp,
  humidity,
  mode,
  onTempStep,
  onHumidityStep,
  onModeChange,
}: SentenceFormProps) {
  return (
    <form
      aria-label="Simulasi kondisi"
      className={styles.form}
      onSubmit={(event) => event.preventDefault()}
    >
      <p className={styles.line}>
        Di luar sekarang{" "}
        <Stepper
          value={`${outdoorTemp}°C`}
          atMin={outdoorTemp <= OUTDOOR.min}
          atMax={outdoorTemp >= OUTDOOR.max}
          decreaseLabel="Turunkan suhu luar 1 derajat"
          increaseLabel="Naikkan suhu luar 1 derajat"
          onDecrease={() => onTempStep(-1)}
          onIncrease={() => onTempStep(1)}
        />
        , kelembapan{" "}
        <Stepper
          value={`${humidity}%`}
          atMin={humidity <= HUMIDITY.min}
          atMax={humidity >= HUMIDITY.max}
          decreaseLabel="Turunkan kelembapan 5 persen"
          increaseLabel="Naikkan kelembapan 5 persen"
          onDecrease={() => onHumidityStep(-5)}
          onIncrease={() => onHumidityStep(5)}
        />
        .
      </p>
      <p className={styles.line}>
        <span id="label-mode">Aku pilih mode</span>{" "}
        <span role="radiogroup" aria-labelledby="label-mode" className={styles.modes}>
          {MODES.map((m, index) => (
            <span key={m} className={styles.modeItem}>
              {index > 0 && (
                <span className={styles.slash} aria-hidden="true">
                  {" / "}
                </span>
              )}
              <label className={styles.option} data-checked={m === mode ? "" : undefined}>
                <input
                  type="radio"
                  name="mode"
                  value={m}
                  checked={m === mode}
                  onChange={() => onModeChange(m)}
                  className={styles.radio}
                />
                {MODE_LABEL[m]}
                {m === mode && <PenCircle />}
              </label>
            </span>
          ))}
        </span>
        .
      </p>
    </form>
  );
}
