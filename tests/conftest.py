"""
conftest.py — Shared pytest fixtures for the AlumniConnect Selenium test suite.

This file AUTOMATICALLY starts the backend and frontend dev servers before
the test session begins, seeds test users, and shuts them down afterwards.
No manual server startup is required.

Prerequisites:
  - PostgreSQL running with the alumniconnect DB (see backend/.env)
  - Redis running (used by BullMQ jobs)
  - Node.js + npm installed
  - Python venv activated with: source .venv/bin/activate
"""

import os
import time
import signal
import subprocess
import requests as http_requests
import pytest

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# ──────────────────────────────────────────────
# Paths & configuration
# ──────────────────────────────────────────────

_TESTS_DIR   = os.path.dirname(os.path.abspath(__file__))
_ROOT_DIR    = os.path.dirname(_TESTS_DIR)
_BACKEND_DIR = os.path.join(_ROOT_DIR, "backend")
_FRONTEND_DIR = os.path.join(_ROOT_DIR, "frontend")

BASE_URL = "http://localhost:5173"
API_URL  = "http://localhost:3001/api"

TEST_STUDENT = {"email": "student_test@test.com", "password": "Password123!"}
TEST_ALUMNI  = {"email": "alumni_test@test.com",  "password": "Password123!"}
TEST_ADMIN   = {"email": "admin_test@test.com",   "password": "Password123!"}

DEFAULT_WAIT   = 10   # selenium wait seconds
SERVER_TIMEOUT = 60   # max seconds to wait for a server to become healthy


# ──────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────

