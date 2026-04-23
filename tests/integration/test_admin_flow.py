"""
integration/test_admin_flow.py — End-to-end tests for the Admin Dashboard.

Tests verify that the admin user has access to the Admin Dashboard and
that regular users cannot see or reach the admin panel.

Note: admin_test@test.com must be promoted to role='admin' manually in the DB
(see seed_test_data.py output for instructions).

Markers: @pytest.mark.integration
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

WAIT = 15


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.integration
def test_admin_dashboard_heading_visible(login_admin):
    """Admin Dashboard page heading is rendered after admin login."""
    driver = login_admin
    WebDriverWait(driver, WAIT).until(
        lambda d: "Admin" in d.page_source
    )
    heading = driver.find_element(By.CSS_SELECTOR, "h1.page-title")
    assert "Admin" in heading.text


@pytest.mark.integration
def test_admin_nav_shows_admin_dashboard_item(login_admin):
    """Admin's sidebar nav contains an 'Admin Dashboard' item."""
    driver = login_admin
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar"))
    )
    nav_items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    labels = [i.text for i in nav_items]
    assert any("Admin" in l for l in labels), f"Admin nav item missing: {labels}"


@pytest.mark.integration
def test_admin_nav_shows_notifications_item(login_admin):
    """Admin's sidebar nav contains a Notifications item."""
    driver = login_admin
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar"))
    )
    nav_items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    labels = [i.text for i in nav_items]
    assert any("Notification" in l for l in labels), f"Notifications item missing: {labels}"


@pytest.mark.integration
def test_admin_role_badge_visible(login_admin):
    """'admin' role badge is displayed in the sidebar."""
    driver = login_admin
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar"))
    )
    badge = driver.find_element(By.CSS_SELECTOR, ".badge-danger")
    assert "admin" in badge.text.lower()


@pytest.mark.integration
def test_admin_nav_does_not_show_directory(login_admin):
    """Admin sidebar does NOT show Alumni Directory (student-only)."""
    driver = login_admin
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar"))
    )
    nav_items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    labels = [i.text for i in nav_items]
    assert not any("Directory" in l for l in labels), f"Admin should not see Directory: {labels}"


@pytest.mark.integration
def test_student_cannot_see_admin_nav(login_student):
    """Student's sidebar does NOT contain an Admin Dashboard link."""
    driver = login_student
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar"))
    )
    nav_items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    labels = [i.text for i in nav_items]
    assert not any("Admin" in l for l in labels), f"Student should not see Admin nav: {labels}"


@pytest.mark.integration
def test_alumni_cannot_see_admin_nav(login_alumni):
    """Alumni's sidebar does NOT contain an Admin Dashboard link."""
    driver = login_alumni
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".sidebar"))
    )
    nav_items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    labels = [i.text for i in nav_items]
    assert not any("Admin" in l for l in labels), f"Alumni should not see Admin nav: {labels}"
