from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from html import unescape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))
SOURCE_URL = (
    "https://www.ffvbbeach.org/ffvbapp/resu/vbspo_calendrier.php"
    "?saison=2025/2026&codent=PTFL59&poule=DMB"
)
STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/script.js": ("script.js", "application/javascript; charset=utf-8"),
}


def clean_text(value: str) -> str:
    value = re.sub(r"<form\b[^>]*>", "", value, flags=re.I)
    value = re.sub(r"</form>", "", value, flags=re.I)
    value = re.sub(r"<input\b[^>]*>", "", value, flags=re.I)
    value = re.sub(r"<img\b[^>]*>", "", value, flags=re.I)
    value = re.sub(r"<a\b[^>]*>", "", value, flags=re.I)
    value = re.sub(r"</a>", "", value, flags=re.I)
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = unescape(value)
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def parse_rows(html: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for row_html in re.findall(r"<tr\b[^>]*>(.*?)</tr>", html, flags=re.I | re.S):
        cells = re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", row_html, flags=re.I | re.S)
        cleaned = [clean_text(cell) for cell in cells]
        if any(cell for cell in cleaned):
            rows.append(cleaned)
    return rows


def fetch_source_html() -> str:
    request = Request(
        SOURCE_URL,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0 Safari/537.36"
            )
        },
    )

    with urlopen(request, timeout=20) as response:
        raw = response.read()

    try:
      return raw.decode("latin-1")
    except UnicodeDecodeError:
      return raw.decode("utf-8", errors="replace")


def extract_title(html: str) -> str:
    match = re.search(
        r"class='titreblanc'[^>]*align='center'>([^<]+)</td>",
        html,
        flags=re.I,
    )
    return clean_text(match.group(1)) if match else "FFVB Live"


def parse_standings(rows: list[list[str]]) -> tuple[list[str], list[list[str]]]:
    header_index = next(
        index for index, row in enumerate(rows) if "Points" in row and "Jou." in row
    )
    columns = rows[header_index][:19]
    standings: list[list[str]] = []

    for row in rows[header_index + 1 :]:
        if row and row[0].startswith("Journ"):
            break
        if len(row) < 19:
            continue
        if not re.match(r"^\d+\.$", row[0]):
            continue
        standings.append(row[:19])

    return columns, standings


def parse_matches(rows: list[list[str]]) -> list[dict[str, object]]:
    groups: list[dict[str, object]] = []
    current_group: dict[str, object] | None = None

    for row in rows:
        if row and row[0].startswith("Journ"):
            current_group = {"label": row[0], "matches": []}
            groups.append(current_group)
            continue

        if not current_group:
            continue

        code = row[0] if row else ""
        if not re.match(r"^[A-Z]{3}\d{3}$", code):
            continue

        match = {
            "code": code,
            "date": row[1] if len(row) > 1 else "",
            "time": row[2] if len(row) > 2 else "",
            "home_team": row[3] if len(row) > 3 else "",
            "away_team": row[5] if len(row) > 5 else "",
            "home_score": row[6] if len(row) > 6 and re.fullmatch(r"\d+", row[6]) else "",
            "away_score": row[7] if len(row) > 7 and re.fullmatch(r"\d+", row[7]) else "",
            "sets": row[8] if len(row) > 8 else "",
            "points_score": row[9] if len(row) > 9 else "",
            "location": row[8] if len(row) > 8 and "SALLE" in row[8].upper() else "",
            "referee": row[10] if len(row) > 10 else "",
        }

        if len(row) > 8 and "SALLE" in row[8].upper():
            match["sets"] = ""
        if len(row) > 9 and "SALLE" in row[9].upper():
            match["location"] = row[9]
        if len(row) > 10 and "SALLE" in row[10].upper():
            match["location"] = row[10]
        if len(row) > 10 and "SALLE" not in row[10].upper():
            match["referee"] = row[10]

        current_group["matches"].append(match)

    return groups


def build_payload() -> dict[str, object]:
    html = fetch_source_html()
    rows = parse_rows(html)
    standings_columns, standings_rows = parse_standings(rows)
    match_groups = parse_matches(rows)

    return {
        "title": extract_title(html),
        "competition": extract_title(html),
        "fetched_at": datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y %H:%M:%S"),
        "source_url": SOURCE_URL,
        "standings": {
            "columns": standings_columns,
            "rows": standings_rows,
        },
        "matches": {
            "groups": match_groups,
            "total_matches": sum(len(group["matches"]) for group in match_groups),
        },
    }


class Handler(BaseHTTPRequestHandler):
    def _send_bytes(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.startswith("/api/ffvb-live"):
            try:
                payload = build_payload()
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self._send_bytes(200, "application/json; charset=utf-8", body)
            except (URLError, TimeoutError, ValueError, StopIteration) as exc:
                body = json.dumps(
                    {"error": "fetch_failed", "message": str(exc)},
                    ensure_ascii=False,
                ).encode("utf-8")
                self._send_bytes(502, "application/json; charset=utf-8", body)
            return

        if self.path == "/favicon.ico":
            self._send_bytes(204, "image/x-icon", b"")
            return

        static = STATIC_FILES.get(self.path)
        if not static:
            self._send_bytes(404, "text/plain; charset=utf-8", b"Not found")
            return

        filename, content_type = static
        body = (ROOT / filename).read_bytes()
        self._send_bytes(200, content_type, body)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Serving on http://{HOST}:{PORT}")
    server.serve_forever()
