# 种子数据说明

## admin_bootstrap 用户

首次启动时，`database.py init_db` 自动创建 `admin_bootstrap` 管理员用户：

| 字段 | 值 |
|------|-----|
| ID | `admin_bootstrap` |
| 角色 | `admin` |
| 默认密码 | `admin123` |

### 安全警告

- **首次登录后立即改密码**：`admin_bootstrap` 默认密码为开发用，登录后务必修改
- **生产环境必须设环境变量**：

```bash
export ADMIN_BOOTSTRAP_PASSWORD="<强密码>"
```

- 不设环境变量时，密码回退为 `admin123`（仅限本地开发/sandbox）

### 幂等性

- `init_db` 在已有任何 `admin` 角色用户时不重复创建
- 生产环境可改密码后，该 seed 不再生效

## buildings.json

建筑种子数据，`init_db` 在 `map_locations.shared` 为空时加载。
