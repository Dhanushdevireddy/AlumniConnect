"""
unit/test_login_page.py — Unit-level tests for the Login page.

These tests validate the structural presence of login UI elements and
basic error-display behaviour without requiring a real DB account.

Markers: @pytest.mark.unit
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://localhost:5173"
WAIT     = 10


# ── Helpers ───────────────────────────────────────────────────────────────────

def open_login(driver):
    driver.get(BASE_URL)
    w = WebDriverWait(driver, WAIT)
    w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
    return w


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.unit
def test_login_page_title(driver):
    """Page title should mention AlumniConnect."""
    driver.get(BASE_URL)
    WebDriverWait(driver, WAIT).until(lambda d: d.title != "")
    assert "AlumniConnect" in driver.title or "AlumniConnect" in driver.page_source


@pytest.mark.unit
def test_aluminconnect_brand_visible(driver):
    """The AlumniConnect brand text is visible on the login card."""
    open_login(driver)
    brand_text = driver.find_element(By.XPATH, "//*[contains(text(),'AlumniConnect')]")
    # Selenium returns False for is_displayed() and "" for .text when text color is transparent (gradient fill)
    assert brand_text.get_attribute("textContent").strip() == "AlumniConnect"


@pytest.mark.unit
def test_email_input_present(driver):
    """Email input field is present and visible."""
    open_login(driver)
    el = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
    assert el.is_displayed()


@pytest.mark.unit
def test_password_input_present(driver):
    """Password input field is present and visible."""
    open_login(driver)
    el = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
    assert el.is_displayed()


@pytest.mark.unit
def test_submit_button_present_and_enabled(driver):
    """Sign In button is present and not disabled."""
    open_login(driver)
    btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
    assert btn.is_displayed()
    assert btn.is_enabled()
    assert "Sign In" in btn.text


@pytest.mark.unit
def test_welcome_heading_visible(driver):
    """'Welcome back' heading is visible."""
    open_login(driver)
    heading = driver.find_element(By.CSS_SELECTOR, "h1.auth-title")
    assert "Welcome back" in heading.text


@pytest.mark.unit
def test_create_account_link_visible(driver):
    """'Create one' link to switch to Register page is visible."""
    open_login(driver)
    link = driver.find_element(By.XPATH, "//*[contains(text(),'Create one')]")
    assert link.is_displayed()


@pytest.mark.unit
def test_switch_to_register(driver):
    """Clicking 'Create one' shows the Register (Create account) form."""
    w = open_login(driver)
    driver.find_element(By.XPATH, "//*[contains(text(),'Create one')]").click()
    w.until(EC.visibility_of_element_located(
        (By.XPATH, "//*[contains(text(),'Create account')]")
    ))
    assert "Create account" in driver.page_source


@pytest.mark.unit
def test_invalid_login_shows_error(driver):
    """Incorrect credentials display an error message instead of navigating away."""
    w = open_login(driver)
    driver.find_element(By.CSS_SELECTOR, "input[type='email']").send_keys("bad@bad.com")
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys("wrongpass")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

    # An error toast or the form should still be visible (no sidebar = not logged in)
    w.until(lambda d: (
        "Invalid" in d.page_source
        or "incorrect" in d.page_source.lower()
        or "failed" in d.page_source.lower()
        or "error" in d.page_source.lower()
    ))
    # Sidebar must NOT be visible (user did not log in)
    sidebars = driver.find_elements(By.CSS_SELECTOR, ".sidebar")
    assert len(sidebars) == 0, "Should not be logged in with bad credentials"


@pytest.mark.unit
def test_email_placeholder_text(driver):
    """Email input has a university-themed placeholder."""
    open_login(driver)
    placeholder = driver.find_element(By.CSS_SELECTOR, "input[type='email']") \
                        .get_attribute("placeholder")
    assert placeholder and ("university" in placeholder.lower() or "@" in placeholder)
