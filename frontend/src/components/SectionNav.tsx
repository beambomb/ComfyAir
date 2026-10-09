import styles from "./SectionNav.module.css";

const SECTIONS = [
  { href: "#simulasi", label: "Simulasi" },
  { href: "#hemat", label: "Hemat" },
  { href: "#kurva-tidur", label: "Kurva tidur" },
  { href: "#cara-kerja", label: "Cara kerja" },
];

/** Secondary, in-page jump links. Only used on the Presentasi route. */
export default function SectionNav() {
  return (
    <nav aria-label="Bagian halaman" className={styles.sectionNav}>
      <div className="wrap">
        <ul className={styles.nav}>
          {SECTIONS.map((section) => (
            <li key={section.href}>
              <a href={section.href}>{section.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
