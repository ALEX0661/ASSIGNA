from fastapi import Header, HTTPException
from firebase_admin import auth


async def verify_token(authorization: str = Header(...)):
    """Validate any logged-in user."""
    try:
        token = authorization.replace("Bearer ", "")
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")


async def admin_only(authorization: str = Header(...)):
    """Only users with role='admin' custom claim can pass."""
    user = await verify_token(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


async def any_authenticated(authorization: str = Header(...)):
    """Any authenticated user (admin or faculty)."""
    return await verify_token(authorization)
