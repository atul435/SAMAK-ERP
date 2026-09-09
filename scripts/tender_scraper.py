"""
Horticulture & landscaping tender scraper (India)
=================================================

Collects government and private tenders whose titles mention our trade keywords,
cleans them, writes a timestamped CSV, and (optionally) posts them straight into
the EnvironIQ tender register.

WHAT TO CHANGE
--------------
1. TARGETS (bottom of this file, in `TARGETS`): one entry per portal.
   - `base_url`      : the listing page, with `{page}` where the page number goes.
   - `mode`          : "static" (requests + BeautifulSoup), "playwright"
                       (JavaScript-rendered pages), or "rss".
   - `row_selector`  : CSS selector matching ONE tender row on the listing page.
   - `fields`        : CSS selector (and optional attribute) per output column.
   - `pages`         : how many listing pages to walk. Pagination loop lives in
                       `scrape_target()` — change `range(1, target.pages + 1)`
                       there if a site starts at page 0 or steps by 10, 20, ...

2. INGEST (optional): set the two environment variables below and the script
   will POST the results into the app as well as writing the CSV.

       export TENDER_INGEST_URL="https://<your-app-domain>/api/public/tenders-ingest"
       export TENDER_INGEST_TOKEN="<the token stored in your project secrets>"

INSTALL
-------
    pip install requests beautifulsoup4 pandas lxml fake-useragent playwright
    playwright install chromium

RUN
---
    python tender_scraper.py                 # scrape every target
    python tender_scraper.py --dry-run       # scrape, print, do not post
    python tender_scraper.py --out ./exports # choose the CSV folder
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import random
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Any, Iterable

import pandas as pd
import requests
from bs4 import BeautifulSoup

try:  # user-agent rotation is nice to have, not fatal if missing
    from fake_useragent import UserAgent

    _UA = UserAgent()
except Exception:  # pragma: no cover - fallback list
    _UA = None

FALLBACK_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tenders")

# ---------------------------------------------------------------------------
# 1. Keywords
# ---------------------------------------------------------------------------

KEYWORDS = [
    "horticulture",
    "landscaping",
    "plantation",
    "plant supply",
    "indoor plants",
    "vertical garden",
    "garden maintenance",
    "arboriculture",
    "topsoil",
    "nursery supply",
]

# Extra spellings that should still count as a match for the canonical keyword.
KEYWORD_ALIASES = {
    "landscaping": ["landscape", "landscaping works", "soft landscape"],
    "horticulture": ["horticultural"],
    "plantation": ["tree plantation", "avenue plantation"],
    "plant supply": ["supply of plants", "supply of saplings"],
    "garden maintenance": ["upkeep of garden", "maintenance of garden", "park maintenance"],
    "nursery supply": ["nursery plants", "supply from nursery"],
    "topsoil": ["top soil", "garden soil", "red soil"],
    "arboriculture": ["tree surgery", "tree pruning"],
    "vertical garden": ["green wall", "living wall"],
    "indoor plants": ["office plants", "interior plantscaping"],
}


def match_keyword(*texts: str | None) -> str | None:
    """Return the first canonical keyword found in the given text, else None."""
    haystack = " ".join(t.lower() for t in texts if t)
    if not haystack:
        return None
    for keyword in KEYWORDS:
        if keyword in haystack:
            return keyword
        for alias in KEYWORD_ALIASES.get(keyword, []):
            if alias in haystack:
                return keyword
    return None


# ---------------------------------------------------------------------------
# 2. Cleaning helpers
# ---------------------------------------------------------------------------

WHITESPACE = re.compile(r"\s+")
DATE_PATTERNS = [
    "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y",
    "%Y-%m-%d", "%Y/%m/%d",
    "%d-%b-%Y", "%d %b %Y", "%d-%B-%Y", "%d %B %Y",
    "%d-%m-%Y %H:%M", "%d/%m/%Y %H:%M", "%d-%b-%Y %I:%M %p",
    "%Y-%m-%d %H:%M:%S",
]


def clean_text(value: Any) -> str:
    """Collapse newlines / tabs / repeated spaces and strip stray separators."""
    if value is None:
        return ""
    text = WHITESPACE.sub(" ", str(value)).strip()
    return text.strip(" -–—|:;,")


def clean_date(value: Any) -> str:
    """Normalise any recognised Indian tender date format to YYYY-MM-DD."""
    text = clean_text(value)
    if not text:
        return ""
    # keep only the first date-looking chunk, e.g. "22-Aug-2026 15:00 Hrs"
    candidate = text.replace(",", " ")
    for pattern in DATE_PATTERNS:
        try:
            return datetime.strptime(candidate[: len(datetime.now().strftime(pattern)) + 6].strip(), pattern).date().isoformat()
        except ValueError:
            pass
    for pattern in DATE_PATTERNS:
        try:
            return datetime.strptime(candidate, pattern).date().isoformat()
        except ValueError:
            continue
    match = re.search(r"(\d{1,2})[-/.\s]([A-Za-z]{3,9}|\d{1,2})[-/.\s](\d{4})", candidate)
    if match:
        chunk = f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
        for pattern in ("%d-%m-%Y", "%d-%b-%Y", "%d-%B-%Y"):
            try:
                return datetime.strptime(chunk, pattern).date().isoformat()
            except ValueError:
                continue
    log.debug("Unparsed date: %r", text)
    return ""


def clean_amount(value: Any) -> float | None:
    """Turn '₹ 1,25,00,000/-' or '12.5 Lakh' into a plain number of rupees."""
    text = clean_text(value).lower()
    if not text:
        return None
    multiplier = 1.0
    if "crore" in text or " cr" in text:
        multiplier = 1e7
    elif "lakh" in text or "lac" in text:
        multiplier = 1e5
    digits = re.sub(r"[^0-9.]", "", text.split("crore")[0].split("lakh")[0])
    digits = digits.rstrip(".")
    if not digits:
        return None
    try:
        return round(float(digits) * multiplier, 2)
    except ValueError:
        return None


def polite_pause(low: float = 1.0, high: float = 4.0) -> None:
    """Random delay between requests so we look human and stay welcome."""
    time.sleep(random.uniform(low, high))


def headers() -> dict[str, str]:
    agent = None
    if _UA is not None:
        try:
            agent = _UA.random
        except Exception:
            agent = None
    return {
        "User-Agent": agent or random.choice(FALLBACK_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        "Connection": "keep-alive",
    }


# ---------------------------------------------------------------------------
# 3. Target configuration
# ---------------------------------------------------------------------------


@dataclass
class Selector:
    """Where one field lives inside a tender row."""

    css: str
    attr: str | None = None  # e.g. "href" to read a link instead of the text


@dataclass
class Target:
    name: str
    base_url: str                     # must contain {page} if paginated
    mode: str = "static"              # "static" | "playwright" | "rss"
    pages: int = 3
    row_selector: str = "table tr"
    fields: dict[str, Selector] = field(default_factory=dict)
    state: str = ""                   # default state when the page omits it
    wait_for: str | None = None       # playwright: CSS to wait for
    timeout: int = 30


# ---------------------------------------------------------------------------
# 4. Extraction
# ---------------------------------------------------------------------------


def pick(row, selector: Selector | None, base_url: str) -> str:
    if selector is None:
        return ""
    node = row.select_one(selector.css)
    if node is None:
        return ""
    if selector.attr:
        value = node.get(selector.attr, "")
        if selector.attr == "href" and value and value.startswith("/"):
            root = re.match(r"^(https?://[^/]+)", base_url)
            value = f"{root.group(1)}{value}" if root else value
        return clean_text(value)
    return clean_text(node.get_text(" "))


def rows_from_html(html: str, target: Target) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    found: list[dict[str, Any]] = []
    for row in soup.select(target.row_selector):
        title = pick(row, target.fields.get("title"), target.base_url)
        description = pick(row, target.fields.get("description"), target.base_url)
        keyword = match_keyword(title, description)
        if not keyword:  # 4. filter: only keep trade-relevant tenders
            continue
        found.append(
            {
                "tender_ref": pick(row, target.fields.get("tender_ref"), target.base_url),
                "organisation": pick(row, target.fields.get("organisation"), target.base_url)
                or target.name,
                "title": title,
                "description": description,
                "keyword_matched": keyword,
                "published_on": clean_date(pick(row, target.fields.get("published_on"), target.base_url)),
                "closing_on": clean_date(pick(row, target.fields.get("closing_on"), target.base_url)),
                "estimated_value": clean_amount(pick(row, target.fields.get("estimated_value"), target.base_url)),
                "location": pick(row, target.fields.get("location"), target.base_url),
                "state": pick(row, target.fields.get("state"), target.base_url) or target.state,
                "source_name": target.name,
                "source_url": pick(row, target.fields.get("source_url"), target.base_url),
            }
        )
    return found


def rows_from_rss(xml: str, target: Target) -> list[dict[str, Any]]:
    """Many state portals publish an RSS/Atom feed — far kinder than scraping."""
    soup = BeautifulSoup(xml, "xml")
    found: list[dict[str, Any]] = []
    for item in soup.find_all(["item", "entry"]):
        title = clean_text(item.title.get_text() if item.title else "")
        summary_node = item.find("description") or item.find("summary")
        description = clean_text(summary_node.get_text() if summary_node else "")
        keyword = match_keyword(title, description)
        if not keyword:
            continue
        link_node = item.find("link")
        link = clean_text(link_node.get("href") or link_node.get_text()) if link_node else ""
        published_node = item.find("pubDate") or item.find("published") or item.find("updated")
        guid_node = item.find("guid") or item.find("id")
        found.append(
            {
                "tender_ref": clean_text(guid_node.get_text() if guid_node else link) or link,
                "organisation": target.name,
                "title": title,
                "description": description,
                "keyword_matched": keyword,
                "published_on": clean_date(published_node.get_text() if published_node else ""),
                "closing_on": "",
                "estimated_value": None,
                "location": "",
                "state": target.state,
                "source_name": target.name,
                "source_url": link,
            }
        )
    return found


def fetch_static(url: str, timeout: int) -> str | None:
    try:
        response = requests.get(url, headers=headers(), timeout=timeout)
        response.raise_for_status()
        return response.text
    except requests.RequestException as exc:
        log.warning("Static fetch failed for %s — %s", url, exc)
        return None


async def _fetch_dynamic(url: str, wait_for: str | None, timeout: int) -> str | None:
    """Fallback for JavaScript-rendered listings (eProcurement portals mostly)."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        log.error("playwright is not installed — run: pip install playwright && playwright install chromium")
        return None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=headers()["User-Agent"],
                viewport={"width": 1366, "height": 1600},
                locale="en-IN",
            )
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout * 1000)
            if wait_for:
                await page.wait_for_selector(wait_for, timeout=timeout * 1000)
            else:
                await page.wait_for_timeout(2500)
            html = await page.content()
            await browser.close()
            return html
    except Exception as exc:  # noqa: BLE001 - any browser failure is recoverable
        log.warning("Playwright fetch failed for %s — %s", url, exc)
        return None


