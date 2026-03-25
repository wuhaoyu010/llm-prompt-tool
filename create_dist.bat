@echo off
REM Prompt Tool - Standalone Distribution Script for Windows
REM Creates a portable distribution package

echo ========================================
echo Prompt Tool - Creating Distribution
echo ========================================

set DIST_DIR=dist\prompt_tool_windows
set APP_DIR=%DIST_DIR%\app

echo Cleaning previous build...
if exist dist rmdir /s /q dist

echo Creating directory structure...
mkdir %DIST_DIR%
mkdir %APP_DIR%
mkdir %APP_DIR%\templates
mkdir %APP_DIR%\static
mkdir %APP_DIR%\uploads\previews

echo Copying application files...
xcopy /E /I app\templates %APP_DIR%\templates
xcopy /E /I app\static %APP_DIR%\static
copy app\main.py %APP_DIR%\
copy app\database.py %APP_DIR%\
copy app\__init__.py %APP_DIR%\

echo Copying scripts...
copy init_db.py %DIST_DIR%\
copy migrate_db.py %DIST_DIR%\
copy requirements.txt %DIST_DIR%\

echo Creating start script...
(
echo @echo off
echo echo Starting Prompt Tool...
echo cd /d %%~dp0
echo if not exist venv ^(
echo     echo Creating virtual environment...
echo     python -m venv venv
echo ^)
echo call venv\Scripts\activate
echo pip install -r requirements.txt ^>nul 2^>^&1
echo if not exist app\prompt_tool_v2.db ^(
echo     echo Initializing database...
echo     python init_db.py
echo ^)
echo echo.
echo echo ========================================
echo echo Prompt Tool is starting...
echo echo Access at: http://localhost:5001
echo echo Press Ctrl+C to stop
echo echo ========================================
echo echo.
echo python -c "from app.main import app; app.run^(host='0.0.0.0', port=5001, debug=False^)"
) > %DIST_DIR%\start.bat

echo Creating README...
(
echo # Prompt Tool
echo.
echo ## Quick Start
echo 1. Double-click start.bat
echo 2. Wait for initialization
echo 3. Open http://localhost:5001 in browser
echo.
echo ## Requirements
echo - Python 3.10+ ^(must be in PATH^)
echo.
echo ## Troubleshooting
echo If startup fails, try:
echo - Install Python 3.10+ from python.org
echo - Run: pip install -r requirements.txt
echo - Run: python init_db.py
echo - Run: python -c "from app.main import app; app.run^(port=5001^)"
) > %DIST_DIR%\README.txt

echo.
echo ========================================
echo Distribution created at: %DIST_DIR%
echo ========================================
echo.
echo To package: Right-click the dist folder and "Send to compressed (zipped) folder"
echo.

pause