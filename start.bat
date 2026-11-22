@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
where node.exe >nul 2>nul
if errorlevel 1 goto need_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto need_node
node -e "const minimum=require('./package.json').engines.node.slice(2).split('.').map(Number); const current=process.versions.node.split('.').map(Number); const index=minimum.findIndex((value,i)=>value!==current[i]); process.exitCode=+(index>=0 && current[index]<minimum[index]);"
if errorlevel 1 goto need_node

if not exist "node_modules\.bin\next.cmd" (
  echo Đang cài thư viện...
  call npm ci
  if errorlevel 1 goto failed
)
node scripts/check-build.mjs
if errorlevel 1 (
  echo Đang chuẩn bị bản chạy...
  call npm run build
  if errorlevel 1 goto failed
)
start "" /b node scripts/open-browser.mjs
echo Mở http://localhost:3000. Giữ cửa sổ này khi sử dụng website.
call npm start
if errorlevel 1 goto failed
exit /b 0

:need_node
echo Hãy cài hoặc cập nhật Node.js LTS kèm npm từ https://nodejs.org/ rồi mở lại start.bat.
pause
exit /b 1

:failed
echo Chưa mở được website. Hãy xem thông báo ở trên.
pause
exit /b 1
