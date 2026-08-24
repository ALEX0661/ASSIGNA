# Module-level in-memory state.
# IMPORTANT: FastAPI must run with --workers 1.
# Multiple OS workers = separate process memory = these dicts will be empty
# on non-solver workers, breaking status polling and result retrieval.

schedule_dict = {}       # current in-memory schedule (list of events)
progress_state = {}      # process_id -> int (0-100) or -1 (failed) or -2 (cancelled)
failure_details = {}     # process_id -> diagnostic dict from _analyze_phase_failure(),
                          # kept separate from progress_state so that dict stays numeric-only
phase_state = {}         # process_id -> {"phase": int, "totalPhases": int, "phaseName": str}
                          # current CP-SAT phase being solved, for the frontend phase stepper
faculty_occupied = {}    # faculty_name -> set of occupied slot indices

# Real solve lifecycle tracking. progress_state alone isn't enough to know
# whether a solve is *physically* still running: "cancel" used to only set
# progress_state[id] = -2, which just stopped the frontend poller — the
# background thread kept executing to completion regardless, still mutating
# shared caches/globals. That's what let a cancelled-then-restarted solve
# race against its own zombie predecessor and blow up with "Impossible
# Constraints" on the retry.
running_processes = set()   # process_ids whose solve loop is currently executing
cancel_flags = set()        # process_ids that have been asked to stop; the
                             # solve loop checks this between phases and bails