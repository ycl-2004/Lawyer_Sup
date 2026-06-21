#!/bin/bash
# LawDesk Junior 一键启动（macOS 双击运行）
# 首次运行会自动安装依赖（需要联网，约 2-5 分钟）；之后启动只需数秒。
cd "$(dirname "$0")"
set -e

echo "================================================"
echo "  LawDesk Junior · 初级律师工作台（本地运行）"
echo "  数据仅保存在本机，案件 14 天无活动自动清理"
echo "================================================"

# 1. 检查 Python
if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 未检测到 Python3。请先安装：https://www.python.org/downloads/（下载后双击安装即可）"
  read -p "按回车键退出..." && exit 1
fi

# 2. 后端依赖（首次自动安装）
if [ ! -d backend/.venv ]; then
  echo "▶ 首次运行：正在创建 Python 环境并安装依赖..."
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q --upgrade pip
  backend/.venv/bin/pip install -q -r backend/requirements.txt \
    || backend/.venv/bin/pip install -q -r backend/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
fi

# 3. 前端构建产物（首次需要 Node.js；之后不再需要）
if [ ! -d dist ]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "❌ 首次运行需要 Node.js 来构建界面。请安装：https://nodejs.org/（LTS 版，双击安装）"
    echo "   安装后重新双击本文件即可。"
    read -p "按回车键退出..." && exit 1
  fi
  echo "▶ 首次运行：正在构建界面（仅需一次）..."
  npm install --no-audit --no-fund || npm install --registry=https://registry.npmmirror.com
  npm run build
fi

# 4. 启动（单地址：http://localhost:8000）
echo "▶ 正在启动... 浏览器将自动打开 http://localhost:8000"
echo "  关闭本窗口即停止运行。"
( sleep 2 && open "http://localhost:8000" ) &
cd backend
exec .venv/bin/python -m uvicorn app.main:app --port 8000
