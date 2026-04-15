# Module-level in-memory state.
# IMPORTANT: FastAPI must run with --workers 1.
# Multiple OS workers = separate process memory = these dicts will be empty
# on non-solver workers, breaking status polling and result retrieval.

schedule_dict = {}       # current in-memory schedule (list of events)
progress_state = {}      # process_id -> int (0-100) or -1 (failed)
faculty_occupied = {}    # faculty_name -> set of occupied slot indices
