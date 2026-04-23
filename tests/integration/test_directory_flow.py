"""
integration/test_directory_flow.py — End-to-end tests for the Alumni Directory page.

Tests browse the alumni directory, apply search/filter, open the request modal,
and verify pagination controls.

Markers: @pytest.mark.integration
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

WAIT = 15


def click_nav(driver, label_fragment: str):
    """Click a sidebar nav item whose text contains the given fragment."""
    nav_items = driver.find_elements(By.CSS_SELECTOR, ".nav-item")
    for item in nav_items:
        if label_fragment.lower() in item.text.lower():
            item.click()
            return
    raise AssertionError(f"Nav item containing '{label_fragment}' not found")


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.integration
def test_directory_page_heading(login_student):
    """Alumni Directory page heading is visible after student login."""
    driver = login_student
    WebDriverWait(driver, WAIT).until(
        lambda d: "Alumni Directory" in d.page_source
    )
    heading = driver.find_element(By.CSS_SELECTOR, "h1.page-title")
    assert "Alumni Directory" in heading.text


@pytest.mark.integration
def test_directory_subtitle_shows_count(login_student):
    """Page subtitle mentions available mentors count."""
    driver = login_student
    WebDriverWait(driver, WAIT).until(
        lambda d: "mentors available" in d.page_source or "Alumni Directory" in d.page_source
    )
    # subtitle contains total mentor count
    subtitle = driver.find_element(By.CSS_SELECTOR, "p.page-subtitle")
    assert "mentor" in subtitle.text.lower()


@pytest.mark.integration
def test_filter_bar_search_input(login_student):
    """Search input in filter bar is present and accepts text."""
    driver = login_student
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".filter-bar"))
    )
    search_input = driver.find_element(
        By.CSS_SELECTOR, ".filter-bar input.form-input"
    )
    assert search_input.is_displayed()
    search_input.send_keys("Engineer")
    assert search_input.get_attribute("value") == "Engineer"


@pytest.mark.integration
def test_filter_bar_company_input(login_student):
    """Company filter input is present."""
    driver = login_student
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".filter-bar"))
    )
    inputs = driver.find_elements(By.CSS_SELECTOR, ".filter-bar input.form-input")
    assert len(inputs) >= 2, "Expected at least search and company inputs"


@pytest.mark.integration
def test_availability_dropdown_options(login_student):
    """Availability dropdown has expected options: available, busy, unavailable."""
    driver = login_student
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".filter-bar select.form-select"))
    )
    sel = driver.find_element(By.CSS_SELECTOR, ".filter-bar select.form-select")
    options = [o.text.lower() for o in sel.find_elements(By.TAG_NAME, "option")]
    assert "available"   in options
    assert "busy"        in options
    assert "unavailable" in options


@pytest.mark.integration
def test_search_narrows_results_or_shows_empty(login_student):
    """Typing a nonsense search string results in fewer cards or 'No mentors found'."""
    driver = login_student
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".filter-bar"))
    )
    search_input = driver.find_elements(By.CSS_SELECTOR, ".filter-bar input.form-input")[0]
    search_input.send_keys("XYZZZZZNONEXISTENT99999")
    WebDriverWait(driver, WAIT).until(
        lambda d: "No mentors found" in d.page_source
        or len(d.find_elements(By.CSS_SELECTOR, ".alumni-card")) == 0
    )
    # Either empty state message OR zero cards
    no_mentors = "No mentors found" in driver.page_source
    zero_cards  = len(driver.find_elements(By.CSS_SELECTOR, ".alumni-card")) == 0
    assert no_mentors or zero_cards


@pytest.mark.integration
def test_request_modal_opens_on_card_click(login_student):
    """Clicking an alumni card opens the Request Mentorship modal."""
    driver = login_student
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".filter-bar"))
    )
    cards = driver.find_elements(By.CSS_SELECTOR, ".alumni-card")
    if not cards:
        pytest.skip("No alumni cards available — seed alumni data to enable this test")
    cards[0].click()
    WebDriverWait(driver, WAIT).until(
        lambda d: "Request Mentorship" in d.page_source
    )
    assert "Request Mentorship" in driver.page_source


@pytest.mark.integration
def test_request_modal_has_message_textarea(login_student):
    """The Request Mentorship modal contains a textarea for the message."""
    driver = login_student
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".filter-bar"))
    )
    cards = driver.find_elements(By.CSS_SELECTOR, ".alumni-card")
    if not cards:
        pytest.skip("No alumni cards — seeded alumni required")
    cards[0].click()
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "textarea.form-textarea"))
    )
    ta = driver.find_element(By.CSS_SELECTOR, "textarea.form-textarea")
    assert ta.is_displayed()


@pytest.mark.integration
def test_request_modal_closes_on_x_button(login_student):
    """Clicking the  Close button closes the modal."""
    driver = login_student
    WebDriverWait(driver, WAIT).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".filter-bar"))
    )
    cards = driver.find_elements(By.CSS_SELECTOR, ".alumni-card")
    if not cards:
        pytest.skip("No alumni cards — seeded alumni required")
    cards[0].click()
    WebDriverWait(driver, WAIT).until(
        lambda d: "Request Mentorship" in d.page_source
    )
    close_btn = driver.find_element(By.XPATH, "//*[contains(text(),'Close')]")
    close_btn.click()
    WebDriverWait(driver, WAIT).until(
        lambda d: "Request Mentorship" not in d.page_source
        or not driver.find_elements(By.CSS_SELECTOR, "textarea.form-textarea")
    )
    textareas = driver.find_elements(By.CSS_SELECTOR, "textarea.form-textarea")
    assert len(textareas) == 0, "Modal should be closed"
