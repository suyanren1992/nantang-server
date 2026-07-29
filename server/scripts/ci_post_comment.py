"""Post pytest output as a commit comment on GitHub (CI only)."""
import json, os, sys, urllib.request

out_file = sys.argv[1] if len(sys.argv) > 1 else "/tmp/pytest-out.txt"
try:
    out = open(out_file).read()[-6000:]
except FileNotFoundError:
    out = "(no pytest output file found)"

body = "## CI pytest failure log\n\n```\n" + out + "\n```"
data = json.dumps({"body": body}).encode()
repo = os.environ.get("GITHUB_REPOSITORY", "")
sha = os.environ.get("GITHUB_SHA", "")
token = os.environ.get("GH_TOKEN", "")

if not repo or not sha or not token:
    print("Missing GITHUB_REPOSITORY / GITHUB_SHA / GH_TOKEN, skipping")
    sys.exit(0)

url = f"https://api.github.com/repos/{repo}/commits/{sha}/comments"
req = urllib.request.Request(url, data=data, headers={
    "Authorization": f"token {token}",
    "Content-Type": "application/json"})
try:
    resp = urllib.request.urlopen(req, timeout=15)
    print(f"Comment posted: {resp.status}")
except Exception as e:
    print(f"Comment failed: {e}")
