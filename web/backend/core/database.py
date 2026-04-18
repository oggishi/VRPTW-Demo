from __future__ import annotations

import sqlite3
import time

from core.config import DB_PATH
from core.security import hash_password, hash_token, is_valid_role


def open_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with open_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """
        )

        cols = [r["name"]
                for r in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "password_plain" in cols:
            rows = conn.execute("SELECT * FROM users").fetchall()
            now = int(time.time())
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users_new (
                    email TEXT PRIMARY KEY,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                )
                """
            )
            for row in rows:
                role = row["role"] if "role" in row.keys(
                ) and is_valid_role(row["role"]) else "operator"
                created_at = int(row["created_at"]) if "created_at" in row.keys(
                ) and row["created_at"] else now
                if "password_hash" in row.keys() and row["password_hash"]:
                    password_hash = row["password_hash"]
                else:
                    password_hash = hash_password(str(row["password_plain"]))
                conn.execute(
                    "INSERT OR REPLACE INTO users_new (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
                    (str(row["email"]).lower(),
                     password_hash, role, created_at),
                )
            conn.execute("DROP TABLE users")
            conn.execute("ALTER TABLE users_new RENAME TO users")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS register_otps (
                email TEXT PRIMARY KEY,
                otp_hash TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                requested_at INTEGER NOT NULL
            )
            """
        )

        otp_cols_raw = [r["name"] for r in conn.execute(
            "PRAGMA table_info(register_otps)").fetchall()]
        otp_expected = {"email", "otp_hash", "expires_at", "requested_at"}
        if set(otp_cols_raw) != otp_expected:
            rows = conn.execute("SELECT * FROM register_otps").fetchall()
            now = int(time.time())
            otp_cols = {c.strip(): c for c in otp_cols_raw}

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS register_otps_new (
                    email TEXT PRIMARY KEY,
                    otp_hash TEXT NOT NULL,
                    expires_at INTEGER NOT NULL,
                    requested_at INTEGER NOT NULL
                )
                """
            )

            for row in rows:
                email_col = otp_cols.get("email")
                expires_col = otp_cols.get("expires_at")
                requested_col = otp_cols.get("requested_at")
                otp_hash_col = otp_cols.get("otp_hash")
                otp_plain_col = otp_cols.get("otp")

                if not email_col or not expires_col:
                    continue

                email = str(row[email_col]).strip().lower()
                if not email:
                    continue

                if otp_hash_col and row[otp_hash_col]:
                    otp_hash = str(row[otp_hash_col]).strip()
                elif otp_plain_col and row[otp_plain_col]:
                    otp_hash = hash_token(str(row[otp_plain_col]).strip())
                else:
                    continue

                try:
                    expires_at = int(row[expires_col])
                except (TypeError, ValueError):
                    continue

                try:
                    requested_at = int(
                        row[requested_col]) if requested_col and row[requested_col] is not None else now
                except (TypeError, ValueError):
                    requested_at = now

                conn.execute(
                    "INSERT OR REPLACE INTO register_otps_new (email, otp_hash, expires_at, requested_at) VALUES (?, ?, ?, ?)",
                    (email, otp_hash, expires_at, requested_at),
                )

            conn.execute("DROP TABLE register_otps")
            conn.execute(
                "ALTER TABLE register_otps_new RENAME TO register_otps")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token_hash TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                used INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            )
            """
        )

        reset_cols_raw = [r["name"] for r in conn.execute(
            "PRAGMA table_info(password_reset_tokens)").fetchall()]
        reset_expected = {"token_hash", "email",
                          "expires_at", "used", "created_at"}
        if set(reset_cols_raw) != reset_expected:
            rows = conn.execute(
                "SELECT * FROM password_reset_tokens").fetchall()
            now = int(time.time())
            reset_cols = {c.strip(): c for c in reset_cols_raw}

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS password_reset_tokens_new (
                    token_hash TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    expires_at INTEGER NOT NULL,
                    used INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL
                )
                """
            )

            for row in rows:
                token_col = reset_cols.get("token_hash")
                email_col = reset_cols.get("email")
                expires_col = reset_cols.get("expires_at")
                used_col = reset_cols.get("used")
                created_col = reset_cols.get("created_at")

                if not token_col or not email_col or not expires_col:
                    continue

                token_hash_value = str(row[token_col]).strip()
                email = str(row[email_col]).strip().lower()
                if not token_hash_value or not email:
                    continue

                try:
                    expires_at = int(row[expires_col])
                except (TypeError, ValueError):
                    continue

                try:
                    used = int(
                        row[used_col]) if used_col and row[used_col] is not None else 0
                except (TypeError, ValueError):
                    used = 0

                try:
                    created_at = int(
                        row[created_col]) if created_col and row[created_col] is not None else now
                except (TypeError, ValueError):
                    created_at = now

                conn.execute(
                    "INSERT OR REPLACE INTO password_reset_tokens_new (token_hash, email, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?)",
                    (token_hash_value, email, expires_at, used, created_at),
                )

            conn.execute("DROP TABLE password_reset_tokens")
            conn.execute(
                "ALTER TABLE password_reset_tokens_new RENAME TO password_reset_tokens")

        conn.commit()
