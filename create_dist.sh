#!/bin/bash
# Prompt Tool - Standalone Distribution Script for Linux/Mac
# Creates a portable distribution package

echo "========================================"
echo "Prompt Tool - Creating Distribution"
echo "========================================"

DIST_DIR="dist/prompt_tool_linux"
APP_DIR="$DIST_DIR/app"

echo "Cleaning previous build..."
rm -rf dist

echo "Creating directory structure..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/templates"
mkdir -p "$APP_DIR/static"
mkdir -p "$APP_DIR/uploads/previews"

echo "Copying application files..."
cp -r app/templates/* "$APP_DIR/templates/"
cp -r app/static/* "$APP_DIR/static/"
cp app/main.py "$APP_DIR/"
cp app/database.py "$APP_DIR/"
cp app/__init__.py "$APP_DIR/"

echo "Copying scripts..."
cp init_db.py "$DIST_DIR/"
cp migrate_db.py "$DIST_DIR/"
cp requirements.txt "$DIST_DIR/"

echo "Creating start script..."
cat > "$DIST_DIR/start.sh" << 'EOF'
#!/bin/bash
echo "Starting Prompt Tool..."
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt > /dev/null 2>&1

if [ ! -f "app/prompt_tool_v2.db" ]; then
    echo "Initializing database..."
    python init_db.py
fi

echo ""
echo "========================================"
echo "Prompt Tool is starting..."
echo "Access at: http://localhost:5001"
echo "Press Ctrl+C to stop"
echo "========================================"
echo ""

python -c "from app.main import app; app.run(host='0.0.0.0', port=5001, debug=False)"
EOF

chmod +x "$DIST_DIR/start.sh"

echo "Creating README..."
cat > "$DIST_DIR/README.txt" << 'EOF'
# Prompt Tool

## Quick Start
1. Run: ./start.sh
2. Wait for initialization
3. Open http://localhost:5001 in browser

## Requirements
- Python 3.10+ (must be in PATH)

## Troubleshooting
If startup fails, try:
- Install Python 3.10+
- Run: pip install -r requirements.txt
- Run: python init_db.py
- Run: python -c "from app.main import app; app.run(port=5001)"
EOF

echo ""
echo "========================================"
echo "Distribution created at: $DIST_DIR"
echo "========================================"
echo ""
echo "To package: tar -czvf prompt_tool_linux.tar.gz -C dist prompt_tool_linux"
echo ""