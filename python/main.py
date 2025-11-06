# #!/usr/bin/env python3
# import argparse, json, sys, csv, time, pathlib
# from typing import List, Dict, Any, Optional
# from facebook_scraper import get_posts

# DEFAULT_COOKIES_PATH = pathlib.Path(__file__).resolve().parent.parent / "facebook" / "facebook_cookies.txt"

# def scrape_one(url: str, cookies_path: Optional[str], want_comments: bool, want_reactions: bool, timeout: int) -> Dict[str, Any]:
#     default_user_agent = (
#         "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_1) AppleWebKit/537.36 (KHTML, like Gecko) "
#         "Chrome/129.0.0.0 Safari/537.36"
#     )
#     options = {
#         "comments": want_comments,   # ดึงเนื้อหาคอมเมนต์ (ช้าลง)
#         "reactions": want_reactions, # แยก reaction เป็นรายชนิด
#         "progress": False,
#         "timeout": timeout,
#         "language": "en_US",
#         "allow_extra_requests": True,
#         "posts_per_page": 1,
#         "user_agent": default_user_agent,
#     }
#     if cookies_path:
#         options["cookies"] = cookies_path
#         print(f"[info] using cookies from {cookies_path}", file=sys.stderr)

#     for post in get_posts(post_urls=[url], options=options):
#         print("post" , post, file=sys.stderr)  # debug
#         return {
#             "ok": True,
#             "url": url,
#             "post_url": post.get("post_url"),
#             "post_id": post.get("post_id"),
#             "text": post.get("post_text"),
#             "time": post.get("time").isoformat() if post.get("time") else None,
#             "likes": post.get("likes"),
#             "comments": post.get("comments"),
#             "shares": post.get("shares"),
#             "reactions_by_type": post.get("reactions"),  # dict: like/love/haha...
#             "images": post.get("images"),
#             "user_id": post.get("user_id"),
#             "username": post.get("username"),
#             "fetched_time": post.get("fetched_time").isoformat() if post.get("fetched_time") else None,
#         }
#     return {"ok": False, "url": url, "error": "No post found or not public."}

# def write_csv(rows: List[Dict[str,Any]], csv_path: str):
#     fields = [
#         "url","post_url","post_id","time","likes","comments","shares",
#         "username","user_id","text","images","reactions_by_type"
#     ]
#     p = pathlib.Path(csv_path)
#     p.parent.mkdir(parents=True, exist_ok=True)
#     with p.open("w", newline="", encoding="utf-8") as f:
#         w = csv.DictWriter(f, fieldnames=fields)
#         w.writeheader()
#         for r in rows:
#             if not r.get("ok"): continue
#             row = {k: r.get(k) for k in fields}
#             # แปลง field ที่เป็น list/dict เป็น string เพื่อเขียน CSV
#             if isinstance(row.get("images"), (list, dict)):
#                 row["images"] = json.dumps(row["images"], ensure_ascii=False)
#             if isinstance(row.get("reactions_by_type"), (list, dict)):
#                 row["reactions_by_type"] = json.dumps(row["reactions_by_type"], ensure_ascii=False)
#             w.writerow(row)

# def main():
#     ap = argparse.ArgumentParser(
#         prog="fbgrab",
#         description="Grab Facebook post metrics (likes/comments/shares) via facebook-scraper and output JSON/JSONL/CSV."
#     )
#     gsrc = ap.add_mutually_exclusive_group(required=True)
#     gsrc.add_argument("--url", help="Single post URL")
#     gsrc.add_argument("--infile", help="Text file with one post URL per line")

#     ap.add_argument("--cookies", help="Path to cookies.txt (Netscape format)")
#     ap.add_argument("--comments", action="store_true", help="Fetch comments content (slower)")
#     ap.add_argument("--reactions", action="store_true", help="Fetch reactions by type")
#     ap.add_argument("--timeout", type=int, default=30, help="Request timeout seconds (default: 30)")
#     ap.add_argument("--delay", type=float, default=1.0, help="Delay seconds between URLs when using --infile (default: 1.0)")

#     # outputs
#     ap.add_argument("--json", help="Write all results as a single JSON array to file")
#     ap.add_argument("--jsonl", help="Write JSON Lines to file (1 line per URL)")
#     ap.add_argument("--csv", help="Write CSV to file")
#     ap.add_argument("--stdout", choices=["json", "jsonl", "off"], default="jsonl",
#                     help="What to print to stdout. Default jsonl")