def fetch_dynamic(url: str, wait_for: str | None, timeout: int) -> str | None:
    return asyncio.run(_fetch_dynamic(url, wait_for, timeout))


def scrape_target(target: Target) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    # ---- PAGINATION LOOP -------------------------------------------------
    # Change the range to suit the site: range(0, target.pages) for zero-based
    # portals, or range(0, target.pages * 20, 20) for offset-style paging.
    for page in range(1, target.pages + 1):
        url = target.base_url.format(page=page) if "{page}" in target.base_url else target.base_url
        log.info("[%s] page %s → %s", target.name, page, url)
        try:
            if target.mode == "playwright":
                html = fetch_dynamic(url, target.wait_for, target.timeout)
            else:
                html = fetch_static(url, target.timeout)
                # Static page came back empty or JS-only? fall back to a browser.
                if target.mode == "static" and html and target.row_selector:
                    if not BeautifulSoup(html, "lxml").select(target.row_selector):
                        log.info("[%s] nothing matched statically, retrying with Playwright", target.name)
                        html = fetch_dynamic(url, target.wait_for, target.timeout)
            if not html:
                continue
            rows = rows_from_rss(html, target) if target.mode == "rss" else rows_from_html(html, target)
            log.info("[%s] page %s matched %s tender(s)", target.name, page, len(rows))
            if not rows and target.mode != "rss":
                # No matches on this page usually means the listing ended.
                pass
            collected.extend(rows)
        except Exception as exc:  # noqa: BLE001 - never let one page kill the run
            log.exception("[%s] page %s failed — %s", target.name, page, exc)
        finally:
            polite_pause()
        if target.mode == "rss":
            break  # a feed is a single document, no paging
    return collected


