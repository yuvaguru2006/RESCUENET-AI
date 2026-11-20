import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Depends
import sqlite3
from app.core.database import get_db

HASH_ITERATIONS = 100_000

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations and a unique salt."""
    if not salt:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        HASH_ITERATIONS
    )
    return dk.hex(), salt

def verify_password(password: str, salt: str, password_hash: str) -> bool:
    """Verifies a password against the stored salt and hash using constant-time comparison."""
    dk = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        HASH_ITERATIONS
    )
    return hmac.compare_digest(dk.hex(), password_hash)

def create_access_token(user_id: int, role: str, conn: sqlite3.Connection, expires_in_days: int = 7) -> str:
    """Generates a cryptographically random Bearer token and stores it in the user_tokens table."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO user_tokens (token, user_id, role, expires_at)
    VALUES (?, ?, ?, ?);
    """, (token, user_id, role, expires_at.isoformat()))
    conn.commit()
    return token

def get_current_user(
    authorization: Optional[str] = Header(None),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    """FastAPI dependency to extract and validate the Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required. Please sign in.")
    
    token = authorization.split("Bearer ", 1)[1].strip()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT t.token, t.user_id, t.role, t.expires_at, u.username, u.email, u.full_name, u.phone
    FROM user_tokens t
    JOIN users u ON t.user_id = u.id
    WHERE t.token = ?;
    """, (token,))
    row = cursor.fetchone()
    
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please sign in again.")
    
    user_dict = dict(row)
    expires_at = datetime.fromisoformat(user_dict["expires_at"])
    if expires_at < datetime.now(timezone.utc):
        cursor.execute("DELETE FROM user_tokens WHERE token = ?;", (token,))
        conn.commit()
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
        
    return user_dict

def get_optional_user(
    authorization: Optional[str] = Header(None),
    conn: sqlite3.Connection = Depends(get_db)
) -> Optional[Dict[str, Any]]:
    """Optional user dependency: returns user if token present and valid, otherwise None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return get_current_user(authorization, conn)
    except HTTPException:
        return None

def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Dependency ensuring only users with the ADMIN role can access the endpoint."""
    if current_user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Administrator privileges required to perform this action."
        )
    return current_user

def require_citizen(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Dependency verifying the user is an authenticated citizen (or admin)."""
    if current_user.get("role") not in ["CITIZEN", "ADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Valid citizen or administrator credentials required."
        )
    return current_user
