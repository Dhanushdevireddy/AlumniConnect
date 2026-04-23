"""
integration/test_auth_flow.py — End-to-end authentication flow tests.

Tests cover: student login, alumni login, admin login, and logout.
Requires live backend + frontend and seeded test users.

Markers: @pytest.mark.integration
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://localhost:5173"
WAIT     = 15

# ── Helpers ───────────────────────────────────────────────────────────────────

def do_login(driver, email, password):
    driver.get(BASE_URL)
    w = WebDriverWait(driver, WAIT)
    w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
    driver.find_element(By.CSS_SELECTOR, "input[type='email']").send_keys(email)
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    return w


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.integration
def test_student_login_success(driver):
    """Logging in as student shows Alumni Directory and sidebar."""
    w = do_login(driver, "student_test@test.com", "Password123!")
    # Sidebar should appear
    w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar")))
    assert driver.find_element(By.CSS_SELECTOR, ".sidebar").is_displayed()
    # Alumni Directory heading should be on screen
    w.until(lambda d: "Alumni Directory" in d.page_source)
    assert "Alumni Directory" in driver.page_source


@pytest.mark.integration
def test_alumni_login_success(driver):
    """Logging in as alumni shows Requests page and alumni role badge."""
    w = do_login(driver, "alumni_test@test.com", "Password123!")
    w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar")))
    # Alumni lands on Requests page by default
    w.until(lambda d:
        "Mentorship Requests" in d.page_source
        or "My Requests" in d.page_source
        or "Requests" in d.page_source
    )
    sidebar = driver.find_element(By.CSS_SELECTOR, ".sidebar")
    assert sidebar.is_displayed()
    # Role badge should say 'alumni'
    badges = driver.find_elements(By.CSS_SELECTOR, ".badge")
    role_text = " ".join(b.text for b in badges)
    assert "alumni" in role_text.lower()


@pytest.mark.integration
def test_admin_login_success(driver):
    """Logging in as admin shows Admin Dashboard and admin role badge."""
    w = do_login(driver, "admin_test@test.com", "Password123!")
    w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar")))
    w.until(lambda d: "Admin" in d.page_source)
    assert "Admin" in driver.page_source
    badges = driver.find_elements(By.CSS_SELECTOR, ".badge")
    role_text = " ".join(b.text for b in badges)
    assert "admin" in role_text.lower()


@pytest.mark.integration
def test_logout_flow(driver):
    """Login then click Sign out returns to the Login form."""
    w = do_login(driver, "student_test@test.com", "Password123!")
    # Wait for sidebar
    w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar")))
    # Click Sign out
    logout_btn = driver.find_element(By.XPATH, "//*[contains(text(),'Sign out')]")
    logout_btn.click()
    # Login page should reappear
    w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
    assert driver.find_element(By.CSS_SELECTOR, "input[type='email']").is_displayed()
    # Sidebar must be gone
    sidebars = driver.find_elements(By.CSS_SELECTOR, ".sidebar")
    assert len(sidebars) == 0


@pytest.mark.integration
def test_login_persists_on_reload(driver):
    """After login, refreshing the page keeps the user logged in (localStorage token)."""
    w = do_login(driver, "student_test@test.com", "Password123!")
    w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar")))
    driver.refresh()
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar"))
    )
    assert driver.find_element(By.CSS_SELECTOR, ".sidebar").is_displayed()


@pytest.mark.integration
def test_empty_email_shows_validation(driver):
    """Submitting the login form with an empty email triggers HTML5 validation."""
    driver.get(BASE_URL)
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "button[type='submit']"))
    )
    # Click submit without filling anything
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    # Form should still be visible (no navigation)
    assert driver.find_element(By.CSS_SELECTOR, "input[type='email']").is_displayed()
    sidebars = driver.find_elements(By.CSS_SELECTOR, ".sidebar")
    assert len(sidebars) == 0
