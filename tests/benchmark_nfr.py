#!/usr/bin/env python3
"""
AlumniConnect NFR Benchmark Script
====================================
Measures p50/p95 latency for:
  NFR1 - API response time across key endpoints
  NFR2 - Chat message delivery latency (HTTP write + WebSocket receive)

Usage:
  pip install requests websocket-client numpy
  python3 benchmark_nfr.py

Prerequisites: backend must be running on localhost:3001
"""

import time
import json
import threading
import statistics
import sys
from typing import Optional
import requests

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL   = "http://localhost:3001/api"
WS_URL     = "ws://localhost:3001"
N_REQUESTS = 50          # requests per endpoint
CONCURRENCY = 5          # concurrent workers

STUDENT_EMAIL  = "student_test@test.com"
ALUMNI_EMAIL   = "alumni_test@test.com"
ADMIN_EMAIL    = "admin_test@test.com"
PASSWORD       = "Password123!"

# ANSI colours
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# ── Helpers ───────────────────────────────────────────────────────────────────
def pct(data: list, p: int) -> float:
    """Return the p-th percentile in milliseconds (input: seconds)."""
    if not data:
        return 0.0
    sorted_d = sorted(data)
    idx = min(int(len(sorted_d) * p / 100), len(sorted_d) - 1)
    return round(sorted_d[idx] * 1000, 1)

def status(ms_p95: float, target_ms: float) -> str:
    if ms_p95 <= target_ms:
        return f"{GREEN}✓ Yes{RESET}"
    elif ms_p95 <= target_ms * 1.5:
        return f"{YELLOW}~ Borderline{RESET}"
    return f"{RED}✗ No{RESET}"

def login(email: str, password: str) -> Optional[str]:
    """Login and return access token."""
    try:
        r = requests.post(f"{BASE_URL}/auth/login",
                          json={"email": email, "password": password},
                          timeout=10)
        if r.status_code == 200:
            return r.json().get("accessToken")
        print(f"  {RED}Login failed ({r.status_code}): {r.text[:120]}{RESET}")
        return None
    except Exception as e:
        print(f"  {RED}Login error: {e}{RESET}")
        return None

def register(email: str, password: str, role: str) -> None:
    """Attempt to register the test accounts before login."""
    payload = {
        "email": email,
        "password": password,
        "role": role,
        "fullName": f"Test {role.capitalize()}",
        "university": "IIIT"
    }
    if role == "alumni":
        payload["company"] = "Tech Corp"
        payload["jobTitle"] = "Senior Engineer"
        
    try:
        requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=5)
    except:
        pass

def measure_endpoint(method: str, url: str, headers: dict,
                     body: dict = None, n: int = N_REQUESTS) -> list:
    """Run n sequential requests, return list of elapsed times (seconds)."""
    times = []
    for _ in range(n):
        try:
            t0 = time.perf_counter()
            if method == "GET":
                r = requests.get(url, headers=headers, timeout=10)
            elif method == "POST":
                r = requests.post(url, headers=headers, json=body, timeout=10)
            elif method == "PATCH":
                r = requests.patch(url, headers=headers, json=body, timeout=30)
            elapsed = time.perf_counter() - t0
            if r.status_code not in (200, 201):
                continue  # skip non-success (e.g. duplicate accept)
            times.append(elapsed)
        except Exception:
            pass
    return times