#     args = ap.parse_args()

#     cookies_path = args.cookies
#     if not cookies_path and DEFAULT_COOKIES_PATH.exists():
#         cookies_path = str(DEFAULT_COOKIES_PATH)

#     urls = []
#     if args.url:
#         urls = [args.url.strip()]
#     else:
#         with open(args.infile, encoding="utf-8") as f:
#             urls = [line.strip() for line in f if line.strip()]

#     results = []
#     out_jsonl_lines = []

#     for i, u in enumerate(urls, start=1):
#         try:
#             res = scrape_one(
#                 url=u,
#                 cookies_path=cookies_path,
#                 want_comments=args.comments,
#                 want_reactions=args.reactions,
#                 timeout=args.timeout
#             )
#         except Exception as e:
#             res = {"ok": False, "url": u, "error": str(e)}
#         results.append(res)

#         # stdout streaming
#         if args.stdout == "jsonl":
#             line = json.dumps(res, ensure_ascii=False)
#             print(line)
#             out_jsonl_lines.append(line)

#         if i < len(urls) and args.delay > 0:
#             time.sleep(args.delay)

#     # write files
#     if args.json:
#         pathlib.Path(args.json).parent.mkdir(parents=True, exist_ok=True)
#         with open(args.json, "w", encoding="utf-8") as f:
#             json.dump(results, f, ensure_ascii=False, indent=2)

#     if args.jsonl:
#         pathlib.Path(args.jsonl).parent.mkdir(parents=True, exist_ok=True)
#         with open(args.jsonl, "w", encoding="utf-8") as f:
#             f.write("\n".join(out_jsonl_lines) + ("\n" if out_jsonl_lines else ""))

#     if args.stdout == "json":
#         payload: Any
#         if len(results) == 1:
#             payload = results[0]
#         else:
#             payload = results
#         print(json.dumps(payload, ensure_ascii=False))

#     if args.csv:
#         write_csv(results, args.csv)

#     # exit code non-zero ถ้ามีสัก URL ล้มเหลว
#     if any(not r.get("ok") for r in results):
#         sys.exit(2)

# if __name__ == "__main__":
#     # main()
#     # from facebook_scraper import get_posts
#     for post in get_posts('nintendo', pages=10):
#         print("post", post)
#         print(post['text'][:50])

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import time
import random
import json
import re

