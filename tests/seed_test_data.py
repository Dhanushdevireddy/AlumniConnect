"""
seed_test_data.py — Create test users in the AlumniConnect database via REST API.

Run ONCE before the test suite:
    python seed_test_data.py

Safe to re-run: if the user already exists the script skips silently.
"""

import sys
import requests

API = "http://localhost:3001/api"

USERS = [
    {
        "fullName": "Test Student",
        "email": "student_test@test.com",
        "password": "Password123!",
        "role": "student",
        "university": "IIT Madras",
    },
    {
        "fullName": "Test Alumni",
        "email": "alumni_test@test.com",
        "password": "Password123!",
        "role": "alumni",
        "company": "Acme Corp",
        "jobTitle": "Software Engineer",
    },
]


def seed():
    print("Seeding test users …")
    ok = True
    for u in USERS:
        try:
            resp = requests.post(f"{API}/auth/register", json=u, timeout=10)
            if resp.status_code == 201:
                print(f"   Created  {u['email']} ({u['role']})")
            elif resp.status_code == 400 and "already" in resp.text.lower():
                print(f"    Exists   {u['email']} ({u['role']})")
            else:
                print(f"   Failed   {u['email']}: {resp.status_code} {resp.text}")
                ok = False
        except requests.ConnectionError:
            print("   Cannot reach backend at", API)
            print("     Make sure the backend is running: npm run dev (in /backend)")
            sys.exit(1)

    print()
    print("Admin account note:")
    print("  The admin test user (admin_test@test.com) must be promoted manually.")
    print("  Either:")
    print("    1. Use Prisma Studio:  cd backend && npm run studio")
    print("       Find the user and change their role to 'admin'.")
    print("    2. Or directly:  UPDATE \"User\" SET role='admin'")
    print("                     WHERE email='admin_test@test.com';")
    print()
    if ok:
        print("Seeding complete. Run your tests with:  pytest -v")
    else:
        print("  Some users failed to be created. Check backend logs.")
        sys.exit(1)


if __name__ == "__main__":
    seed()
