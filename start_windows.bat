@echo off
chcp 65001 >nul
REM LawDesk Junior 一键启动（Windows 双击运行）
cd /d "%~dp0"

echo ================================================
echo   LawDesk Junior · 初级律师工作台（本地运行）
echo   数据仅保存在本机，案件 14 天无活动自动清理
echo ================================================

where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Python。请安装：https://www.python.org/downloads/
  echo 安装时请勾选 "Add Python to PATH"，然后重新双击本文件。
  pause & exit /b 1
)

if not exist backend\.venv (
  echo [首次运行] 正在创建 Python 环境并安装依赖...
  python -m venv backend\.venv
  backend\.venv\Scripts\pip install -q -r backend\requirements.txt
)

if not exist dist (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo [错误] 首次运行需要 Node.js 构建界面：https://nodejs.org/ 安装 LTS 版后重试。
    pause & exit /b 1
  )
  echo [首次运行] 正在构建界面（仅需一次）...
  call npm install --no-audit --no-fund
  call npm run build
)

echo 正在启动... 浏览器将自动打开 http://localhost:8000
start "" "http://localhost:8000"
cd backend
.venv\Scripts\python -m uvicorn app.main:app --port 8000
pause
