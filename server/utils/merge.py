"""deep_merge 工具——递归合并 dict，list 替换。

REDTEAM-B-B3: sync_shared admin 写 shared 时 merge 而非覆写，保护 buildings 种子。
"""


def deep_merge(base: dict, override: dict) -> dict:
    """递归合并两个 dict。

    规则：
      - dict + dict → 递归合并
      - list + list → override 替换（建筑楼层等列表整体替换）
      - scalar + scalar → override 胜出
      - None 值不覆盖已有值

    Args:
        base: 已有数据（种子/历史值）
        override: 新传入数据

    Returns:
        合并后的 dict（新对象，不修改入参）
    """
    if not isinstance(base, dict):
        return override
    if not isinstance(override, dict):
        return override

    result = dict(base)
    for key, val in override.items():
        if key in result:
            if isinstance(result[key], dict) and isinstance(val, dict):
                result[key] = deep_merge(result[key], val)
            else:
                # list 替换、scalar 覆盖——但 None 不覆盖
                if val is not None:
                    result[key] = val
        else:
            if val is not None:
                result[key] = val
    return result
