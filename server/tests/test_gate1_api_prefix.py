"""GATE-1: /api 前缀强制规则 — 3 测。

判据：
  - test_deploy_check_detects_bare_path    — 裸路径应检出 FAIL
  - test_deploy_check_accepts_api_prefix   — /api/ 前缀应 PASS
  - test_current_api_js_all_prefixed        — 真实 api.js 违规列表为空（回归哨兵）
"""
from pathlib import Path
from scripts.deploy_check import check_api_prefix


def test_deploy_check_detects_bare_path(tmp_path):
    """构造含裸路径的 JS 文件，check_api_prefix 应返回非空违规列表。"""
    js_file = tmp_path / "fake.js"
    js_file.write_text("""
API.foo = function() { return this.request('GET', '/fields'); };
API.bar = function(id) { return this.request('POST', '/storage/items'); };
""", encoding="utf-8")
    violations = check_api_prefix(str(tmp_path))
    assert len(violations) >= 2, f"应检出至少 2 个裸路径，实际 {violations}"
    assert any("/fields" in v for v in violations)
    assert any("/storage/items" in v for v in violations)


def test_deploy_check_accepts_api_prefix(tmp_path):
    """构造全 /api/ 前缀的 JS 文件，check_api_prefix 应返回空列表。"""
    js_file = tmp_path / "ok.js"
    js_file.write_text("""
API.foo = function() { return this.request('GET', '/api/fields'); };
API.bar = function(id) { return this.request('POST', '/api/storage/items'); };
API.baz = function(id) { return this.request('GET', '/api/tasks/' + id); };
""", encoding="utf-8")
    violations = check_api_prefix(str(tmp_path))
    assert violations == [], f"应无违规，实际 {violations}"


def test_current_api_js_all_prefixed():
    """回归哨兵：真实 nantang-mobile/js/api.js 违规列表应为空。"""
    js_dir = Path(__file__).resolve().parent.parent.parent / "nantang-mobile" / "js"
    violations = check_api_prefix(str(js_dir))
    assert violations == [], f"真实 api.js 存在裸路径: {violations}"
