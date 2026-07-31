#!/bin/bash
# 南塘云村 · 服务器部署脚本
# 用法：chmod +x deploy.sh && sudo ./deploy.sh
# 适用：Ubuntu/Debian VPS

set -e
APP_DIR="/opt/nantang"
VENV_DIR="$APP_DIR/server/venv"
DOMAIN="${1:-nantang.example.com}"

echo "=== 南塘云村 · 部署 ==="

# 1. 安装依赖（certbot + nginx 插件用于 HTTPS · H-6）
apt update && apt install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx

# 2. 创建目录
mkdir -p $APP_DIR

# 3. 复制文件（从当前目录，排除 venv/__pycache__/db）
cp -r ../nantang-mobile $APP_DIR/
rsync -av --exclude='venv' --exclude='__pycache__' --exclude='*.db' . $APP_DIR/server/
cp ../requirements.txt $APP_DIR/requirements.txt
cp ../requirements-dev.txt $APP_DIR/requirements-dev.txt

# 4. 创建虚拟环境
python3 -m venv $VENV_DIR
source $VENV_DIR/bin/activate
pip install -r $APP_DIR/requirements.txt
pip install -r $APP_DIR/requirements-dev.txt

# 4b. 部署前机器闸门（六检 + 测试，任一 FAIL 即中止部署）
echo "--- 部署前六检 ---"
python $APP_DIR/server/scripts/deploy_check.py --skip-smoke
echo "--- 后端测试 ---"
JWT_SECRET=deploy-gate-dummy python -m pytest $APP_DIR/server/tests/ -x -q
echo "--- 机器闸门全部通过 ---"

# 5. systemd 服务
cat > /etc/systemd/system/nantang.service << EOF
[Unit]
Description=Nantang Cloud Village
After=network.target

[Service]
User=www-data
WorkingDirectory=$APP_DIR/server
EnvironmentFile=/etc/nantang.env
ExecStart=$VENV_DIR/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 6. nginx 反代（先监听 80；certbot 随后自动追加 443 服务器块 + HTTP→HTTPS 重定向 · H-6）
cat > /etc/nginx/sites-available/nantang << EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 10m;

    location / {
        root $APP_DIR/nantang-mobile;
        try_files \$uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

ln -sf /etc/nginx/sites-available/nantang /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 7. 启动
systemctl daemon-reload
systemctl enable nantang
systemctl restart nantang
nginx -t && systemctl restart nginx

# 7b. H-6: HTTPS — Let's Encrypt certbot 申请证书 + 自动配置 443 + 重定向
CERTBOT_EMAIL="${CERTBOT_EMAIL:-webmaster@$DOMAIN}"
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect; then
    echo "✅ HTTPS 证书已申请并启用 (Let's Encrypt)"
else
    echo "⚠️ certbot 申请失败——请确认 DNS 已解析到本机后手动运行："
    echo "   certbot --nginx -d $DOMAIN --redirect"
fi

# 8. 环境变量（ADMIN_BOOTSTRAP_PASSWORD 必须设置——C-1 守卫会在生产环境拒绝默认密码）
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
ADMIN_BOOTSTRAP_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(18))")
cat > /etc/nantang.env << EOF
JWT_SECRET=$JWT_SECRET
ADMIN_BOOTSTRAP_PASSWORD=$ADMIN_BOOTSTRAP_PASSWORD
ENVIRONMENT=production
CRON_ACTIVE=1
FRONTEND_ORIGIN=https://$DOMAIN
MAX_BEDS_PER_ROOM=6
EOF
chmod 600 /etc/nantang.env

echo ""
echo "=== 部署完成 ==="
echo "访问: https://$DOMAIN"
echo "CRON_ACTIVE=1 · 服务端 cron 已激活"
echo "JWT 密钥已随机生成"
echo "管理员初始密码（仅本次显示，请立即登录修改）: $ADMIN_BOOTSTRAP_PASSWORD"
echo ""
echo "查看日志: journalctl -u nantang -f"
echo ""
echo "环境变量: cat /etc/nantang.env"
