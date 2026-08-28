"""Password hashing and session-token utilities for student authentication.

Passwords are hashed with bcrypt and never stored, logged, or returned in
plaintext. Session tokens are opaque random strings; only their SHA-256 hash
is persisted (see app.models.student_session.StudentSession), so a stolen
database dump alone cannot be replayed as a valid session.
"""

import hashlib
import secrets

import bcrypt

SESSION_TOKEN_BYTES = 32
SESSION_TTL_DAYS = 30


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed/legacy hash — never let it crash the login attempt.
        return False


def generate_session_token() -> str:
    return secrets.token_urlsafe(SESSION_TOKEN_BYTES)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
