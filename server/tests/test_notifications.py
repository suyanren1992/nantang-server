"""W7-NOTIF-1 NOTIF-D: 通知系统测试（收件人过滤 / 公开事件 / 小红点）。"""
import pytest
from httpx import AsyncClient
from datetime import datetime

from auth_utils import hash_password
from database import async_session
from models import ActivityLog, User


async def _create_user(name, password="Passw0rd!"):
    async with async_session() as s:
        u = User(id=name, password_hash=hash_password(password), role="villager")
        s.add(u)
        await s.commit()
        return name


async def _login(client, name, password="Passw0rd!"):
    r = await client.post("/api/auth/login", json={"name": name, "password": password})
    return r.json()["token"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ══════════════════════════════════════════════════════
# 1. 收件人过滤：A 给 B 发通知 → A 看不到 / B 看得到
# ══════════════════════════════════════════════════════
class TestRecipientFilter:
    @pytest.mark.asyncio
    async def test_sender_cannot_see_recipient_notification(self, client):
        """A 给 B 发了一条通知 → A 的列表里不应出现。"""
        await _create_user("notif_sender_A")
        await _create_user("notif_recip_B")
        tok_a = await _login(client, "notif_sender_A")
        tok_b = await _login(client, "notif_recip_B")

        # 直接写库：一条收件人=B 的通知
        now = datetime.utcnow().isoformat()
        async with async_session() as s:
            s.add(ActivityLog(
                time=now, type="tip",
                text="A 给你打赏了 5 NT",
                user_id="notif_recip_B",
                actor_id="notif_sender_A",
            ))
            await s.commit()

        # A 查通知列表 → 不应看到 B 的私信
        r = await client.get("/api/notifications/list", headers=_h(tok_a))
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        texts = [item["text"] for item in body["items"]]
        assert "A 给你打赏了 5 NT" not in texts, f"A 不应看到发给 B 的通知, got={texts}"

        # B 查通知列表 → 应看到
        r = await client.get("/api/notifications/list", headers=_h(tok_b))
        assert r.status_code == 200
        body = r.json()
        texts = [item["text"] for item in body["items"]]
        assert "A 给你打赏了 5 NT" in texts, f"B 应看到自己的通知, got={texts}"


# ══════════════════════════════════════════════════════
# 2. 公开事件：NULL 收件人 → 所有人看得到
# ══════════════════════════════════════════════════════
class TestPublicEvent:
    @pytest.mark.asyncio
    async def test_null_recipient_visible_to_everyone(self, client):
        """user_id=NULL 的公开事件 → 任意用户都能看到。"""
        await _create_user("pub_user_C")
        await _create_user("pub_user_D")
        tok_c = await _login(client, "pub_user_C")
        tok_d = await _login(client, "pub_user_D")

        # 写一条公开通知（user_id=NULL）
        now = datetime.utcnow().isoformat()
        async with async_session() as s:
            s.add(ActivityLog(
                time=now, type="system",
                text="社区公告：明天大扫除",
                user_id=None,  # 公开
            ))
            await s.commit()

        # C 查 → 应看到
        r = await client.get("/api/notifications/list", headers=_h(tok_c))
        texts_c = [item["text"] for item in r.json()["items"]]
        assert "社区公告：明天大扫除" in texts_c

        # D 查 → 也应看到
        r = await client.get("/api/notifications/list", headers=_h(tok_d))
        texts_d = [item["text"] for item in r.json()["items"]]
        assert "社区公告：明天大扫除" in texts_d


# ══════════════════════════════════════════════════════
# 3. 小红点未读数：标已读递减
# ══════════════════════════════════════════════════════
class TestUnreadCount:
    @pytest.mark.asyncio
    async def test_unread_count_and_mark_read(self, client):
        """5 条未读 → unread=5；标 1 条已读 → unread=4。"""
        await _create_user("unread_user_E")
        tok = await _login(client, "unread_user_E")

        # 写 5 条未读通知（收件人=E）
        now = datetime.utcnow().isoformat()
        ids = []
        async with async_session() as s:
            for i in range(5):
                log = ActivityLog(
                    time=now, type="task_assign",
                    text=f"任务指派 #{i+1}",
                    user_id="unread_user_E",
                    actor_id="admin_bootstrap",
                )
                s.add(log)
                await s.flush()
                ids.append(log.id)
            await s.commit()

        # 查未读数 → 应为 5
        r = await client.get("/api/notifications/unread_count", headers=_h(tok))
        assert r.json()["unread"] == 5

        # 标记第 1 条已读
        r = await client.post(f"/api/notifications/{ids[0]}/read", headers=_h(tok))
        assert r.json()["ok"] is True

        # 再查未读数 → 应为 4
        r = await client.get("/api/notifications/unread_count", headers=_h(tok))
        assert r.json()["unread"] == 4