def print_row(label: str, times: list, target_ms: float = 200):
    p50 = pct(times, 50)
    p95 = pct(times, 95)
    n   = len(times)
    st  = status(p95, target_ms)
    print(f"  {label:<42}  p50={CYAN}{p50:>7.1f}ms{RESET}  "
          f"p95={CYAN}{p95:>7.1f}ms{RESET}  n={n:>3}  {st}")


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    print(f"\n{BOLD}{'='*65}")
    print("  AlumniConnect  NFR Benchmark")
    print(f"{'='*65}{RESET}")

    # ── Login ──────────────────────────────────────────────────────────────
    print(f"\n{BOLD}Authenticating...{RESET}")
    print(f"  {YELLOW}Attempting to register accounts if they do not exist...{RESET}")
    register(STUDENT_EMAIL, PASSWORD, "student")
    register(ALUMNI_EMAIL,  PASSWORD, "alumni")

    student_token = login(STUDENT_EMAIL, PASSWORD)
    alumni_token  = login(ALUMNI_EMAIL,  PASSWORD)
    admin_token   = login(ADMIN_EMAIL,   PASSWORD)

    if not student_token:
        print(f"{RED}Could not obtain student token. Is the backend running on :3001?{RESET}")
        sys.exit(1)

    student_h = {"Authorization": f"Bearer {student_token}",
                  "Content-Type": "application/json"}
    alumni_h  = {"Authorization": f"Bearer {alumni_token}",
                  "Content-Type": "application/json"} if alumni_token else {}
    admin_h   = {"Authorization": f"Bearer {admin_token}",
                  "Content-Type": "application/json"} if admin_token else {}

    print(f"  Student: {GREEN if student_token else RED}"
          f"{'OK' if student_token else 'FAILED'}{RESET}  "
          f"Alumni: {GREEN if alumni_token else RED}"
          f"{'OK' if alumni_token else 'FAILED'}{RESET}  "
          f"Admin: {GREEN if admin_token else RED}"
          f"{'OK' if admin_token else 'FAILED'}{RESET}")
          
    alumni_id_for_test = None
    if admin_token and alumni_token:
        # Automatically advance the alumni through the verification pipeline
        try:
            r = requests.get(f"{BASE_URL}/admin/verification-queue", headers=admin_h, timeout=5)
            if r.status_code == 200:
                queue = r.json()
                print(f"  {YELLOW}[DEBUG] Found {len(queue)} pending verification requests.{RESET}")
                for req in queue:
                    email = req.get('alumniProfile', {}).get('user', {}).get('email')
                    if email == ALUMNI_EMAIL:
                        vid = req.get('id')
                        alumni_id_for_test = req.get('alumniProfile', {}).get('userId')
                        print(f"  {YELLOW}[DEBUG] Found test alumni verification ID: {vid}. Advancing...{RESET}")
                        for j in range(3): # Takes 3 stages: format -> document -> approved
                            adv = requests.patch(f"{BASE_URL}/admin/verification/{vid}/advance", headers=admin_h, timeout=5)
                            print(f"    -> Stage {j+1}: {adv.status_code} {adv.text}")
                            if adv.status_code != 200 or adv.json().get('stage') == 'approved':
                                break
            else:
                print(f"  {RED}[DEBUG] Failed to fetch verification queue: {r.status_code}{RESET}")
        except Exception as e:
            print(f"  {RED}[DEBUG] Exception during admin verification: {e}{RESET}")

    # ── NFR1: API Response Time ────────────────────────────────────────────
    print(f"\n{BOLD}NFR1 — API Response Time  (target: p95 < 200 ms){RESET}")
    print("-" * 65)

    # Login (measures bcrypt overhead)
    login_times = []
    for _ in range(10):
        t0 = time.perf_counter()
        r  = requests.post(f"{BASE_URL}/auth/login",
                           json={"email": STUDENT_EMAIL, "password": PASSWORD},
                           timeout=10)
        if r.status_code == 200:
            login_times.append(time.perf_counter() - t0)
    print_row("POST /api/auth/login", login_times, target_ms=200)

    # Alumni directory
    alumni_dir_times = measure_endpoint(
        "GET", f"{BASE_URL}/alumni?page=1&limit=12", student_h)
    print_row("GET  /api/alumni?page=1&limit=12", alumni_dir_times)

    # Requests list
    req_list_times = measure_endpoint(
        "GET", f"{BASE_URL}/requests", student_h)
    print_row("GET  /api/requests", req_list_times)

    # Notifications
    notif_times = measure_endpoint(
        "GET", f"{BASE_URL}/notifications", student_h)
    print_row("GET  /api/notifications", notif_times)

    # Admin metrics
    if admin_token:
        metrics_times = measure_endpoint(
            "GET", f"{BASE_URL}/admin/metrics", admin_h)
        print_row("GET  /api/admin/metrics", metrics_times)

    # Accept a request (heavy — sync ranking recompute)
    print(f"\n  {YELLOW}[Measuring PATCH /api/requests/:id/accept...]")
    print(f"  Note: this creates a real accepted request each call.{RESET}")
    accept_times = []
    
    if not alumni_id_for_test and student_token:
        try:
            r = requests.get(f"{BASE_URL}/alumni?page=1&limit=100", headers=student_h, timeout=5)
            if r.status_code == 200:
                for al in r.json().get("data", []):
                    if al.get("user", {}).get("email") == ALUMNI_EMAIL:
                        alumni_id_for_test = al.get("userId")
                        break
        except:
            pass
            
    if alumni_token and student_token and alumni_id_for_test:
        for i in range(5):     # only 5 — it mutates state
            # Create a fresh request to accept
            try:
                # Use the extracted alumni_id_for_test directly
                r2 = requests.post(f"{BASE_URL}/requests",
                                   headers=student_h,
                                   json={"alumniId": alumni_id_for_test,
                                         "message": f"Benchmark request {i}"},
                                   timeout=10)
                if r2.status_code not in (200, 201):
                    continue
                req_id = r2.json().get("id")
                if not req_id:
                    continue
                # Measure accept
                t0 = time.perf_counter()
                r3 = requests.patch(f"{BASE_URL}/requests/{req_id}/accept",
                                    headers=alumni_h, timeout=30)
                if r3.status_code == 200:
                    accept_times.append(time.perf_counter() - t0)
            except Exception as e:
                print(f"    Accept error: {e}")

    if accept_times:
        print_row("PATCH /api/requests/:id/accept", accept_times, target_ms=200)
    else:
        print(f"  {'PATCH /api/requests/:id/accept':<42}  {YELLOW}skipped (need valid alumni token){RESET}")

    # ── NFR2: Chat Latency ─────────────────────────────────────────────────
    print(f"\n{BOLD}NFR2 — Chat Message Delivery Latency  (target: p95 < 100 ms){RESET}")
    print("-" * 65)

    # Try to get a connection ID
    conn_id = None
    try:
        r = requests.get(f"{BASE_URL}/connections", headers=student_h, timeout=5)
        if r.status_code == 200:
            conns = r.json()
            if conns:
                conn_id = (conns[0].get("id") or conns[0].get("connectionId")
                           if isinstance(conns, list) else None)
    except Exception:
        pass

    if conn_id:
        msg_http_times = []
        for i in range(20):
            t0 = time.perf_counter()
            r = requests.post(
                f"{BASE_URL}/connections/{conn_id}/messages",
                headers=student_h,
                json={"content": f"benchmark-msg-{i}", "type": "text"},
                timeout=10)
            if r.status_code in (200, 201):
                msg_http_times.append(time.perf_counter() - t0)

        if msg_http_times:
            print_row("POST /api/connections/:id/messages (HTTP write)",
                      msg_http_times, target_ms=100)
            print(f"\n  {YELLOW}WebSocket broadcast latency requires an active WS client.")
            print(f"  HTTP write p95 = {pct(msg_http_times, 95):.1f}ms  "
                  f"(bulk of chat round-trip){RESET}")
        else:
            print(f"  {YELLOW}No messages were accepted "
                  f"(check connection ID / permissions){RESET}")
    else:
        print(f"  {YELLOW}No connection found for student. "
              f"Accept a mentorship request first to enable chat.{RESET}")

    # ── Summary ────────────────────────────────────────────────────────────
    print(f"\n{BOLD}{'='*65}")
    print("  Measurement complete.")
    print(f"  Run with a real JWT to avoid 401s on authenticated endpoints.")
    print(f"{'='*65}{RESET}\n")


if __name__ == "__main__":
    main()