def _wait_for_http(url: str, timeout: int, label: str) -> None:
    """Poll `url` until it responds (any status) or timeout is reached."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            http_requests.get(url, timeout=3)
            print(f"\n   {label} is ready at {url}")
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError(
        f" {label} did not become ready at {url} within {timeout}s.\n"
        "   Check that PostgreSQL and Redis are running."
    )


def _seed_users() -> None:
    """Create test student + alumni accounts (idempotent)."""
    users = [
        {
            "fullName": "Test Student",
            "email": TEST_STUDENT["email"],
            "password": TEST_STUDENT["password"],
            "role": "student",
            "university": "IIT Madras",
        },
        {
            "fullName": "Test Alumni",
            "email": TEST_ALUMNI["email"],
            "password": TEST_ALUMNI["password"],
            "role": "alumni",
            "company": "Acme Corp",
            "jobTitle": "Software Engineer",
        },
    ]
    for u in users:
        try:
            resp = http_requests.post(f"{API_URL}/auth/register", json=u, timeout=10)
            if resp.status_code == 201:
                print(f"   Seeded  {u['email']}")
            else:
                # 400 "already exists" is fine — just skip
                print(f"    Exists  {u['email']} (skipped)")
        except Exception as e:
            print(f"    Seed skipped for {u['email']}: {e}")


# ──────────────────────────────────────────────
# Session-scoped autouse fixture: start servers
# ──────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def start_servers():
    """
    Start the Express backend and Vite frontend dev servers for the entire
    test session, then tear them down when the session ends.
    """
    procs = []

    # ── 0. Start DB / Redis ─────────────────────────────────────────────────
    print("\n Starting PostgreSQL and Redis via Docker …")
    subprocess.run(["docker", "rm", "-f", "alumniconnect_pg_test", "alumniconnect_redis_test"], stderr=subprocess.DEVNULL)
    
    subprocess.Popen([
        "docker", "run", "--rm", "--name", "alumniconnect_pg_test",
        "-p", "5433:5432",
        "-e", "POSTGRES_PASSWORD=postgres",
        "-e", "POSTGRES_DB=alumniconnect",
        "postgres"
    ], stdout=subprocess.DEVNULL)
    
    subprocess.Popen([
        "docker", "run", "--rm", "--name", "alumniconnect_redis_test",
        "-p", "6380:6379",
        "redis"
    ], stdout=subprocess.DEVNULL)
    
    # Wait for pg to be ready
    for _ in range(30):
        if subprocess.run(["docker", "exec", "alumniconnect_pg_test", "pg_isready", "-U", "postgres"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError("Postgres did not start in time")
    
    env = os.environ.copy()
    env["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5433/alumniconnect?schema=public"
    env["REDIS_URL"] = "redis://localhost:6380"

    print(" Pushing DB schema …")
    subprocess.run(["npx", "prisma", "db", "push"], cwd=_BACKEND_DIR, env=env, check=True)

    # ── 1. Start backend ────────────────────────────────────────────────────
    print(" Starting backend (npm run dev) …")
    backend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=_BACKEND_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,   # create a new process group for clean kill
    )
    procs.append(backend_proc)

    _wait_for_http(f"{API_URL}/auth/login", SERVER_TIMEOUT, "Backend")

    # ── 2. Seed test users ──────────────────────────────────────────────────
    print(" Seeding test users …")
    _seed_users()
    subprocess.run(["npx", "ts-node", "seed_admin.ts"], cwd=_BACKEND_DIR, env=env, check=True)

    # ── 3. Start frontend ───────────────────────────────────────────────────
    print(" Starting frontend (npm run dev) …")
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=_FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
    )
    procs.append(frontend_proc)

    _wait_for_http(BASE_URL, SERVER_TIMEOUT, "Frontend")

    # ── Run tests ───────────────────────────────────────────────────────────
    yield

    # ── Teardown: stop both servers ─────────────────────────────────────────
    print("\n Stopping dev servers …")
    for proc in procs:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            proc.wait(timeout=10)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    print("  Done.")
    print(" Stopping containers …")
    subprocess.run(["docker", "stop", "alumniconnect_pg_test", "alumniconnect_redis_test"], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_url():
    return API_URL


@pytest.fixture(scope="session")
def session_driver(start_servers):  # depends on start_servers to ensure order
    """Create a headless Chrome WebDriver; tear it down after session ends."""
    print("\n[DEBUG] Starting Chrome driver...")
    opts = ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1400,900")
    opts.add_argument("--disable-gpu")

    # Use Selenium 4's built-in manager
    d = webdriver.Chrome(options=opts)
    d.implicitly_wait(5)
    print("[DEBUG] Chrome driver started successfully.")
    yield d
    d.quit()

@pytest.fixture(scope="function")
def driver(session_driver):
    """Provides a fresh state in the shared webdriver for each test."""
    print("[DEBUG] driver fixture: calling get(BASE_URL)")
    session_driver.get(BASE_URL)
    print("[DEBUG] driver fixture: clearing cookies and storage")
    session_driver.delete_all_cookies()
    session_driver.execute_script("window.localStorage.clear(); window.sessionStorage.clear();")
    print("[DEBUG] driver fixture: reloading cleanly")
    session_driver.get(BASE_URL) # Reload cleanly
    print("[DEBUG] driver fixture: ready")
    yield session_driver


@pytest.fixture(scope="function")
def wait(driver):
    """Returns a WebDriverWait bound to the current driver."""
    return WebDriverWait(driver, DEFAULT_WAIT)


# ──────────────────────────────────────────────
# Role-login helper fixtures
# ──────────────────────────────────────────────

def _do_login(driver, email: str, password: str):
    """Navigate to the app and log in with the given credentials."""
    driver.get(BASE_URL)
    w = WebDriverWait(driver, DEFAULT_WAIT)
    email_input = w.until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='email']"))
    )
    email_input.clear()
    email_input.send_keys(email)

    pw_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
    pw_input.clear()
    pw_input.send_keys(password)

    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

    # Wait until sidebar appears (indicates successful login)
    w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar")))


@pytest.fixture(scope="function")
def login_student(driver):
    """Log in as the test student user."""
    _do_login(driver, TEST_STUDENT["email"], TEST_STUDENT["password"])
    return driver


@pytest.fixture(scope="function")
def login_alumni(driver):
    """Log in as the test alumni user."""
    _do_login(driver, TEST_ALUMNI["email"], TEST_ALUMNI["password"])
    return driver


@pytest.fixture(scope="function")
def login_admin(driver):
    """Log in as the test admin user."""
    _do_login(driver, TEST_ADMIN["email"], TEST_ADMIN["password"])
    return driver
