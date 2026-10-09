import { MODE_LABEL, type Mode, type RecommendationSource } from "@/lib/comfort";
import SegmentDisplay from "./SegmentDisplay";
import styles from "./Remote.module.css";

type RemoteProps = {
  setpoint: number;
  source: RecommendationSource;
  mode: Mode;
  power: boolean;
  outdoorTemp: number;
  humidity: number;
  onModeCycle: () => void;
  onPowerToggle: () => void;
};

/**
 * The simulated AC remote. Only MODE and POWER are buttons; everything else on
 * the casing is a flat print, so nothing decorative looks pressable.
 */
export default function Remote({
  setpoint,
  source,
  mode,
  power,
  outdoorTemp,
  humidity,
  onModeCycle,
  onPowerToggle,
}: RemoteProps) {
  // The IR lens flashes whenever the remote "sends" a new setting.
  const blinkKey = power ? `${setpoint}|${source}|${mode}` : "off";

  return (
    <div role="group" aria-labelledby="remote-label" className={styles.remote}>
      <span id="remote-label" className="visually-hidden">
        Remote AC simulasi
      </span>

      <div className={styles.ir} aria-hidden="true">
        <span data-ir="" key={blinkKey} className={styles.irFlash} />
      </div>

      <p className={styles.brand} aria-hidden="true">
        ComfyAir · R-01
      </p>

      <div className={power ? styles.lcd : `${styles.lcd} ${styles.lcdOff}`}>
        <SegmentDisplay
          setpoint={setpoint}
          mode={mode}
          power={power}
          outdoorTemp={outdoorTemp}
          humidity={humidity}
        />
      </div>

      <div className={styles.controls}>
        <div className={styles.control}>
          <button
            type="button"
            className={styles.modeButton}
            aria-label={`Ganti mode, sekarang ${MODE_LABEL[mode]}`}
            onClick={onModeCycle}
          />
          <span className={styles.print} aria-hidden="true">
            MODE
          </span>
        </div>
        <div className={styles.control}>
          <button
            type="button"
            className={styles.powerButton}
            aria-pressed={power}
            aria-label="Power, daya AC"
            onClick={onPowerToggle}
          >
            <svg viewBox="0 0 24 24" className={styles.powerGlyph} aria-hidden="true" focusable="false">
              <path d="M7.4 6.9a7 7 0 1 0 9.2 0" />
              <path d="M12 3.6v8.2" />
            </svg>
          </button>
          <span className={styles.print} aria-hidden="true">
            POWER
          </span>
        </div>
      </div>

      <p className={styles.band} aria-hidden="true">
        SUHU: OTOMATIS
      </p>
      <div className={styles.grip} aria-hidden="true" />
    </div>
  );
}
