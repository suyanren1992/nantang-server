"""GATE-1: /api 前缀强制规则 — 3 测。

判据：
  - test_deploy_check_detects_bare_path    — 裸路径应检出 FAIL
  - test_deploy_check_accepts_api_prefix   — /api/ 前缀应 PASS
  - test_current_api_js_all_prefixed        — 真实 api.js 违规列表为空（回归哨兵）

前两个测为纯函数测（不碰文件系统），通过 _scan_js_bare_paths 直接吃内存字符串，
避免 tmp_path fixture 在本机 Temp 权限异常（WinError 5）时报 ERROR。
"""
from pathlib import Path
from scripts.deploy_check import check_api_prefix, _scan_js_bare_paths


def test_deploy_check_detects_bare_path():
    """构造含裸路径的 JS 源码，_scan_js_bare_paths 应返回非空违规列表。"""
    src = """
API.foo = function() { return this.request('GET', '/fields'); };
API.bar = function(id) { return this.request('POST', '/storage/items'); };
"""
    violations = _scan_js_bare_paths("fake.js", src)
    assert len(violations) >= 2, f"应检出至少 2 个裸路径，实际 {violations}"
    assert any("/fields" in v for v in violations)
    assert any("/storage/items" in v for v in violations)


def test_deploy_check_accepts_api_prefix():
    """构造全 /api/ 前缀的 JS 源码，_scan_js_bare_paths 应返回空列表。"""
    src = """
API.foo = function() { return this.request('GET', '/api/fields'); };
API.bar = function(id) { return this.request('POST', '/api/storage/items'); };
API.baz = function(id) { return this.request('GET', '/api/tasks/' + id); };
"""
    violations = _scan_js_bare_paths("ok.js", src)
    assert violations == [], f"应无违规，实际 {violations}"


def test_current_api_js_all_prefixed():
    """回归哨兵：真实 nantang-mobile/js/api.js 违规列表应为空。"""
    js_dir = Path(__file__).resolve().parent.parent.parent / "nantang-mobile" / "js"
    violations = check_api_prefix(str(js_dir))
    assert violations == [], f"真实 api.js 存在裸路径: {violations}"
