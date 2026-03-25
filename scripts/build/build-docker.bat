@echo off
REM Prompt Tool - Build Script for Windows
REM Usage: build.bat [clean]

echo ========================================
echo Prompt Tool Build Script
echo ========================================

if "%1"=="clean" (
    echo Cleaning up...
    if exist build rmdir /s /q build
    if exist dist rmdir /s /q dist
    if exist __pycache__ rmdir /s /q __pycache__
    if exist app\__pycache__ rmdir /s /q app\__pycache__
    echo Clean completed.
    goto :end
)

echo Building with Docker...
docker-compose build

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo To run: docker-compose up -d
echo To stop: docker-compose down
echo To view logs: docker-compose logs -f
echo.

:end