@echo off
REM Prompt Tool - Run Script for Windows
REM Usage: run.bat [stop|logs|restart]

if "%1"=="stop" (
    echo Stopping containers...
    docker-compose down
    goto :end
)

if "%1"=="logs" (
    echo Showing logs...
    docker-compose logs -f
    goto :end
)

if "%1"=="restart" (
    echo Restarting containers...
    docker-compose restart
    goto :end
)

echo Starting Prompt Tool...
echo Access the application at: http://localhost:5001
echo Press Ctrl+C to stop
echo.
docker-compose up

:end