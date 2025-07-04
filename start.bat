@echo off
echo Starting ATD Auto Trading System...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    echo.
)

REM Create necessary directories
if not exist "data" mkdir data
if not exist "logs" mkdir logs
if not exist "config" mkdir config
if not exist "models" mkdir models
if not exist "routes" mkdir routes
if not exist "services" mkdir services
if not exist "public" mkdir public

REM Create initial apikeys.json if not exists
if not exist "data\apikeys.json" (
    echo {} > data\apikeys.json
)

REM Start the server
echo Starting server on port 80...
echo.
echo Dashboard: http://localhost
echo Webhook URL: http://YOUR_IP/order
echo.
echo Default login:
echo Username: root
echo Password: dldnjsgud
echo.

node server.js

pause