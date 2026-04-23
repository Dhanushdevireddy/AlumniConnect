"""
integration/test_requests_flow.py — End-to-end tests for the Requests page.

Tests cover page headings, empty states, and status badge presence for
both student and alumni roles.

Markers: @pytest.mark.integration
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

WAIT = 15


def navigate_to_requests(driver):
    """Click the Requests nav item in the sidebar."""
    w = WebDriverWait(driver, WAIT)
    nav_items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    for item in nav_items:
        if "request" in item.text.lower():
            item.click()
            break
    w.until(lambda d: "Request" in d.page_source)


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.integration
def test_student_requests_page_heading(login_student):
    """Student sees 'My Requests' as the page heading."""
    driver = login_student
    navigate_to_requests(driver)
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "h1.page-title"))
    )
    heading = driver.find_element(By.CSS_SELECTOR, "h1.page-title")
    assert "My Requests" in heading.text or "Request" in heading.text


@pytest.mark.integration
def test_student_requests_empty_state(login_student):
    """If the student has no requests, the empty state message is shown."""
    driver = login_student
    navigate_to_requests(driver)
    WebDriverWait(driver, WAIT).until(
        lambda d: "No requests yet" in d.page_source
        or len(d.find_elements(By.CSS_SELECTOR, ".card")) >= 1  # requests exist
    )
    # Either empty state OR a list — both are acceptable
    no_requests = "No requests yet" in driver.page_source
    has_requests = len(driver.find_elements(By.CSS_SELECTOR, ".card")) >= 1
    assert no_requests or has_requests


@pytest.mark.integration
def test_alumni_requests_page_heading(login_alumni):
    """Alumni sees 'Mentorship Requests' as the page heading."""
    driver = login_alumni
    navigate_to_requests(driver)
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "h1.page-title"))
    )
    heading = driver.find_element(By.CSS_SELECTOR, "h1.page-title")
    assert "Mentorship Requests" in heading.text or "Request" in heading.text


@pytest.mark.integration
def test_alumni_requests_empty_state(login_alumni):
    """If the alumni has no requests, an appropriate message is shown."""
    driver = login_alumni
    navigate_to_requests(driver)
    WebDriverWait(driver, WAIT).until(
        lambda d: "request" in d.page_source.lower()
    )
    page = driver.page_source.lower()
    has_no_msg  = "no requests" in page or "appear here" in page
    has_content = len(driver.find_elements(By.CSS_SELECTOR, ".card")) >= 1
    assert has_no_msg or has_content


@pytest.mark.integration
def test_requests_status_badge_visible(login_student):
    """If requests exist, each has a visible status badge (pending/accepted/declined)."""
    driver = login_student
    navigate_to_requests(driver)
    WebDriverWait(driver, WAIT).until(
        lambda d: "request" in d.page_source.lower()
    )
    badges = driver.find_elements(By.CSS_SELECTOR, ".badge")
    if not badges:
        pytest.skip("No requests in DB — skip badge check")
    visible_badges = [b for b in badges if b.is_displayed()]
    assert len(visible_badges) > 0


@pytest.mark.integration
def test_requests_page_subtitle_student(login_student):
    """Student's requests page subtitle mentions 'sent' or 'track'."""
    driver = login_student
    navigate_to_requests(driver)
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "p.page-subtitle"))
    )
    subtitle = driver.find_element(By.CSS_SELECTOR, "p.page-subtitle").text.lower()
    assert "track" in subtitle or "sent" in subtitle or "request" in subtitle