# ---------------------------------------------------------------------------
# 5. Assemble, export, publish
# ---------------------------------------------------------------------------

COLUMNS = [
    "tender_ref",
    "organisation",
    "title",
    "description",
    "keyword_matched",
    "published_on",
    "closing_on",
    "estimated_value",
    "location",
    "state",
    "source_name",
    "source_url",
]


def build_frame(records: Iterable[dict[str, Any]]) -> pd.DataFrame:
    frame = pd.DataFrame(list(records), columns=COLUMNS)
    if frame.empty:
        return frame
    for column in ("tender_ref", "organisation", "title", "description", "location", "state"):
        frame[column] = frame[column].map(clean_text)
    frame = frame[frame["title"].str.len() > 0]
    frame["tender_ref"] = frame.apply(
        lambda r: r["tender_ref"] or f"{r['source_name'][:12]}-{abs(hash(r['title'])) % 10**8}",
        axis=1,
    )
    frame = frame.drop_duplicates(subset=["tender_ref"], keep="first")
    # Drop tenders whose submission date has already gone.
    today = date.today().isoformat()
    frame = frame[(frame["closing_on"] == "") | (frame["closing_on"] >= today)]
    return frame.sort_values(["closing_on", "organisation"], na_position="last").reset_index(drop=True)


