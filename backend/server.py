import json
import os
import re
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
from uuid import uuid4

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_env() -> None:
    env_path = os.path.join(BASE_DIR, ".env")
    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_TABLE = os.getenv("SUPABASE_TABLE", "dreams")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

SEED_DREAMS = [
    {
        "id": "seed-1",
        "text": "我在一座没有尽头的蓝色地铁站等车，广播反复念我的名字，站台广告牌却播放着我小时候的卧室。",
        "emotion": "诡异",
        "isPublic": True,
        "author": "匿名 07",
        "createdAt": "2026-07-07",
    },
    {
        "id": "seed-2",
        "text": "雨后的窄巷里有一台红色自动售货机，里面卖的不是饮料，而是一瓶瓶封好的黄昏。发光的猫坐在机器顶部。",
        "emotion": "科幻",
        "isPublic": True,
        "author": "匿名 19",
        "createdAt": "2026-07-08",
    },
    {
        "id": "seed-3",
        "text": "我和朋友在云层上开了一家早餐店，煎蛋会慢慢升空，顾客全是穿睡衣的星星。",
        "emotion": "喜悦",
        "isPublic": True,
        "author": "匿名 33",
        "createdAt": "2026-07-09",
    },
    {
        "id": "seed-4",
        "text": "办公室漂浮在土星环旁边，所有电脑屏幕都变成星图，老板让我在宇宙日落前交一份不存在的报表。",
        "emotion": "焦虑",
        "isPublic": False,
        "author": "我",
        "createdAt": "2026-07-10",
    },
    {
        "id": "seed-5",
        "text": "一座图书馆建在黑色海面上，每翻开一本书，远处就亮起一座灯塔，像有人在替我回忆。",
        "emotion": "诡异",
        "isPublic": True,
        "author": "匿名 51",
        "createdAt": "2026-07-11",
    },
]

memory_dreams = [dream.copy() for dream in SEED_DREAMS]


def supabase_enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def table_url(query: str = "") -> str:
    base = f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}"
    return f"{base}?{query}" if query else base


def supabase_headers(extra=None) -> dict[str, str]:
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def row_to_dream(row: dict) -> dict:
    created_at = str(row.get("created_at") or row.get("createdAt") or datetime.utcnow().date())
    return {
        "id": str(row["id"]),
        "text": row["text"],
        "emotion": row["emotion"],
        "isPublic": bool(row.get("is_public", row.get("isPublic", False))),
        "author": row.get("author") or "我",
        "createdAt": created_at[:10],
    }


def supabase_request(method: str, url: str, payload=None, headers=None):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(url, data=data, method=method, headers=supabase_headers(headers))
    try:
        with urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else None
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {error.code}: {detail}") from error
    except URLError as error:
        raise RuntimeError(f"Supabase network error: {error}") from error


def fetch_dreams(include_private=True) -> list[dict]:
    if not supabase_enabled():
        return memory_dreams if include_private else [dream for dream in memory_dreams if dream["isPublic"]]

    query = "select=*&order=created_at.desc"
    if not include_private:
        query += "&is_public=eq.true"
    rows = supabase_request("GET", table_url(query))
    return [row_to_dream(row) for row in rows]


def insert_dream(payload: dict) -> dict:
    dream = {
        "text": str(payload.get("text", "")).strip(),
        "emotion": str(payload.get("emotion") or "喜悦").strip(),
        "isPublic": bool(payload.get("isPublic", False)),
        "author": str(payload.get("author") or "我").strip(),
    }
    if not dream["text"]:
        raise ValueError("text is required")

    if not supabase_enabled():
        saved = {
            "id": f"local-{uuid4()}",
            **dream,
            "createdAt": datetime.utcnow().date().isoformat(),
        }
        memory_dreams.insert(0, saved)
        return saved

    row = {
        "text": dream["text"],
        "emotion": dream["emotion"],
        "is_public": dream["isPublic"],
        "author": dream["author"],
    }
    rows = supabase_request("POST", table_url(), row, {"Prefer": "return=representation"})
    return row_to_dream(rows[0])


class Handler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        try:
            path = urlparse(self.path).path
            if path == "/api/health":
                self.respond({"status": "ok", "storage": "supabase" if supabase_enabled() else "memory"})
            elif path == "/api/dreams":
                self.respond(fetch_dreams(include_private=True))
            elif path == "/api/dreams/public":
                self.respond(fetch_dreams(include_private=False))
            else:
                self.respond({"error": "not found"}, 404)
        except Exception as error:
            self.respond({"error": str(error)}, 500)

    def do_POST(self):
        try:
            path = urlparse(self.path).path
            payload = self.read_json()
            if path == "/api/dreams":
                self.respond(insert_dream(payload), 201)
            elif path == "/api/dreams/search":
                query = str(payload.get("query", "")).strip()
                results = [
                    {"dream": dream, **score_dream(query, dream)}
                    for dream in sorted(fetch_dreams(include_private=True), key=lambda item: score_dream(query, item)["score"], reverse=True)[:3]
                ]
                self.respond(results)
            else:
                self.respond({"error": "not found"}, 404)
        except ValueError as error:
            self.respond({"error": str(error)}, 400)
        except Exception as error:
            self.respond({"error": str(error)}, 500)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def respond(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")


def score_dream(query: str, dream: dict) -> dict:
    query_tokens = tokenize(query)
    dream_tokens = tokenize(dream["text"])
    dream_set = set(dream_tokens)
    overlap = list(dict.fromkeys(token for token in query_tokens if token in dream_set))
    scene_bonus = get_scene_bonus(query, dream["text"])
    base = len(overlap) / max(len(query_tokens), 1)
    density = len(overlap) / max(len(set(query_tokens + dream_tokens)), 1)
    score = min(96, round(base * 72 + density * 42 + scene_bonus))
    return {"score": score, "overlap": overlap[:5]}


def tokenize(text: str) -> list[str]:
    stop_words = {"一个", "一座", "一种", "然后", "里面", "还有", "觉得", "以前", "刚才", "自己", "所有", "不是", "这个", "那个"}
    normalized = re.sub(r"[，。！？、；：“”‘’（）(),.!?;:\"']", " ", text.lower())
    latin_tokens = re.findall(r"[a-z0-9]+", normalized)
    chinese_text = re.sub(r"[^\u4e00-\u9fa5]", "", normalized)
    grams = [chinese_text[index : index + 2] for index in range(max(len(chinese_text) - 1, 0))]
    return [token for token in [*latin_tokens, *grams] if len(token) > 1 and token not in stop_words]


def get_scene_bonus(query: str, text: str) -> int:
    scene_words = ["地铁", "雨", "巷", "猫", "红色", "办公室", "太空", "星图", "海", "图书馆", "灯塔", "广告牌", "广播", "小时候", "房间"]
    return sum(4 for word in scene_words if word in query and word in text)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"API listening on http://{HOST}:{PORT}")
    print(f"Storage: {'supabase' if supabase_enabled() else 'memory'}")
    server.serve_forever()
