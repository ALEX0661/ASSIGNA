"""
Set a custom role claim on a Firebase Auth user.

Usage:
    python scripts/set_role.py <UID> <role>

Example:
    python scripts/set_role.py abc123uid admin
    python scripts/set_role.py xyz789uid faculty

Find the UID in Firebase Console → Authentication → Users → User UID column.
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
    print("Usage: python scripts/set_role.py <UID> <role>")
    print("Roles: admin | faculty")
    sys.exit(1)

uid  = sys.argv[1]
role = sys.argv[2]

if role not in ("admin", "faculty"):
    print(f"Invalid role '{role}'. Use 'admin' or 'faculty'.")
    sys.exit(1)

auth.set_custom_user_claims(uid, {"role": role})
print(f"Done. Role '{role}' set on user {uid}.")
print("The user must log out and back in for the new role to take effect.")
