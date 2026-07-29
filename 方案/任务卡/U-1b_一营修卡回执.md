# U-1b 返修 P0 回执 — 一营

**日期**: 2026-07-29  
**状态**: ✅ 完成  
**施工**: 一营 (Claude)

---

## 一、病根定位

### 语法错误（主因）

`app.js:157` 行 `_defaultConfig()` 函数结束处的括号平衡错误：

```
// 错误（修复前）:    // 正确（修复后）:
  }                    }
};}                   }}}
```

多出来的 `}` 在函数体内多闭合了一层，导致 JavaScript 解析器报 `Uncaught SyntaxError: Unexpected token ';'`。

**影响范围**：`app.js` 第 157 行之后的所有函数全部未定义，包括：
- `getBuildings()`, `getPlots()` — 数据读取
- `render()`, `renderContent()`, `renderInfoPage()`, `renderCarousel()` — 全貌页渲染
- `_initMap()`, `_bindEvents()` — 地图初始化
- `_ml()`, `_mlConfig()`, `_defaultConfig()` 本身 — 配置读取
- 以及数十个其他函数

**唯一幸存**：`HARDCODED_BUILDINGS`（定义在第 15 行，先于语法错误），所以用户看到"抬头靠 HARDCODED_BUILDINGS 幸存"。

### 连带问题

| 症状 | 根因 | 修复 |
|------|------|------|
| 全貌页空白 | `renderInfoPage()` 未定义 | 语法修复后自然恢复 |
| 版面滑块消失 | `renderCarousel()` 未定义 | 同上 |
| 头像异常 | ① `switchUser` 未从 `nt_local_users` 找 `avatar_seed` ② `Game.getUser` 不防 `NaN` 种子 | ① 多源查找 ② `s===s` 排除 NaN |

---

## 二、硬重置链路实测（浏览器控制台）

```
[U-1b] AppData.init 开始, localStorage共享= false
[U-1b] _seedIfEmpty 入口: ml_acc=0 camps=0 buildings=0
[U-1b] _seedIfEmpty 完成: acc=6 plots=5 camps=3 buildings=0
[U-1b] _initMap 开始: acc=6 plots=5 buildings=0
[U-1b] _initMap → goTo(4), getBuildings()=9 个建筑, getPlots()=5 个地块
[U-1b] renderInfoPage: sections HTML 长度=17013 roomsGrid=true scrollArea=true
[U-1b] _mergeSyncData sync_all 返回: map_locations keys=Array(0)
[U-1b] 合并前本地: acc=6 plots=5 buildings=0
[U-1b] 合并后本地: acc=6 plots=5 buildings=0
```

**逐环验证**:

| 环节 | 预期 | 实测 | 判定 |
|------|------|------|------|
| ① localStorage 清空 | `nt_app_v2_shared` 不存在 | `localStorage共享=false` | ✅ |
| ② 种子函数运行 | acc=6, plots=5, camps=3 | 同预期 | ✅ |
| ③ sync_all 时序 | 种子先于 sync（sync 异步回调在后） | 日志顺序确认 | ✅ |
| ④ 全貌页渲染 | HTML > 0, roomsGrid 存在 | 17013 字符 | ✅ |

---

## 三、代码变更清单

| 文件 | ?v= | 变更 |
|------|-----|------|
| `nantang-mobile/js/app.js` | 24 | ① `};}` → `}}}` 修复语法错误 ② 诊断日志 |
| `nantang-mobile/js/core.js` | 27 | ① U-1b 智能合并 guard ② NaN 种子守卫 ③ 诊断日志 |
| `nantang-mobile/js/app-data.js` | 19 | ① switchUser avatar_seed 多源查找 ② 诊断日志 |
| `nantang-mobile/index.html` | — | ?v= 版本号递增 |

**Commit**: `95b2526` (main, 本地)

---

## 四、判据达成

- ✅ 硬重置后全貌页显示种子村庄（建筑 via HARDCODED_BUILDINGS + 默认住宿房 6 间）
- ✅ 头像正常（NaN 守卫 + nt_local_users 兜底）
- ✅ 版面滑块正常（renderCarousel 恢复）
- ✅ 浏览器实测 + 控制台日志入回执
- ✅ 不 push / 具名 add / ?v= 递增

---

## 五、待接续

批次5 队二：③设置面板实装（A-10 回执附修法案，~30 行）
