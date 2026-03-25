# Use Python 3.10 slim image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.main:app
ENV FLASK_ENV=production

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libjpeg-dev \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY scripts/migrations/init_db.py .
COPY scripts/migrations/migrate_db.py .
COPY run_standalone.py .

# Create necessary directories with proper permissions
RUN mkdir -p /app/app/uploads/previews /app/data && \
    chmod -R 777 /app/app/uploads /app/data

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/ || exit 1

# Create entrypoint script that initializes database at runtime
RUN echo '#!/bin/bash\n\
if [ ! -f /app/data/prompt_tool_v2.db ]; then\n\
    echo "Initializing database..."\n\
    cd /app && python init_db.py\n\
fi\n\
exec "$@"' > /entrypoint.sh && chmod +x /entrypoint.sh

# Use entrypoint to initialize database at runtime
ENTRYPOINT ["/entrypoint.sh"]

# Run the application
CMD ["python", "run_standalone.py"]