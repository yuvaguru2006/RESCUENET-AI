from fastapi import APIRouter, Depends, HTTPException, status
import sqlite3
from typing import Dict, Any
from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from app.schemas.pydantic_schemas import (
    UserRegister,
    UserLogin,
    UserResponse,
    TokenResponse
)

router = APIRouter(prefix="/auth", tags=["Core Authentication & RBAC"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_citizen(payload: UserRegister, conn: sqlite3.Connection = Depends(get_db)):
    """
    Public Citizen Registration.
    Strict Security Invariant: Unconditionally assigns role = 'CITIZEN'.
    Cannot be used to create administrator accounts.
    """
    cursor = conn.cursor()
    
    # Check for existing username or email
    cursor.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?);", (payload.username.strip(),))
    if cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken. Please choose another username."
        )
        
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(?);", (payload.email.strip(),))
    if cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # Hash password securely with unique 16-byte salt
    pwd_hash, salt = hash_password(payload.password)
    
    cursor.execute("""
    INSERT INTO users (username, email, password_hash, salt, full_name, phone, role)
    VALUES (?, ?, ?, ?, ?, ?, 'CITIZEN');
    """, (
        payload.username.strip(),
        payload.email.strip().lower(),
        pwd_hash,
        salt,
        payload.full_name.strip(),
        payload.phone.strip() if payload.phone else None
    ))
    conn.commit()
    user_id = cursor.lastrowid

    # Create access token
    token = create_access_token(user_id, "CITIZEN", conn)
    
    cursor.execute("SELECT id, username, email, full_name, phone, role, created_at FROM users WHERE id = ?;", (user_id,))
    user_row = cursor.fetchone()
    
    return {
        "token": token,
        "token_type": "Bearer",
        "user": dict(user_row)
    }

@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, conn: sqlite3.Connection = Depends(get_db)):
    """
    Unified Authentication endpoint for both CITIZEN and ADMIN accounts.
    Verifies PBKDF2 hash and returns signed Bearer token with user role.
    """
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, username, email, password_hash, salt, full_name, phone, role, created_at
    FROM users
    WHERE LOWER(username) = LOWER(?);
    """, (payload.username.strip(),))
    user = cursor.fetchone()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password."
        )
        
    user_dict = dict(user)
    if not verify_password(payload.password, user_dict["salt"], user_dict["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password."
        )

    # Create new access token
    token = create_access_token(user_dict["id"], user_dict["role"], conn)
    
    # Return user profile without salt/hash
    user_profile = {
        "id": user_dict["id"],
        "username": user_dict["username"],
        "email": user_dict["email"],
        "full_name": user_dict["full_name"],
        "phone": user_dict["phone"],
        "role": user_dict["role"],
        "created_at": str(user_dict["created_at"])
    }
    
    return {
        "token": token,
        "token_type": "Bearer",
        "user": user_profile
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Returns currently authenticated user profile."""
    return {
        "id": current_user["user_id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "phone": current_user.get("phone"),
        "role": current_user["role"]
    }

@router.post("/logout")
def logout(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Revokes the current Bearer token."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_tokens WHERE token = ?;", (current_user["token"],))
    conn.commit()
    return {"success": True, "message": "Successfully logged out."}
