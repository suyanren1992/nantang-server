---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 住宿
task_status: 已发卡
status: 讨论中
series: C-B
---
# C-B-5a 素社民宿房型列表端点（二营前置小任务）🔴

> 来源：C-B-5 前端卡的前置依赖
> 施工：豆包 Codex（二营）｜验收：Claude Code（一营）
> 优先级：**P0 首位前置**（阻塞一营 C-B-5）· 工期 15 分钟
> 法源：C-B 设计稿 §1.3 InnRoom model

## 现状问题

`InnRoom` model 已有 6 间房 seed，但**没有列表端点**——前端无法拉取房型清单和占用状态。

## 施工内容

`server/routes/accommodation.py` 新增 1 个 GET 端点：

```python
@router.get("/inn-rooms")
async def list_inn_rooms(db: AsyncSession = Depends(get_db)):
    """C-B-5a: 素社民宿房型列表（含占用日期）。"""
    rooms_r = await db.execute(select(InnRoom).where(InnRoom.status == "active"))
    rooms = []
    for room in rooms_r.scalars():
        # 查该房当前活跃预订 → 展开为日期数组
        tenancies = await db.execute(
            select(Tenancy).where(
                Tenancy.room_id == room.id, Tenancy.track == "inn", Tenancy.status == "active"
            )
        )
        occupied = set()
        for t in tenancies.scalars():
            if t.checkin_date and t.check_out_date:
                # 展开 [checkin, checkout) 区间内所有日期
                from datetime import date, timedelta
                d = date.fromisoformat(t.checkin_date)
                end = date.fromisoformat(t.check_out_date)
                while d < end:
                    occupied.add(d.isoformat())
                    d += timedelta(days=1)
        rooms.append({
            "id": room.id, "label": room.label, "room_type": room.room_type,
            "beds": room.beds, "rate": room.rate, "dietary": room.dietary,
            "status": room.status, "occupied_dates": sorted(occupied)
        })
    return {"rooms": rooms}
```

**注意**：此端点**不需要鉴权**（公开房型信息），或加 `Depends(get_current_user)` 与现有端点对齐——二营自行判断。

## 爆炸半径

- 改几个文件：1（accommodation.py）
- 影响功能：零（纯新增端点）
- 破坏性变更：无
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add；pytest 零回归
- 回执落盘 `方案/任务卡/`

## 判据

1. `GET /api/accommodation/inn-rooms` 返回 6 间房（梅/兰/竹/菊/quadA/quadB）
2. `occupied_dates` 正确反映当前活跃预订的日期区间
3. pytest 全绿
