"""
integration/test_sessions_flow.py — End-to-end tests for the Sessions page.

Tests cover page heading, connections sidebar, empty state, and the
propose-session modal for connected users.

Markers: @pytest.mark.integration
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

WAIT = 15


def navigate_to_sessions(driver):
    """Click Sessions in the sidebar nav."""
    w = WebDriverWait(driver, WAIT)
    nav_items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    for item in nav_items:
        if "session" in item.text.lower():
            item.click()
            break
    w.until(lambda d: "Session" in d.page_source)


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.integration
def test_sessions_page_heading(login_student):
    """Sessions page heading is visible."""
    driver = login_student
    navigate_to_sessions(driver)
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "h1.page-title"))
    )
    heading = driver.find_element(By.CSS_SELECTOR, "h1.page-title")
    assert "Session" in heading.text


@pytest.mark.integration
def test_sessions_page_subtitle(login_student):
    """Sessions page subtitle mentions scheduling or virtual sessions."""
    driver = login_student
    navigate_to_sessions(driver)
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "p.page-subtitle"))
    )
    subtitle = driver.find_element(By.CSS_SELECTOR, "p.page-subtitle").text.lower()
    assert "session" in subtitle or "schedul" in subtitle or "mentor" in subtitle


@pytest.mark.integration
def test_connections_panel_visible(login_student):
    """'Your Connections' panel is rendered on the sessions page."""
    driver = login_student
    navigate_to_sessions(driver)
    WebDriverWait(driver, WAIT).until(
        lambda d: "Your Connections" in d.page_source
    )
    assert "Your Connections" in driver.page_source


@pytest.mark.integration
def test_no_connections_shows_placeholder(login_student):
    """If the student has no connections, the connections panel shows empty text."""
    driver = login_student
    navigate_to_sessions(driver)
    WebDriverWait(driver, WAIT).until(
        lambda d: "Your Connections" in d.page_source
    )
    page = driver.page_source.lower()
    # Either 'no connections' text or connection items
    has_empty_msg   = "no connections" in page
    has_connections = len(driver.find_elements(By.CSS_SELECTOR, ".connection-item")) > 0
    assert has_empty_msg or has_connections


@pytest.mark.integration
def test_select_connection_prompt_visible(login_student):
    """Without selecting a connection, the right panel shows 'Select a connection'."""
    driver = login_student
    navigate_to_sessions(driver)
    WebDriverWait(driver, WAIT).until(
        lambda d: "Session" in d.page_source
    )
    connections = driver.find_elements(By.CSS_SELECTOR, ".connection-item")
    assert "Select a connection" in driver.page_source


@pytest.mark.integration
def test_propose_session_button_visible_with_connection(login_student):
    """When a connection is selected, '+ Propose Session' button appears."""
    driver = login_student
    navigate_to_sessions(driver)
    WebDriverWait(driver, WAIT).until(
        lambda d: "Your Connections" in d.page_source
    )
    connections = driver.find_elements(By.CSS_SELECTOR, ".connection-item")
    if not connections:
        pytest.skip("No connections — seeded accepted request required")
    # Click first connection
    connections[0].click()
    WebDriverWait(driver, WAIT).until(
        lambda d: "Propose Session" in d.page_source
    )
    propose_btn = driver.find_element(
        By.XPATH, "//*[contains(text(),'Propose Session')]"
    )
    assert propose_btn.is_displayed()


@pytest.mark.integration
def test_propose_session_modal_opens(login_student):
    """Clicking '+ Propose Session' opens the proposal modal with time fields."""
    driver = login_student
    navigate_to_sessions(driver)
    WebDriverWait(driver, WAIT).until(
        lambda d: "Your Connections" in d.page_source
    )
    connections = driver.find_elements(By.CSS_SELECTOR, ".connection-item")
    if not connections:
        pytest.skip("No connections — seeded accepted request required")
    connections[0].click()
    WebDriverWait(driver, WAIT).until(
        lambda d: "Propose Session" in d.page_source
    )
    driver.find_element(By.XPATH, "//button[contains(text(),'Propose Session')]").click()
    WebDriverWait(driver, WAIT).until(
        lambda d: "Start time" in d.page_source or "slotStart" in d.page_source
    )
    time_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='datetime-local']")
    assert len(time_inputs) >= 2, "Expected start and end datetime inputs in modal"