class FacebookScraper:
    def __init__(self, email, password):
        self.email = email
        self.password = password
        self.driver = None
        
    def initialize_driver(self):
        """Initialize the Chrome webdriver with custom options"""
        options = webdriver.ChromeOptions()
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        
        self.driver = webdriver.Chrome(options=options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
    def simulate_human_typing(self, element, text):
        """Simulate human-like typing patterns"""
        for char in text:
            element.send_keys(char)
            time.sleep(random.uniform(0.1, 0.3))
            if random.random() < 0.1:
                time.sleep(random.uniform(0.3, 0.7))
                
    def login(self):
        """Login to Facebook"""
        self.driver.get("https://www.facebook.com/login")
        
        # Enter email
        email_input = WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.NAME, "email"))
        )
        self.simulate_human_typing(email_input, self.email)
        
        # Enter password
        password_input = WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.NAME, "pass"))
        )
        self.simulate_human_typing(password_input, self.password)
        
        # Click login button
        login_button = self.driver.find_element(By.XPATH, "//button[@type='submit']")
        ActionChains(self.driver)\
            .move_to_element(login_button)\
            .pause(random.uniform(0.2, 0.4))\
            .click()\
            .perform()
            
        time.sleep(15)
        
    def navigate_to_profile(self, profile_url):
        """Navigate to a specific Facebook profile"""
        self.driver.get(profile_url)
        time.sleep(4)
        
    def slow_scroll(self, step=500):
        """Scroll the page slowly"""
        self.driver.execute_script(f"window.scrollBy(0, {step});")
        time.sleep(2)
        
    def _extract_post_text(self, post):
        """Extract textual content from a post element"""
        text_parts = []

        for node in post.select('[data-ad-preview="message"] span'):
            value = node.get_text(strip=True)
            if value:
                text_parts.append(value)

        if not text_parts:
            for node in post.select('span[dir="auto"]'):
                value = node.get_text(strip=True)
                if value and len(value) > 1:
                    text_parts.append(value)

        unique_parts = []
        for part in text_parts:
            if part not in unique_parts:
                unique_parts.append(part)

        return ' '.join(unique_parts).strip()

    def _extract_metric(self, post, keywords):
        """Extract Like/Comment/Share counts by scanning aria-labels and visible text"""
        patterns = tuple(keyword.lower() for keyword in keywords)
        number_pattern = re.compile(r'[\d,.]+')

        for node in post.select('[aria-label]'):
            label = node.get('aria-label', '').lower()
            if any(keyword in label for keyword in patterns):
                match = number_pattern.search(label)
                if match:
                    return match.group(0)

        for node in post.find_all(string=True):
            text_value = (node or '').strip()
            if not text_value:
                continue
            lower_value = text_value.lower()
            if any(keyword in lower_value for keyword in patterns):
                match = number_pattern.search(lower_value)
                if match:
                    return match.group(0)
        return None

    def _extract_timestamp(self, post):
        """Extract timestamp text shown on the post"""
        time_node = post.select_one('a[href*="posts"] abbr, a[href*="permalink"] abbr, abbr[data-utime]')
        if time_node:
            if time_node.has_attr('aria-label'):
                return time_node['aria-label']
            if time_node.has_attr('data-utime'):
                return time_node['data-utime']
            return time_node.get_text(strip=True)

        fallback = post.select_one('span > a > span')
        if fallback:
            return fallback.get_text(strip=True)
        return None

    def extract_posts_with_bs(self):
        """Extract posts data using BeautifulSoup"""
        page_source = self.driver.page_source
        soup = BeautifulSoup(page_source, "html.parser")
        posts_data = []
        
        posts = soup.select('div[role="article"]')
        
        for post in posts:
            try:
                post_text = self._extract_post_text(post)
                likes = self._extract_metric(post, ("like", "ถูกใจ", "reaction"))
                comments = self._extract_metric(post, ("comment", "ความเห็น"))
                shares = self._extract_metric(post, ("share", "แชร์"))
                post_time = self._extract_timestamp(post)

                if not any([post_text, likes, comments, shares, post_time]):
                    continue

                posts_data.append({
                    "post_text": post_text,
                    "likes": likes,
                    "comments": comments,
                    "shares": shares,
                    "post_time": post_time
                })
            except Exception as e:
                print("Error extracting post data:", e)
                
        return posts_data
        
    def remove_duplicates(self, data_list):
        """Remove duplicate posts"""
        seen = set()
        unique_data = []
        for data in data_list:
            data_tuple = tuple(data.items())
            if data_tuple not in seen:
                seen.add(data_tuple)
                unique_data.append(data)
        return unique_data
        
    def scrape_posts(self, max_posts):
        """Scrape a specified number of posts"""
        all_posts = []
        
        while len(all_posts) < max_posts:
            posts = self.extract_posts_with_bs()
            all_posts.extend(posts)
            all_posts = self.remove_duplicates(all_posts)
            print(f"Extracted {len(all_posts)} unique posts so far.")
            # print(all_posts)
            self.slow_scroll()
            
            if len(all_posts) >= max_posts:
                break
                
        return all_posts[:max_posts]



    def print_posts(self, posts_data):
        """Print the scraped posts data"""
        for idx, post in enumerate(posts_data, start=1):
            print(f"Post {idx}:")
            print(f"Text: {post['post_text']}")
            print(f"Likes: {post['likes']}")
            print(f"Comments: {post['comments']}")
            print(f"Shares: {post['shares']}")
            print(f"Time Posted: {post['post_time']}")
            print("-" * 50)
            
    def close(self):
        """Close the browser"""
        if self.driver:
            self.driver.quit()

# Example usage
if __name__ == "__main__":
    # Initialize the scraper
    scraper = FacebookScraper("fortestrabob1@gmail.com", "Testing123456")
    
    try:
        # Setup and login
        scraper.initialize_driver()
        scraper.login()
        
        # Navigate to Cristiano Ronaldo's profile
        scraper.navigate_to_profile("https://www.facebook.com/photo/?fbid=122263124978142168&set=a.122142514004142168")
        
        # Scrape 10 posts
        posts_data = scraper.scrape_posts(max_posts=10)
        
        # Print the results
        scraper.print_posts(posts_data)
        
    finally:
        # Clean up
        scraper.close()
