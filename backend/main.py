import os
import re
from datetime import datetime
from typing import Any
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_TABLE = os.getenv("SUPABASE_TABLE", "dreams")
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")]

app = FastAPI(title="Deja vu Dream API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DreamIn(BaseModel):
    text: str = Field(min_length=1)
    emotion: str = Field(default="喜悦", min_length=1, max_length=24)
    isPublic: bool = False
    author: str | None = None


class DreamOut(BaseModel):
    id: str
    text: str
    emotion: str
    isPublic: bool
    author: str
    createdAt: str


class SearchIn(BaseModel):
    query: str = Field(min_length=1)


class SearchResult(BaseModel):
    dream: DreamOut
    score: int
    overlap: list[str]


SEED_DREAMS: list[DreamOut] = [
    DreamOut(
        id="seed-1",
        text="我在一座没有尽头的蓝色地铁站等车，广播反复念我的名字，站台广告牌却播放着我小时候的卧室。",
        emotion="诡异",
        isPublic=True,
        author="匿名 07",
        createdAt="2026-07-07",
    ),
    DreamOut(
        id="seed-2",
        text="雨后的窄巷里有一台红色自动售货机，里面卖的不是饮料，而是一瓶瓶封好的黄昏。发光的猫坐在机器顶部。",
        emotion="科幻",
        isPublic=True,
        author="匿名 19",
        createdAt="2026-07-08",
    ),
    DreamOut(
        id="seed-3",
        text="我和朋友在云层上开了一家早餐店，煎蛋会慢慢升空，顾客全是穿睡衣的星星。",
        emotion="喜悦",
        isPublic=True,
        author="匿名 33",
        createdAt="2026-07-09",
    ),
    DreamOut(
        id="seed-4",
        text="办公室漂浮在土星环旁边，所有电脑屏幕都变成星图，老板让我在宇宙日落前交一份不存在的报表。",
        emotion="焦虑",
        isPublic=False,
        author="我",
        createdAt="2026-07-10",
    ),
    DreamOut(
        id="seed-5",
        text="一座图书馆建在黑色海面上，每翻开一本书，远处就亮起一座灯塔，像有人在替我回忆。",
        emotion="诡异",
        isPublic=True,
        author="匿名 51",
        createdAt="2026-07-11",
    ),
]

memory_dreams: list[DreamOut] = [dream.model_copy() for dream in SEED_DREAMS]


def supabase_enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def supabase_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def table_url() -> str:
    return f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}"


def row_to_dream(row: dict[str, Any]) -> DreamOut:
    created_at = str(row.get("created_at") or row.get("createdAt") or datetime.utcnow().date())
    return DreamOut(
        id=str(row["id"]),
        text=row["text"],
        emotion=row["emotion"],
        isPublic=bool(row.get("is_public", row.get("isPublic", False))),
        author=row.get("author") or "我",
        createdAt=created_at[:10],
    )


async def fetch_dreams(include_private: bool = True) -> list[DreamOut]:
    if not supabase_enabled():
        return memory_dreams if include_private else [dream for dream in memory_dreams if dream.isPublic]

    params = {"select": "*", "order": "created_at.desc"}
    if not include_private:
        params["is_public"] = "eq.true"

    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.get(table_url(), headers=supabase_headers(), params=params)

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=response.text)
    return [row_to_dream(row) for row in response.json()]


async def insert_dream(dream: DreamIn) -> DreamOut:
    if not supabase_enabled():
        saved = DreamOut(
            id=f"local-{uuid4()}",
            text=dream.text,
            emotion=dream.emotion,
            isPublic=dream.isPublic,
            author=dream.author or "我",
            createdAt=datetime.utcnow().date().isoformat(),
        )
        memory_dreams.insert(0, saved)
        return saved

    payload = {
        "text": dream.text,
        "emotion": dream.emotion,
        "is_public": dream.isPublic,
        "author": dream.author or "我",
    }
    headers = {**supabase_headers(), "Prefer": "return=representation"}
    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.post(table_url(), headers=headers, json=payload)

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=response.text)
    return row_to_dream(response.json()[0])


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "storage": "supabase" if supabase_enabled() else "memory"}


@app.get("/api/dreams", response_model=list[DreamOut])
async def list_dreams() -> list[DreamOut]:
    return await fetch_dreams(include_private=True)


@app.get("/api/dreams/public", response_model=list[DreamOut])
async def list_public_dreams() -> list[DreamOut]:
    return await fetch_dreams(include_private=False)


@app.post("/api/dreams", response_model=DreamOut)
async def create_dream(dream: DreamIn) -> DreamOut:
    return await insert_dream(dream)


@app.post("/api/dreams/search", response_model=list[SearchResult])
async def search_dreams(payload: SearchIn) -> list[SearchResult]:
    dreams = await fetch_dreams(include_private=True)
    scored = [{"dream": dream, **score_dream(payload.query, dream)} for dream in dreams]
    return [SearchResult(**result) for result in sorted(scored, key=lambda item: item["score"], reverse=True)[:3]]


def score_dream(query: str, dream: DreamOut) -> dict[str, Any]:
    query_tokens = tokenize(query)
    dream_tokens = tokenize(dream.text)
    dream_set = set(dream_tokens)
    overlap = list(dict.fromkeys(token for token in query_tokens if token in dream_set))
    scene_bonus = get_scene_bonus(query, dream.text)
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
