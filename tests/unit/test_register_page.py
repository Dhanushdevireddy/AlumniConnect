"""
unit/test_register_page.py — Unit-level tests for the Register page.

Tests validate structural presence, role-toggle field visibility,
and the alumni disclaimer notice.

Markers: @pytest.mark.unit
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://localhost:5173"
WAIT     = 10


# ── Open register page ────────────────────────────────────────────────────────

def open_register(driver):
    """Navigate to the app and switch to the Register form."""
    driver.get(BASE_URL)
    w = WebDriverWait(driver, WAIT)
    w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
    driver.find_element(By.XPATH, "//*[contains(text(),'Create one')]").click()
    w.until(EC.visibility_of_element_located(
        (By.XPATH, "//*[contains(text(),'Create account')]")
    ))
    return w


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.unit
def test_full_name_input_present(driver):
    """Full Name input field is visible on the register form."""
    open_register(driver)
    # The full-name input has no specific type; find by placeholder
    el = driver.find_element(By.CSS_SELECTOR, "input.form-input[placeholder]")
    assert el.is_displayed()


@pytest.mark.unit
def test_register_email_input_present(driver):
    """Email input is present on the register form."""
    open_register(driver)
    el = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
    assert el.is_displayed()


@pytest.mark.unit
def test_register_password_input_present(driver):
    """Password input is present on the register form."""
    open_register(driver)
    el = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
    assert el.is_displayed()


@pytest.mark.unit
def test_role_buttons_present(driver):
    """Student and Alumni role toggle buttons are visible."""
    open_register(driver)
    page = driver.page_source
    assert "Student" in page
    assert "Alumni"  in page


@pytest.mark.unit
def test_student_role_shows_university_field(driver):
    """Selecting the Student role reveals the University field."""
    open_register(driver)
    # Click the Student button
    student_btn = driver.find_element(
        By.XPATH, "//button[contains(text(),'Student')]"
    )
    student_btn.click()
    # University placeholder should appear
    uni_inputs = driver.find_elements(
        By.CSS_SELECTOR, "input.form-input[placeholder*='IIT'], input.form-input[placeholder*='niversity']"
    )
    assert any(i.is_displayed() for i in uni_inputs), "University field not shown for Student role"


@pytest.mark.unit
def test_alumni_role_shows_company_field(driver):
    """Selecting the Alumni role reveals Company and Job Title fields."""
    open_register(driver)
    alumni_btn = driver.find_element(
        By.XPATH, "//button[contains(text(),'Alumni')]"
    )
    alumni_btn.click()
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located(
            (By.CSS_SELECTOR, "input.form-input[placeholder*='Google']")
        )
    )
    company_input = driver.find_element(
        By.CSS_SELECTOR, "input.form-input[placeholder*='Google']"
    )
    assert company_input.is_displayed()


@pytest.mark.unit
def test_alumni_role_shows_job_title_field(driver):
    """Selecting the Alumni role reveals the Job Title field."""
    open_register(driver)
    alumni_btn = driver.find_element(By.XPATH, "//button[contains(text(),'Alumni')]")
    alumni_btn.click()
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located(
            (By.CSS_SELECTOR, "input.form-input[placeholder*='Engineer']")
        )
    )
    job_input = driver.find_element(
        By.CSS_SELECTOR, "input.form-input[placeholder*='Engineer']"
    )
    assert job_input.is_displayed()


@pytest.mark.unit
def test_alumni_disclaimer_shown(driver):
    """After choosing Alumni, the verification notice is displayed."""
    open_register(driver)
    alumni_btn = driver.find_element(By.XPATH, "//button[contains(text(),'Alumni')]")
    alumni_btn.click()
    WebDriverWait(driver, WAIT).until(
        lambda d: "admin verification" in d.page_source.lower()
                  or "verification" in d.page_source.lower()
    )
    assert "verification" in driver.page_source.lower()


@pytest.mark.unit
def test_create_account_button_present(driver):
    """'Create Account' submit button is visible and enabled."""
    open_register(driver)
    btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
    assert btn.is_displayed()
    assert btn.is_enabled()
    assert "Create Account" in btn.text


@pytest.mark.unit
def test_switch_back_to_login(driver):
    """Clicking 'Sign in' on Register page returns to Login form."""
    w = open_register(driver)
    sign_in_link = driver.find_element(
        By.XPATH, "//button[contains(text(),'Sign in')]"
    )
    sign_in_link.click()
    w.until(EC.visibility_of_element_located(
        (By.XPATH, "//*[contains(text(),'Welcome back')]")
    ))
    assert "Welcome back" in driver.page_source


@pytest.mark.unit
def test_register_heading_visible(driver):
    """'Create account' heading is visible."""
    open_register(driver)
    heading = driver.find_element(By.CSS_SELECTOR, "h1.auth-title")
    assert "Create account" in heading.text
