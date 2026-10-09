"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MastheadLive from "./MastheadLive";
import styles from "./Taskbar.module.css";

const VIEWS = [
  { href: "/", label: "Dasbor", sheet: "Lembar No. 01" },
  { href: "/presentasi", label: "Presentasi", sheet: "Lembar No. 02" },
] as const;

// usePathname returns the path without basePath, but with trailingSlash on it
// keeps the trailing slash ("/", "/presentasi/"). Match either form.
function isActive(pathname: string, href: string): boolean {
  const current = pathname.replace(/\/+$/, "") || "/";
  const target = href.replace(/\/+$/, "") || "/";
  return current === target;
}

export default function Taskbar() {
  const pathname = usePathname();
  const active = VIEWS.find((view) => isActive(pathname, view.href)) ?? VIEWS[0];

  return (
    <header className={styles.taskbar}>
      <div className="wrap">
        <div className={styles.top}>
          <Link href="/" className={styles.brand}>
            <span className={styles.wordmark}>ComfyAir</span>
            <span className={styles.motto}>Setpoint AC dari cuaca di luar</span>
          </Link>
          <MastheadLive />
        </div>
        <div className={styles.bar}>
          <nav aria-label="Tampilan" className={styles.views}>
            <ul className={styles.tabs}>
              {VIEWS.map((view) => {
                const current = isActive(pathname, view.href);
                return (
                  <li key={view.href}>
                    <Link
                      href={view.href}
                      className={styles.tab}
                      aria-current={current ? "page" : undefined}
                      data-active={current ? "" : undefined}
                    >
                      {view.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <p className={styles.edition}>
            {active.sheet} <span className={styles.editionMeta}>· Senior Project TI</span>
          </p>
        </div>
      </div>
    </header>
  );
}