def export_csv(frame: pd.DataFrame, out_dir: str) -> str:
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"tenders_horticulture_{datetime.now():%Y%m%d}.csv")
    frame.to_csv(path, index=False, encoding="utf-8-sig")
    return path


def push_to_app(frame: pd.DataFrame) -> None:
    """POST the rows into the EnvironIQ tender register (optional)."""
    url = os.environ.get("TENDER_INGEST_URL")
    token = os.environ.get("TENDER_INGEST_TOKEN")
    if not url or not token:
        log.info("TENDER_INGEST_URL / TENDER_INGEST_TOKEN not set — skipping upload.")
        return
    payload = []
    for row in frame.to_dict("records"):
        item = {k: (v if v not in ("", float("nan")) else None) for k, v in row.items()}
        if item.get("estimated_value") is not None and pd.isna(item["estimated_value"]):
            item["estimated_value"] = None
        payload.append(item)
    for chunk_start in range(0, len(payload), 200):  # server accepts 500 max per call
        chunk = payload[chunk_start : chunk_start + 200]
        try:
            response = requests.post(
                url,
                json={"tenders": chunk},
                headers={"Content-Type": "application/json", "x-ingest-token": token},
                timeout=60,
            )
            if response.ok:
                log.info("Uploaded %s tender(s): %s", len(chunk), response.json())
            else:
                log.error("Upload failed [%s]: %s", response.status_code, response.text[:400])
        except requests.RequestException as exc:
            log.error("Upload error: %s", exc)


# ---------------------------------------------------------------------------
# 6. Targets — edit these for the portals you actually watch
# ---------------------------------------------------------------------------

TARGETS: list[Target] = [
    Target(
        # Static HTML listing. Replace the placeholder with the real portal.
        name="Example Tender Portal",
        base_url="https://example-tender-portal.in/tenders?category=horticulture&page={page}",
        mode="static",
        pages=3,
        row_selector="table.tender-list tbody tr",
        fields={
            "tender_ref": Selector("td:nth-child(1)"),
            "organisation": Selector("td:nth-child(2)"),
            "title": Selector("td:nth-child(3) a"),
            "source_url": Selector("td:nth-child(3) a", attr="href"),
            "published_on": Selector("td:nth-child(4)"),
            "closing_on": Selector("td:nth-child(5)"),
            "estimated_value": Selector("td:nth-child(6)"),
            "location": Selector("td:nth-child(7)"),
        },
        state="",
    ),
    Target(
        # JavaScript-rendered listing — same field map, browser-driven fetch.
        name="Example eProcurement",
        base_url="https://example-tender-portal.in/eproc/search?keyword=landscaping&pageNo={page}",
        mode="playwright",
        pages=2,
        row_selector="#tenderResults tr.result-row",
        wait_for="#tenderResults tr.result-row",
        fields={
            "tender_ref": Selector("td.ref"),
            "organisation": Selector("td.dept"),
            "title": Selector("td.work a"),
            "source_url": Selector("td.work a", attr="href"),
            "published_on": Selector("td.published"),
            "closing_on": Selector("td.closing"),
            "estimated_value": Selector("td.value"),
            "state": Selector("td.state"),
        },
    ),
    Target(
        # RSS / Atom feed — cheapest and most reliable source when offered.
        name="Example Tender RSS",
        base_url="https://example-tender-portal.in/rss/tenders.xml",
        mode="rss",
        state="",
    ),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape Indian horticulture & landscaping tenders")
    parser.add_argument("--out", default="./exports", help="folder for the CSV export")
    parser.add_argument("--dry-run", action="store_true", help="do not upload to the app")
    args = parser.parse_args()

    records: list[dict[str, Any]] = []
    for target in TARGETS:
        try:
            records.extend(scrape_target(target))
        except Exception as exc:  # noqa: BLE001
            log.exception("Target %s failed entirely — %s", target.name, exc)

    frame = build_frame(records)
    if frame.empty:
        log.warning("No matching tenders found. Check the selectors and base URLs in TARGETS.")
        return 1

    path = export_csv(frame, args.out)
    log.info("Saved %s tender(s) → %s", len(frame), os.path.abspath(path))
    print(frame[["tender_ref", "organisation", "title", "keyword_matched", "closing_on"]].to_string(index=False))

    if not args.dry_run:
        push_to_app(frame)
    return 0


if __name__ == "__main__":
    sys.exit(main())
