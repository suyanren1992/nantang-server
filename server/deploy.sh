#!/bin/bash
# 南塘云村 · 服务器部署脚本
# 用法：chmod +x deploy.sh && sudo ./deploy.sh
# 适用：Ubuntu/Debian VPS

set -e
APP_DIR="/opt/nantang"
VENV_DIR="$APP_DIR/server/venv"
DOMAIN="${1:-nantang.example.com}"

echo "=== 南塘云村 · 部署 ==="

# 1. 安装依赖
apt update && apt install -y python3 python3-venv python3-pip nginx

# 2. 创建目录
mkdir -p $APP_DIR

# 3. 复制文件（从当前目录，排除 venv/__pycache__/db）
cp -r ../nantang-mobile $APP_DIR/
rsync -av --exclude='venv' --exclude='__pycache__' --exclude='*.db' . $APP_DIR/server/

# 4. 创建虚拟环境
python3 -m venv $VENV_DIR
source $VENV_DIR/bin/activate
pip install fastapi uvicorn sqlalchemy aiosqlite python-jose[cryptography] passlib[bcrypt] bcrypt pydantic

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

# 6. nginx 反代
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
systemctl restart nginx

# 8. 环境变量
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
cat > /etc/nantang.env << EOF
JWT_SECRET=$JWT_SECRET
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
echo ""
echo "查看日志: journalctl -u nantang -f"
echo ""
echo "环境变量: cat /etc/nantang.env"
