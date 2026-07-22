# 激活服务端 Cron（已有部署）

已经部署的服务器，两步激活：

## 1. 加环境变量

```bash
# 如果已有 /etc/nantang.env：
echo "CRON_ACTIVE=1" >> /etc/nantang.env

# 如果还在用旧方案（/etc/environment 或 systemd Environment=）：
# 先迁移到 /etc/nantang.env，再加 CRON_ACTIVE=1
```

## 2. 重启服务

```bash
systemctl restart nantang
```

## 验证

```bash
# 1. 确认 cron 启动
journalctl -u nantang -f | grep cron

# 应看到：
# cron: next tick at 2026-07-23T00:05:00 (xxxxxs)

# 2. 确认 API 返回 cron_active
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/nt/sync | grep cron_active
# → "cron_active": true

# 3. 次日 00:05 后检查任务大厅
# → 应出现「日常清扫」「翻堆肥」等系统任务卡片
```

## 影响

| 组件 | CRON_ACTIVE=0（默认） | CRON_ACTIVE=1 |
|------|----------------------|---------------|
| 服务端 cron | 不生成周期任务 | 每日 00:05 生成 |
| 客户端 `_dailyPoolRefill()` | 执行社区池补填 | 跳过（cron 接管） |
| 客户端 `_checkDailyContainers()` | 生成容器清理 verification | 跳过 |
| 客户端 `_tickDirtiness()` | 增长脏污度（客户端侧） | 仅 UI 缓存显示 |

## 回滚

```bash
# /etc/nantang.env 中改成 CRON_ACTIVE=0，重启即可
```
