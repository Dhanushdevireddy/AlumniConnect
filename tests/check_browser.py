import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.by import By

opts = ChromeOptions()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1400,900")
opts.add_argument("--disable-gpu")
driver = webdriver.Chrome(options=opts)

driver.get("http://localhost:5173")
time.sleep(3)
driver.save_screenshot("test_screen.png")
with open("test_page.html", "w") as f:
    f.write(driver.page_source)
driver.quit()
print("Saved screenshot and page source to test_screen.png and test_page.html")
