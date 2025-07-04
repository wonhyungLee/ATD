@echo off
echo ATD Auto Trading System Installation
echo ====================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found: 
node --version
echo.

REM Create all necessary files
echo Creating directory structure...

REM Create directories
mkdir config 2>nul
mkdir models 2>nul
mkdir routes 2>nul
mkdir services 2>nul
mkdir public 2>nul
mkdir data 2>nul
mkdir logs 2>nul

echo Directories created.
echo.

REM Initialize npm and install dependencies
echo Installing dependencies...
npm install

REM Create initial data file
echo {} > data\apikeys.json

echo.
echo Installation complete!
echo.
echo Next steps:
echo 1. Copy all source files to their respective directories
echo 2. Run 'start.bat' to start the server
echo 3. Open http://localhost in your browser
echo.

pause