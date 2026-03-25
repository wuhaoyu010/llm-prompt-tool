#!/bin/bash
# Prompt Tool - Run Script for Linux/Mac
# Usage: ./run.sh [stop|logs|restart]

if [ "$1" == "stop" ]; then
    echo "Stopping containers..."
    docker-compose down
    exit 0
fi

if [ "$1" == "logs" ]; then
    echo "Showing logs..."
    docker-compose logs -f
    exit 0
fi

if [ "$1" == "restart" ]; then
    echo "Restarting containers..."
    docker-compose restart
    exit 0
fi

echo "Starting Prompt Tool..."
echo "Access the application at: http://localhost:5001"
echo "Press Ctrl+C to stop"
echo ""
docker-compose up