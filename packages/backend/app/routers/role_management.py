"""
Role Management Router
Allows admins to set roles and coordinator flags for faculty members via the UI.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from firebase_admin import auth as firebase_auth
from app.core.auth import admin_only

router = APIRouter(prefix="/faculty/role", tags=["role-management"])


class RoleUpdate(BaseModel):
    role: str  # "admin" or "faculty"
    isCoordinator: bool = False
    coordinatorProgram: Optional[str] = None  # e.g. "BSCS", "BSIT", "BSEMC"


@router.post("/{faculty_id}")
async def set_faculty_role(faculty_id: str, update: RoleUpdate, _=admin_only):
    """
    Set the role and coordinator flag for a faculty member.
    Only admins can call this endpoint.
    """
    # Validate role
    if update.role not in ("admin", "faculty"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'faculty'")
    
    # Validate coordinator flag
    if update.isCoordinator and update.role != "faculty":
        raise HTTPException(
            status_code=400,
            detail="Coordinator flag can only be set for faculty role"
        )
    
    # Validate coordinator program
    if update.isCoordinator and not update.coordinatorProgram:
        raise HTTPException(
            status_code=400,
            detail="Coordinator program must be specified when granting coordinator access"
        )
    
    try:
        # Build custom claims
        claims = {"role": update.role}
        if update.isCoordinator:
            claims["isCoordinator"] = True
            claims["coordinatorProgram"] = update.coordinatorProgram
        
        # Set custom claims in Firebase
        firebase_auth.set_custom_user_claims(faculty_id, claims)
        
        return {
            "success": True,
            "message": f"Role '{update.role}' set successfully" + 
                      (f" with coordinator access for {update.coordinatorProgram}" if update.isCoordinator else ""),
            "role": update.role,
            "isCoordinator": update.isCoordinator,
            "coordinatorProgram": update.coordinatorProgram if update.isCoordinator else None
        }
    except firebase_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="Faculty member not found in Firebase Auth")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set role: {str(e)}")


@router.get("/{faculty_id}")
async def get_faculty_role(faculty_id: str, _=admin_only):
    """
    Get the current role and coordinator status for a faculty member.
    Only admins can call this endpoint.
    """
    try:
        user = firebase_auth.get_user(faculty_id)
        claims = user.custom_claims or {}
        
        return {
            "uid": faculty_id,
            "email": user.email,
            "role": claims.get("role"),
            "isCoordinator": claims.get("isCoordinator", False),
            "coordinatorProgram": claims.get("coordinatorProgram")
        }
    except firebase_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="Faculty member not found in Firebase Auth")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get role: {str(e)}")
