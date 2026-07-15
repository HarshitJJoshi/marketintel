FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY api/ ./api/
COPY collectors/ ./collectors/
COPY nlp/ ./nlp/
COPY scoring/ ./scoring/
COPY db.py .
COPY scheduler.py .

# Expose port (Railway provides $PORT dynamically)
EXPOSE 8000

# Start command
CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}
