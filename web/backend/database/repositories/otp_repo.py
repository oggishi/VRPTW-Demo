from __future__ import annotations

from core.database import open_db


def upsert_register_otp(email: str, otp_hash: str, expires_at: int, requested_at: int) -> None:
    with open_db() as conn:
        conn.execute(
            """
            INSERT INTO register_otps (email, otp_hash, expires_at, requested_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                otp_hash = excluded.otp_hash,
                expires_at = excluded.expires_at,
                requested_at = excluded.requested_at
            """,
            (email, otp_hash, expires_at, requested_at),
        )
        conn.commit()


def find_register_otp(email: str):
    with open_db() as conn:
        return conn.execute("SELECT otp_hash, expires_at FROM register_otps WHERE email = ?", (email,)).fetchone()


def delete_register_otp(email: str) -> None:
    with open_db() as conn:
        conn.execute("DELETE FROM register_otps WHERE email = ?", (email,))
        conn.commit()


def replace_password_reset_token(email: str, token_hash: str, expires_at: int, created_at: int) -> None:
    with open_db() as conn:
        conn.execute(
            "DELETE FROM password_reset_tokens WHERE email = ?", (email,))
        conn.execute(
            "INSERT INTO password_reset_tokens (token_hash, email, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)",
            (token_hash, email, expires_at, created_at),
        )
        conn.commit()


def find_valid_password_reset_token(token_hash: str, now_ts: int):
    with open_db() as conn:
        return conn.execute(
            "SELECT token_hash FROM password_reset_tokens WHERE token_hash = ? AND used = 0 AND expires_at >= ?",
            (token_hash, now_ts),
        ).fetchone()


def find_password_reset_token(token_hash: str):
    with open_db() as conn:
        return conn.execute(
            "SELECT email, expires_at, used FROM password_reset_tokens WHERE token_hash = ?",
            (token_hash,),
        ).fetchone()


def mark_password_reset_token_used(token_hash: str) -> None:
    with open_db() as conn:
        conn.execute(
            "UPDATE password_reset_tokens SET used = 1 WHERE token_hash = ?", (token_hash,))
        conn.commit()
