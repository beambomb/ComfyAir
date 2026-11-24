"""Unified storage layer: Supabase PostgreSQL cloud with automatic SQLite fallback."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.security import hash_password
from app.core.supabase import get_supabase_client

BACKEND_ROOT = Path(__file__).resolve().parents[2]

_SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS roles (
    role_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    role_id TEXT REFERENCES roles(role_id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_verified INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    is_revoked INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
    preference_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    ac_power_pk REAL NOT NULL DEFAULT 1.0,
    electricity_rate_per_kwh REAL NOT NULL DEFAULT 1444.70,
    default_temperature INTEGER NOT NULL DEFAULT 24,
    preferred_city TEXT DEFAULT 'Yogyakarta',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comfort_feedback (
    feedback_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
    outdoor_temp REAL NOT NULL,
    humidity REAL NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('ECO', 'SLEEP', 'COMFORT')),
    predicted_setpoint INTEGER NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN ('too_cold', 'just_right', 'too_warm')),
    delta_c REAL NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weather_data (
    weather_id TEXT PRIMARY KEY,
    city_name TEXT NOT NULL,
    outdoor_temp REAL NOT NULL,
    humidity REAL NOT NULL,
    weather_condition TEXT,
    recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS temperature_recommendations (
    recommendation_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
    weather_id TEXT REFERENCES weather_data(weather_id) ON DELETE SET NULL,
    recommended_setpoint INTEGER NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('ECO', 'SLEEP', 'COMFORT')),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS energy_saving_logs (
    log_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    log_date TEXT NOT NULL,
    estimated_kwh_baseline REAL NOT NULL,
    estimated_kwh_optimized REAL NOT NULL,
    saved_cost_idr REAL NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON comfort_feedback(user_id, created_at);
"""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_db_path(configured: str) -> Path:
    p = Path(configured)
    if p.is_absolute():
        return p
    return BACKEND_ROOT / p


