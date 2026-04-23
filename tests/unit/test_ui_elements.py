"""
unit/test_ui_elements.py — Unit-level tests for shared UI elements visible after login.

Tests run after logging in as student and validate that global UI elements
(sidebar, nav items, badges, logout button) are rendered correctly.

Markers: @pytest.mark.unit
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

WAIT = 10


# ── Tests (use login_student fixture from conftest.py) ────────────────────────

@pytest.mark.unit
def test_sidebar_visible(login_student):
    """Sidebar element is rendered after login."""
    driver = login_student
    sidebar = driver.find_element(By.CSS_SELECTOR, ".sidebar")
    assert sidebar.is_displayed()


@pytest.mark.unit
def test_sidebar_logo_text(login_student):
    """'AlumniConnect' brand is visible in the sidebar."""
    driver = login_student
    logo = driver.find_element(By.CSS_SELECTOR, ".sidebar-logo")
    assert "AlumniConnect" in logo.text


@pytest.mark.unit
def test_nav_directory_item(login_student):
    """Alumni Directory nav item is visible for a student."""
    driver = login_student
    items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    labels = [i.text for i in items]
    assert any("Directory" in l for l in labels), f"Directory not in nav items: {labels}"


@pytest.mark.unit
def test_nav_requests_item(login_student):
    """Requests / My Requests nav item is visible for a student."""
    driver = login_student
    items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    labels = [i.text for i in items]
    assert any("Request" in l for l in labels), f"Requests not in nav items: {labels}"


@pytest.mark.unit
def test_nav_messages_item(login_student):
    """Messages nav item is visible for a student."""
    driver = login_student
    items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    labels = [i.text for i in items]
    assert any("Message" in l for l in labels), f"Messages not in nav items: {labels}"


@pytest.mark.unit
def test_nav_sessions_item(login_student):
    """Sessions nav item is visible for a student."""
    driver = login_student
    items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    labels = [i.text for i in items]
    assert any("Session" in l for l in labels), f"Sessions not in nav items: {labels}"


@pytest.mark.unit
def test_nav_notifications_item(login_student):
    """Notifications nav item is visible for a student."""
    driver = login_student
    items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    labels = [i.text for i in items]
    assert any("Notification" in l for l in labels), f"Notifications not in nav items: {labels}"


@pytest.mark.unit
def test_student_role_badge_visible(login_student):
    """'student' role badge is visible in the sidebar."""
    driver = login_student
    badge = driver.find_element(By.CSS_SELECTOR, ".badge-info")
    assert "student" in badge.text.lower()


@pytest.mark.unit
def test_logout_button_present(login_student):
    """Sign out / logout button is present in the sidebar."""
    driver = login_student
    logout_btn = driver.find_element(
        By.XPATH, "//*[contains(text(),'Sign out')]"
    )
    assert logout_btn.is_displayed()
    assert logout_btn.is_enabled()


@pytest.mark.unit
def test_main_content_area_rendered(login_student):
    """The main content area is visible after login."""
    driver = login_student
    main = driver.find_element(By.CSS_SELECTOR, ".main-content")
    assert main.is_displayed()


@pytest.mark.unit
def test_admin_nav_not_shown_for_student(login_student):
    """Admin Dashboard nav link is NOT present for a student."""
    driver = login_student
    items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    labels = [i.text for i in items]
    assert not any("Admin" in l for l in labels), f"Admin link should not appear for student: {labels}"
