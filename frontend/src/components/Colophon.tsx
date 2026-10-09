import styles from "./Colophon.module.css";

export default function Colophon() {
  return (
    <footer className={styles.colophon} aria-labelledby="judul-kolofon">
      <div className="wrap">
        <div className={styles.sheet}>
          <h2 id="judul-kolofon" className={`label ${styles.title}`}>
            Kolofon
          </h2>
          <div className={styles.columns}>
            <div className={styles.column}>
              <p>
                ComfyAir dibuat oleh tim AB to Z: Arnold Gavrael Bonardo Situmorang, Zakhrova
                Salsabila, Johannes De Deo Dimas Aryobimo.
              </p>
              <p className={styles.meta}>Senior Project TI · DTETI FT UGM</p>
            </div>
            <div className={styles.column}>
              <p>Huruf: Fraunces (Undercase Type), Plus Jakarta Sans (Tokotype), IBM Plex Mono (IBM).</p>
              <p>
                Data cuaca: <a href="https://open-meteo.com/">Open-Meteo.com</a>, lisensi CC BY 4.0.
              </p>
            </div>
            <div className={styles.column}>
              <p>
                Kode sumber:{" "}
                <a href="https://github.com/beambomb/comfyair">github.com/beambomb/comfyair</a>
              </p>
            </div>
          </div>
          <p className={styles.signoff}>Dicetak di Yogyakarta, di atas kertas digital.</p>
        </div>
      </div>
    </footer>
  );
}
