#!/bin/bash
# Prompt Tool - Build Script for Linux/Mac
# Usage: ./build.sh [clean]

echo "========================================"
echo "Prompt Tool Build Script"
echo "========================================"

if [ "$1" == "clean" ]; then
    echo "Cleaning up..."
    rm -rf build dist __pycache__ app/__pycache__
    echo "Clean completed."
    exit 0
fi

echo "Building with Docker..."
docker-compose build

echo ""
echo "========================================"
echo "Build completed successfully!"
echo "========================================"
echo ""
echo "To run: docker-compose up -d"
echo "To stop: docker-compose down"
echo "To view logs: docker-compose logs -f"
echo ""