class ComfyAirStorage:
    """Relational storage supporting Supabase PostgreSQL and local SQLite."""

    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or _resolve_db_path(settings.SQLITE_PATH)
        self._supabase = self._init_supabase()
        self._init_sqlite()

    @staticmethod
    def _init_supabase():
        url = settings.SUPABASE_URL.strip()
        key = settings.SUPABASE_KEY.strip()
        if not url or not key or "your-project-id" in url or "your-anon" in key:
            return None
        return get_supabase_client()

    @property
    def storage_backend_name(self) -> str:
        return "Supabase PostgreSQL" if self._supabase is not None else "SQLite Lokal"

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_sqlite(self) -> None:
        now = _now_iso()
        with self._connect() as conn:
            conn.executescript(_SQLITE_SCHEMA)
            for role_name, desc in (
                ("admin", "Administrator dengan akses penuh"),
                ("user", "Pengguna standar ComfyAir"),
            ):
                existing = conn.execute(
                    "SELECT role_id FROM roles WHERE name = ?", (role_name,)
                ).fetchone()
                if existing is None:
                    conn.execute(
                        "INSERT INTO roles (role_id, name, description) VALUES (?, ?, ?)",
                        (str(uuid.uuid4()), role_name, desc),
                    )

            user_role = conn.execute(
                "SELECT role_id FROM roles WHERE name = 'user'"
            ).fetchone()
            role_id = user_role["role_id"] if user_role else None

            demo = conn.execute(
                "SELECT user_id FROM users WHERE email = ?", ("demo@comfyair.id",)
            ).fetchone()
            if demo is None:
                demo_id = str(uuid.uuid4())
                conn.execute(
                    """
                    INSERT INTO users (
                        user_id, role_id, name, email, password_hash, is_verified, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                    """,
                    (
                        demo_id,
                        role_id,
                        "Tim AB to Z",
                        "demo@comfyair.id",
                        hash_password("comfyair123"),
                        now,
                        now,
                    ),
                )
                self._seed_user_defaults(conn, demo_id, now)

    def _seed_user_defaults(self, conn: sqlite3.Connection, user_id: str, now: str) -> None:
        conn.execute(
            """
            INSERT OR IGNORE INTO user_preferences (
                preference_id, user_id, ac_power_pk, electricity_rate_per_kwh,
                default_temperature, preferred_city, updated_at
            ) VALUES (?, ?, 1.0, 1444.70, 24, 'Yogyakarta', ?)
            """,
            (str(uuid.uuid4()), user_id, now),
        )

    def _attach_role(self, conn: sqlite3.Connection, row: sqlite3.Row | None) -> dict[str, Any] | None:
        if row is None:
            return None
        user = dict(row)
        role_row = None
        if user.get("role_id"):
            role_row = conn.execute(
                "SELECT name FROM roles WHERE role_id = ?", (user["role_id"],)
            ).fetchone()
        user["role"] = role_row["name"] if role_row else "user"
        user["is_verified"] = bool(user.get("is_verified", 0))
        return user

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        norm = email.strip().lower()
        if self._supabase is not None:
            try:
                res = (
                    self._supabase.table("users")
                    .select("*, roles(name)")
                    .eq("email", norm)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    u = dict(res.data[0])
                    roles_obj = u.pop("roles", None)
                    u["role"] = roles_obj["name"] if isinstance(roles_obj, dict) else "user"
                    return u
            except Exception:
                pass
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (norm,)).fetchone()
            return self._attach_role(conn, row)

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        if self._supabase is not None:
            try:
                res = (
                    self._supabase.table("users")
                    .select("*, roles(name)")
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    u = dict(res.data[0])
                    roles_obj = u.pop("roles", None)
                    u["role"] = roles_obj["name"] if isinstance(roles_obj, dict) else "user"
                    return u
            except Exception:
                pass
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
            return self._attach_role(conn, row)

    def create_user(self, name: str, email: str, password_hash: str) -> dict[str, Any]:
        norm = email.strip().lower()
        now = _now_iso()
        user_id = str(uuid.uuid4())
        if self._supabase is not None:
            try:
                role_res = (
                    self._supabase.table("roles")
                    .select("role_id")
                    .eq("name", "user")
                    .limit(1)
                    .execute()
                )
                role_id = role_res.data[0]["role_id"] if role_res.data else None
                res = (
                    self._supabase.table("users")
                    .insert(
                        {
                            "user_id": user_id,
                            "role_id": role_id,
                            "name": name.strip(),
                            "email": norm,
                            "password_hash": password_hash,
                            "is_verified": True,
                        }
                    )
                    .execute()
                )
                self._supabase.table("user_preferences").insert(
                    {
                        "user_id": user_id,
                        "ac_power_pk": 1.0,
                        "electricity_rate_per_kwh": 1444.70,
                        "default_temperature": 24,
                        "preferred_city": "Yogyakarta",
                    }
                ).execute()
                if res.data:
                    created = dict(res.data[0])
                    created["role"] = "user"
                    return created
            except Exception:
                pass

        with self._connect() as conn:
            role_row = conn.execute("SELECT role_id FROM roles WHERE name = 'user'").fetchone()
            role_id = role_row["role_id"] if role_row else None
            conn.execute(
                """
                INSERT INTO users (
                    user_id, role_id, name, email, password_hash, is_verified, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (user_id, role_id, name.strip(), norm, password_hash, now, now),
            )
            self._seed_user_defaults(conn, user_id, now)
            row = conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
            user = self._attach_role(conn, row)
            assert user is not None
            return user

    def create_session(self, user_id: str, ip_address: str, user_agent: str) -> dict[str, Any]:
        now = _now_iso()
        expires = (
            datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        ).isoformat()
        session_id = str(uuid.uuid4())
        payload = {
            "session_id": session_id,
            "user_id": user_id,
            "ip_address": ip_address[:45],
            "user_agent": user_agent[:512],
            "created_at": now,
            "expires_at": expires,
        }
        if self._supabase is not None:
            try:
                self._supabase.table("sessions").insert(payload).execute()
                return payload
            except Exception:
                pass
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO sessions (session_id, user_id, ip_address, user_agent, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    user_id,
                    payload["ip_address"],
                    payload["user_agent"],
                    now,
                    expires,
                ),
            )
        return payload

    def store_refresh_token(self, user_id: str, token_hash: str, expires_at: str) -> dict[str, Any]:
        now = _now_iso()
        token_id = str(uuid.uuid4())
        payload = {
            "token_id": token_id,
            "user_id": user_id,
            "token_hash": token_hash,
            "is_revoked": False,
            "created_at": now,
            "expires_at": expires_at,
        }
        if self._supabase is not None:
            try:
                self._supabase.table("refresh_tokens").insert(payload).execute()
                return payload
            except Exception:
                pass
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO refresh_tokens (token_id, user_id, token_hash, is_revoked, created_at, expires_at)
                VALUES (?, ?, ?, 0, ?, ?)
                """,
                (token_id, user_id, token_hash, now, expires_at),
            )
        return payload

    def verify_refresh_token(self, token_hash: str) -> dict[str, Any] | None:
        row_data: dict[str, Any] | None = None
        if self._supabase is not None:
            try:
                res = (
                    self._supabase.table("refresh_tokens")
                    .select("*")
                    .eq("token_hash", token_hash)
                    .eq("is_revoked", False)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    row_data = dict(res.data[0])
            except Exception:
                row_data = None
        if row_data is None:
            with self._connect() as conn:
                row = conn.execute(
                    "SELECT * FROM refresh_tokens WHERE token_hash = ? AND is_revoked = 0",
                    (token_hash,),
                ).fetchone()
                if row is not None:
                    row_data = dict(row)
        if row_data is None:
            return None
        try:
            exp = datetime.fromisoformat(row_data["expires_at"])
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) >= exp:
                return None
        except ValueError:
            return None
        return row_data

    def revoke_refresh_token(self, token_hash: str) -> None:
        if self._supabase is not None:
            try:
                self._supabase.table("refresh_tokens").update({"is_revoked": True}).eq(
                    "token_hash", token_hash
                ).execute()
            except Exception:
                pass
        with self._connect() as conn:
            conn.execute(
                "UPDATE refresh_tokens SET is_revoked = 1 WHERE token_hash = ?",
                (token_hash,),
            )

    def get_preferences(self, user_id: str) -> dict[str, Any]:
        if self._supabase is not None:
            try:
                res = (
                    self._supabase.table("user_preferences")
                    .select("*")
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    return dict(res.data[0])
            except Exception:
                pass
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)
            ).fetchone()
            if row is None:
                now = _now_iso()
                self._seed_user_defaults(conn, user_id, now)
                row = conn.execute(
                    "SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)
                ).fetchone()
            assert row is not None
            return dict(row)

    def upsert_preferences(self, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
        now = _now_iso()
        current = self.get_preferences(user_id)
        updated = {
            "ac_power_pk": float(data.get("ac_power_pk", current["ac_power_pk"])),
            "electricity_rate_per_kwh": float(
                data.get("electricity_rate_per_kwh", current["electricity_rate_per_kwh"])
            ),
            "default_temperature": int(
                data.get("default_temperature", current["default_temperature"])
            ),
            "preferred_city": str(data.get("preferred_city", current["preferred_city"])),
            "updated_at": now,
        }
        if self._supabase is not None:
            try:
                res = (
                    self._supabase.table("user_preferences")
                    .upsert({"preference_id": current["preference_id"], "user_id": user_id, **updated})
                    .execute()
                )
                if res.data:
                    return dict(res.data[0])
            except Exception:
                pass
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE user_preferences
                SET ac_power_pk = ?, electricity_rate_per_kwh = ?,
                    default_temperature = ?, preferred_city = ?, updated_at = ?
                WHERE user_id = ?
                """,
                (
                    updated["ac_power_pk"],
                    updated["electricity_rate_per_kwh"],
                    updated["default_temperature"],
                    updated["preferred_city"],
                    now,
                    user_id,
                ),
            )
            row = conn.execute(
                "SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)
            ).fetchone()
            assert row is not None
            return dict(row)

    def create_comfort_feedback(
        self,
        user_id: str | None,
        outdoor_temp: float,
        humidity: float,
        mode: str,
        predicted_setpoint: int,
        rating: str,
        delta_c: float,
    ) -> dict[str, Any]:
        now = _now_iso()
        feedback_id = str(uuid.uuid4())
        payload = {
            "feedback_id": feedback_id,
            "user_id": user_id,
            "outdoor_temp": float(outdoor_temp),
            "humidity": float(humidity),
            "mode": mode,
            "predicted_setpoint": int(predicted_setpoint),
            "rating": rating,
            "delta_c": float(delta_c),
            "created_at": now,
        }
        if self._supabase is not None:
            try:
                res = self._supabase.table("comfort_feedback").insert(payload).execute()
                if res.data:
                    return dict(res.data[0])
            except Exception:
                pass

        with self._connect() as conn:
            valid_user_id = None
            if user_id:
                u = conn.execute(
                    "SELECT user_id FROM users WHERE user_id = ?", (user_id,)
                ).fetchone()
                if u:
                    valid_user_id = user_id
            payload["user_id"] = valid_user_id
            conn.execute(
                """
                INSERT INTO comfort_feedback (
                    feedback_id, user_id, outdoor_temp, humidity, mode,
                    predicted_setpoint, rating, delta_c, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    feedback_id,
                    valid_user_id,
                    payload["outdoor_temp"],
                    payload["humidity"],
                    mode,
                    payload["predicted_setpoint"],
                    rating,
                    payload["delta_c"],
                    now,
                ),
            )
        return payload

    def list_comfort_feedback(
        self, user_id: str | None, limit: int = 10
    ) -> list[dict[str, Any]]:
        if self._supabase is not None:
            try:
                q = self._supabase.table("comfort_feedback").select("*")
                if user_id:
                    q = q.eq("user_id", user_id)
                else:
                    q = q.is_("user_id", "null")
                res = q.order("created_at", desc=True).limit(limit).execute()
                return [dict(r) for r in (res.data or [])]
            except Exception:
                pass

        with self._connect() as conn:
            if user_id:
                rows = conn.execute(
                    """
                    SELECT * FROM comfort_feedback
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (user_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM comfort_feedback
                    WHERE user_id IS NULL
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
            return [dict(r) for r in rows]

    def get_comfort_bias(self, user_id: str | None) -> tuple[float, int]:
        rows = self.list_comfort_feedback(user_id, limit=20)
        count = len(rows)
        if count == 0:
            return (0.0, 0)
        total = sum(float(r["delta_c"]) for r in rows)
        raw_bias = (total / (count + 2.0)) * 1.5
        bias = round(max(-2.0, min(2.0, raw_bias)), 2)
        return (bias, count)

    def reset_comfort_feedback(self, user_id: str | None) -> None:
        if self._supabase is not None:
            try:
                q = self._supabase.table("comfort_feedback").delete()
                if user_id:
                    q = q.eq("user_id", user_id)
                else:
                    q = q.is_("user_id", "null")
                q.execute()
            except Exception:
                pass
        with self._connect() as conn:
            if user_id:
                conn.execute("DELETE FROM comfort_feedback WHERE user_id = ?", (user_id,))
            else:
                conn.execute("DELETE FROM comfort_feedback WHERE user_id IS NULL")

    def log_weather(
        self,
        city_name: str,
        outdoor_temp: float,
        humidity: float,
        weather_condition: str = "Open-Meteo",
    ) -> dict[str, Any] | None:
        now = _now_iso()
        weather_id = str(uuid.uuid4())
        payload = {
            "weather_id": weather_id,
            "city_name": city_name,
            "outdoor_temp": float(outdoor_temp),
            "humidity": float(humidity),
            "weather_condition": weather_condition,
            "recorded_at": now,
        }
        if self._supabase is not None:
            try:
                self._supabase.table("weather_data").insert(payload).execute()
                return payload
            except Exception:
                pass
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO weather_data (
                    weather_id, city_name, outdoor_temp, humidity, weather_condition, recorded_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    weather_id,
                    city_name,
                    payload["outdoor_temp"],
                    payload["humidity"],
                    weather_condition,
                    now,
                ),
            )
        return payload

    def log_recommendation(
        self,
        user_id: str | None,
        recommended_setpoint: int,
        mode: str,
        weather_id: str | None = None,
    ) -> dict[str, Any] | None:
        now = _now_iso()
        rec_id = str(uuid.uuid4())
        payload = {
            "recommendation_id": rec_id,
            "user_id": user_id,
            "weather_id": weather_id,
            "recommended_setpoint": int(recommended_setpoint),
            "mode": mode,
            "created_at": now,
        }
        if self._supabase is not None:
            try:
                self._supabase.table("temperature_recommendations").insert(payload).execute()
                return payload
            except Exception:
                pass
        with self._connect() as conn:
            valid_user_id = None
            if user_id:
                u = conn.execute(
                    "SELECT user_id FROM users WHERE user_id = ?", (user_id,)
                ).fetchone()
                if u:
                    valid_user_id = user_id
            conn.execute(
                """
                INSERT INTO temperature_recommendations (
                    recommendation_id, user_id, weather_id, recommended_setpoint, mode, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (rec_id, valid_user_id, weather_id, int(recommended_setpoint), mode, now),
            )
        return payload

    def list_savings_logs(self, user_id: str, period: str | None = None) -> list[dict[str, Any]]:
        cutoff: str | None = None
        today = date.today()
        if period == "daily":
            cutoff = today.isoformat()
        elif period == "weekly":
            cutoff = (today - timedelta(days=7)).isoformat()
        elif period == "monthly":
            cutoff = (today - timedelta(days=30)).isoformat()

        if self._supabase is not None:
            try:
                q = (
                    self._supabase.table("energy_saving_logs")
                    .select("*")
                    .eq("user_id", user_id)
                )
                if cutoff is not None:
                    q = q.gte("log_date", cutoff)
                res = q.order("created_at", desc=True).execute()
                return [dict(r) for r in (res.data or [])]
            except Exception:
                pass

        with self._connect() as conn:
            if cutoff is not None:
                rows = conn.execute(
                    """
                    SELECT * FROM energy_saving_logs
                    WHERE user_id = ? AND log_date >= ?
                    ORDER BY created_at DESC
                    """,
                    (user_id, cutoff),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM energy_saving_logs
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    """,
                    (user_id,),
                ).fetchall()
            return [dict(r) for r in rows]

    def create_savings_log(
        self,
        user_id: str,
        estimated_kwh_baseline: float,
        estimated_kwh_optimized: float,
        saved_cost_idr: float,
        log_date: str | None = None,
    ) -> dict[str, Any]:
        now = _now_iso()
        log_id = str(uuid.uuid4())
        entry_date = log_date or date.today().isoformat()
        payload = {
            "log_id": log_id,
            "user_id": user_id,
            "log_date": entry_date,
            "estimated_kwh_baseline": round(float(estimated_kwh_baseline), 2),
            "estimated_kwh_optimized": round(float(estimated_kwh_optimized), 2),
            "saved_cost_idr": round(float(saved_cost_idr), 2),
            "created_at": now,
        }
        if self._supabase is not None:
            try:
                res = self._supabase.table("energy_saving_logs").insert(payload).execute()
                if res.data:
                    return dict(res.data[0])
            except Exception:
                pass
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO energy_saving_logs (
                    log_id, user_id, log_date, estimated_kwh_baseline,
                    estimated_kwh_optimized, saved_cost_idr, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    log_id,
                    user_id,
                    entry_date,
                    payload["estimated_kwh_baseline"],
                    payload["estimated_kwh_optimized"],
                    payload["saved_cost_idr"],
                    now,
                ),
            )
        return payload

    def delete_savings_log(self, user_id: str, log_id: str) -> bool:
        if self._supabase is not None:
            try:
                res = (
                    self._supabase.table("energy_saving_logs")
                    .delete()
                    .eq("log_id", log_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                return bool(res.data)
            except Exception:
                pass
        with self._connect() as conn:
            cur = conn.execute(
                "DELETE FROM energy_saving_logs WHERE log_id = ? AND user_id = ?",
                (log_id, user_id),
            )
            return cur.rowcount > 0


_storage_instance: ComfyAirStorage | None = None


def get_storage() -> ComfyAirStorage:
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = ComfyAirStorage()
    return _storage_instance


def reset_storage(db_path: Path | None = None) -> ComfyAirStorage:
    global _storage_instance
    _storage_instance = ComfyAirStorage(db_path=db_path)
    return _storage_instance
