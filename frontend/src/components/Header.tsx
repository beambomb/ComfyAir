"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatWibTime } from "@/lib/dateline";
import { useComfortState } from "./ComfortProvider";
import styles from "./Header.module.css";

const NAV_ITEMS = [
  { href: "/", label: "Dasbor" },
  { href: "/penghematan", label: "Penghematan" },
  { href: "/akun", label: "Akun" },
] as const;

function isActive(pathname: string, href: string): boolean {
  const current = pathname.replace(/\/+$/, "") || "/";
  const target = href.replace(/\/+$/, "") || "/";
  return current === target;
}

function subscribeMinute(onChange: () => void) {
  const id = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(id);
}

function getMinute(): number | null {
  return Math.floor(Date.now() / 60_000);
}

function getServerMinute(): number | null {
  return null;
}

export default function Header() {
  const pathname = usePathname();
  const { city } = useComfortState();
  const minute = useSyncExternalStore(subscribeMinute, getMinute, getServerMinute);
  const wib = minute === null ? null : formatWibTime(minute * 60_000);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          <svg
            className={styles.logo}
            viewBox="0 0 32 32"
            width="24"
            height="24"
            aria-hidden="true"
            focusable="false"
          >
            <rect width="32" height="32" rx="7" fill="#0057d9" />
            <path
              d="M17.2 11.6a6.2 6.2 0 1 0 0 8.8"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="23.5" cy="10.5" r="2.5" fill="none" stroke="#ffffff" strokeWidth="2.2" />
          </svg>
          <span>ComfyAir</span>
        </Link>

        <nav aria-label="Navigasi utama" className={styles.nav}>
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={styles.navLink}
                    aria-current={active ? "page" : undefined}
                    data-active={active ? "" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <p className={styles.location}>
          {city}
          {wib ? (
            <>
              , <time dateTime={wib.iso}>{wib.text}</time>
            </>
          ) : null}
        </p>
      </div>
    </header>
  );
}
