"""Smoke test against the real Supabase project (creates/uses 2 test accounts).
Run: python /app/tests/supabase_smoke.py   (reads /app/backend/.env and /app/frontend/.env)"""
import os
import httpx
from dotenv import dotenv_values

b = dotenv_values("/app/backend/.env"); f = dotenv_values("/app/frontend/.env")
URL = b["SUPABASE_URL"]; SR = b["SUPABASE_SERVICE_ROLE_KEY"]; ANON = f["EXPO_PUBLIC_SUPABASE_ANON_KEY"]
USERS = [("ala@yummeet.test", "Yummeet123!", "Ala Testowa"), ("bartek@yummeet.test", "Yummeet123!", "Bartek Testowy")]
c = httpx.Client(timeout=30)


def ensure(email, pw, name):
    c.post(f"{URL}/auth/v1/admin/users", headers={"apikey": SR, "Authorization": f"Bearer {SR}"},
           json={"email": email, "password": pw, "email_confirm": True, "user_metadata": {"name": name}})
    r = c.post(f"{URL}/auth/v1/token?grant_type=password", headers={"apikey": ANON}, json={"email": email, "password": pw})
    r.raise_for_status(); j = r.json(); return j["access_token"], j["user"]["id"]


def rpc(tok, fn, **args):
    r = c.post(f"{URL}/rest/v1/rpc/{fn}", headers={"apikey": ANON, "Authorization": f"Bearer {tok}"}, json=args)
    if r.status_code >= 300: raise RuntimeError(f"{fn}: {r.status_code} {r.text}")
    return r.json() if r.text else None


def get(tok, path):
    r = c.get(f"{URL}/rest/v1/{path}", headers={"apikey": ANON, "Authorization": f"Bearer {tok}"}); r.raise_for_status(); return r.json()


(ta, a), (tb, bid) = [ensure(*u) for u in USERS]
print("users", a, bid)
print("cards A", len(get(ta, f"user_cards?user_id=eq.{a}&status=eq.owned&select=id")))
print("bbox pins", len(rpc(ta, "pins_in_bbox", p_south=52.2, p_west=20.9, p_north=52.3, p_east=21.1)))
print("route pins", len(rpc(ta, "pins_along_route", p_path=[[21.01, 52.23], [19.94, 52.10], [19.456, 51.77]], p_buffer_m=2000)))
rpc(ta, "choose_specialization", p_primary="critic", p_interests=["explorer"])
board = rpc(ta, "get_mission_board"); print("board", len(board))
m = next(x for x in board if x["code"] == "starter_hello")
if m["completions"] == 0:
    um = rpc(ta, "mission_accept", p_mission=m["mission_id"]); rpc(ta, "mission_start", p_um=um)
    print("submit", rpc(ta, "mission_submit", p_um=um, p_kind="text", p_content="Pierogi"))
    print("resubmit", rpc(ta, "mission_submit", p_um=um, p_kind="text", p_content="x"))
hack = c.post(f"{URL}/rest/v1/user_cards", headers={"apikey": ANON, "Authorization": f"Bearer {ta}"}, json={"user_id": a, "card_id": a, "source_type": "hack"})
print("RLS insert user_cards blocked:", hack.status_code in (401, 403))
d = rpc(ta, "duel_invite", p_opponent=bid)
rpc(tb, "duel_respond", p_duel=d, p_accept=True)
rpc(ta, "duel_play", p_duel=d, p_move="paper"); print("after both", rpc(tb, "duel_play", p_duel=d, p_move="rock"))
st = rpc(ta, "duel_state", p_duel=d); print("duel status", st["status"], "card", (st.get("offensive_card") or {}).get("name"))
rpc(ta, "duel_play", p_duel=d, p_move="rock"); rpc(tb, "duel_play", p_duel=d, p_move="scissors")
st = rpc(tb, "duel_state", p_duel=d); print("after defense", st["status"])
rpc(tb, "duel_submit_evidence", p_duel=d, p_evidence="Zostawiłem pierogi w kawiarni")
rpc(ta, "duel_confirm", p_duel=d, p_accept=True)
print("final", rpc(ta, "duel_state", p_duel=d)["outcome"])
print("leaderboard", rpc(ta, "duel_leaderboard", p_limit=5)[:2])
print("ALL SMOKE OK")
