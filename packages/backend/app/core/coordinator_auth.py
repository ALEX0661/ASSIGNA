from fastapi import Header, HTTPException, Depends
from app.core.auth import verify_token


async def coordinator_only(authorization: str = Header(...)):
    """Only users with isCoordinator=True custom claim can pass.
    Returns the decoded token which includes coordinatorProgram."""
    user = await verify_token(authorization)
    if not user.get("isCoordinator"):
        raise HTTPException(status_code=403, detail="Coordinator access required.")
    if not user.get("coordinatorProgram"):
        raise HTTPException(
            status_code=403,
            detail="No program assigned to this coordinator account."
        )
    return user
