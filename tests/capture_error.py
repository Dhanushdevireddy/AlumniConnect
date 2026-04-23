import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

opts = ChromeOptions()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1400,900")
opts.add_argument("--disable-gpu")
driver = webdriver.Chrome(options=opts)

driver.get("http://localhost:5173")
w = WebDriverWait(driver, 10)
email_input = w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
email_input.send_keys("student_test@test.com")
pw = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
pw.send_keys("Password123!")
driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

time.sleep(3) # wait to see what happens
driver.save_screenshot("login_attempt.png")
print("Screenshot saved to login_attempt.png")
print("Page source snippet:")
print(driver.page_source[-1000:]) # see if there are any toast errors
driver.quit()
