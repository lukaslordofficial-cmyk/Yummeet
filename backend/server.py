"""Yummeet thin server.

Supabase holds all domain data and logic (RLS + RPC). This FastAPI service only does
things that need a server secret (service_role key), which must never ship in the app:
  * push dispatcher — sends pending rows from public.notifications via Expo Push API

Auth (email/password + Google OAuth) is handled entirely by Supabase Auth in the app —
no Emergent / third-party auth bridge.
"""
import asyncio
import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
PUSH_INTERVAL_S = 30

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("yummeet")
logging.getLogger("httpx").setLevel(logging.WARNING)

app = FastAPI(title="Yummeet server")
api = APIRouter(prefix="/api")


def admin_headers() -> dict:
    return {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json"}


@api.get("/health")
async def health():
    return {"ok": True, "push_enabled": bool(SERVICE_KEY)}


async def dispatch_push_once(client: httpx.AsyncClient) -> int:
    """Send pending notifications. Dedupe is guaranteed by notifications.unique(user_id, dedupe_key)."""
    if not SERVICE_KEY:
        return 0
    rest = f"{SUPABASE_URL}/rest/v1"
    r = await client.get(f"{rest}/notifications", headers=admin_headers(),
                         params={"push_status": "eq.pending", "select": "id,user_id,title,body,data", "order": "created_at", "limit": "100"})
    if r.status_code != 200:
        return 0
    rows = r.json()
    for n in rows:
        tr = await client.get(f"{rest}/push_tokens", headers=admin_headers(),
                              params={"user_id": f"eq.{n['user_id']}", "is_valid": "eq.true", "select": "token"})
        tokens = [t["token"] for t in (tr.json() if tr.status_code == 200 else [])]
        status, err = ("skipped", None) if not tokens else ("sent", None)
        if tokens:
            pr = await client.post(EXPO_PUSH_URL, json=[{"to": t, "title": n["title"], "body": n.get("body") or "", "data": n.get("data") or {}} for t in tokens])
            if pr.status_code != 200:
                status, err = "failed", pr.text[:500]
            else:
                for t, res in zip(tokens, pr.json().get("data", [])):
                    if res.get("status") == "error" and (res.get("details") or {}).get("error") == "DeviceNotRegistered":
                        await client.patch(f"{rest}/push_tokens", headers=admin_headers(), params={"token": f"eq.{t}"}, json={"is_valid": False})
        await client.patch(f"{rest}/notifications", headers=admin_headers(), params={"id": f"eq.{n['id']}"},
                           json={"push_status": status, "push_error": err})
    return len(rows)


async def push_loop():
    async with httpx.AsyncClient(timeout=20) as client:
        while True:
            try:
                await dispatch_push_once(client)
            except Exception as e:  # keep the loop alive; errors are logged
                logger.warning("push dispatcher error: %s", e)
            await asyncio.sleep(PUSH_INTERVAL_S)


@app.on_event("startup")
async def start_dispatcher():
    if not SERVICE_KEY:
        logger.warning("SUPABASE_SERVICE_ROLE_KEY missing — push dispatcher disabled (auth still works in the app via anon key).")
        return
    asyncio.create_task(push_loop())


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
