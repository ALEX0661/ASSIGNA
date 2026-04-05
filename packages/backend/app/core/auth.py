from fastapi import Header, HTTPException
from firebase_admin import auth

async def verify_token(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

async def admin_only(authorization: str = Header(...)):
    user = await verify_token(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user