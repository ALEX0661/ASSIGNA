"""
Set a custom role claim on a Firebase Auth user.

Usage:
    python scripts/set_role.py <UID> <role> [--coordinator <PROGRAM>]

Example:
    python scripts/set_role.py abc123uid admin
    python scripts/set_role.py xyz789uid faculty
    python scripts/set_role.py xyz789uid faculty --coordinator BSCS

Find the UID in Firebase Console → Authentication → Users → User UID column.

The --coordinator flag can only be used with faculty role to grant coordinator access.
You must specify the program (BSCS, BSIT, BSEMC, ACT) when using --coordinator.
"""
import sys
import os
import json
from dotenv import load_dotenv

load_dotenv()

import firebase_admin
from firebase_admin import credentials, auth

cred = credentials.Certificate(json.loads(os.environ["FIREBASE_CREDENTIALS_JSON"]))
firebase_admin.initialize_app(cred)

if len(sys.argv) < 3:
    print("Usage: python scripts/set_role.py <UID> <role> [--coordinator <PROGRAM>]")
    print("Roles: admin | faculty")
    print("Programs: BSCS | BSIT | BSEMC | ACT")
    print("\nExamples:")
    print("  python scripts/set_role.py abc123 admin")
    print("  python scripts/set_role.py xyz789 faculty")
    print("  python scripts/set_role.py xyz789 faculty --coordinator BSCS")
    sys.exit(1)

uid  = sys.argv[1]
role = sys.argv[2]
is_coordinator = "--coordinator" in sys.argv
coordinator_program = None

if is_coordinator:
    try:
        coord_index = sys.argv.index("--coordinator")
        if coord_index + 1 < len(sys.argv):
            coordinator_program = sys.argv[coord_index + 1]
        else:
            print("Error: --coordinator flag requires a program (BSCS, BSIT, BSEMC, ACT)")
            sys.exit(1)
    except (ValueError, IndexError):
        print("Error: --coordinator flag requires a program (BSCS, BSIT, BSEMC, ACT)")
        sys.exit(1)

if role not in ("admin", "faculty"):
    print(f"Invalid role '{role}'. Use 'admin' or 'faculty'.")
    sys.exit(1)

if is_coordinator and role != "faculty":
    print("Error: --coordinator flag can only be used with 'faculty' role.")
    sys.exit(1)

if is_coordinator and not coordinator_program:
    print("Error: Coordinator program must be specified (BSCS, BSIT, BSEMC, ACT)")
    sys.exit(1)

claims = {"role": role}
if is_coordinator:
    claims["isCoordinator"] = True
    claims["coordinatorProgram"] = coordinator_program

auth.set_custom_user_claims(uid, claims)
print(f"Done. Role '{role}' set on user {uid}.")
if is_coordinator:
    print(f"Coordinator access granted for program: {coordinator_program}")
print("The user must log out and back in for the new role to take effect.")
