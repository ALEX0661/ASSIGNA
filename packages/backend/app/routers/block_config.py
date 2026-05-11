from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import admin_only
from app.core.firebase import db, refresh_courses_cache
import logging

logger = logging.getLogger("block_config")
router = APIRouter()


@router.get("/")
def get_block_configs(semester: str = None, user=Depends(admin_only)):
    """
    Return all block configs, optionally filtered by semester.
    Each doc: { program, yearLevel, semester, blocks }
    """
    docs = db.collection("block_configs").stream()
    configs = [{**d.to_dict(), "id": d.id} for d in docs]
    if semester:
        configs = [c for c in configs if c.get("semester") == semester]
    return configs


@router.post("/")
def save_block_configs(data: dict, user=Depends(admin_only)):
    """
    Save/update a batch of block configs.
    Expects: { "configs": [ { program, yearLevel, semester, blocks }, ... ] }
    """
    configs = data.get("configs", [])
    if not configs:
        raise HTTPException(400, "No configs provided.")

    batch = db.batch()
    saved = 0

    for cfg in configs:
        program   = cfg.get("program", "").strip()
        year      = cfg.get("yearLevel")
        semester  = cfg.get("semester", "").strip()
        blocks    = cfg.get("blocks")

        if not program or not year or not semester or blocks is None:
            continue

        doc_id = f"{program}_{year}_{semester}"
        ref = db.collection("block_configs").document(doc_id)
        batch.set(ref, {
            "program":   program,
            "yearLevel": int(year),
            "semester":  semester,
            "blocks":    int(blocks),
        })
        saved += 1

    try:
        batch.commit()
    except Exception as exc:
        logger.exception("Block config batch commit failed")
        raise HTTPException(500, f"Database error: {exc}")

    return {"saved": saved}


@router.post("/apply")
def apply_block_configs(data: dict, user=Depends(admin_only)):
    """
    Apply saved block configs to all matching courses.
    Expects: { "semester": "1st Semester" }
    Updates course.blocks for every matching (program, yearLevel, semester) group.
    """
    semester = data.get("semester")
    if not semester:
        raise HTTPException(400, "Semester is required.")

    # Load configs for this semester
    configs_docs = db.collection("block_configs").stream()
    config_map = {}
    for d in configs_docs:
        cfg = d.to_dict()
        if cfg.get("semester") == semester:
            key = f"{cfg['program']}_{cfg['yearLevel']}"
            config_map[key] = int(cfg.get("blocks", 1))

    if not config_map:
        return {"updated": 0, "message": "No block configs found for this semester."}

    # Load all courses for this semester
    course_docs = list(db.collection("courses").stream())
    batch = db.batch()
    updated = 0

    for doc in course_docs:
        course = doc.to_dict()
        if course.get("semester", "1st Semester") != semester:
            continue

        key = f"{course.get('program', '')}_{course.get('yearLevel', 1)}"
        if key in config_map:
            new_blocks = config_map[key]
            if course.get("blocks") != new_blocks:
                batch.update(doc.reference, {"blocks": new_blocks})
                updated += 1

    try:
        if updated > 0:
            batch.commit()
            refresh_courses_cache()
    except Exception as exc:
        logger.exception("Apply block config failed")
        raise HTTPException(500, f"Database error: {exc}")

    return {"updated": updated}
