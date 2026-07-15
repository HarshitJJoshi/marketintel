FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/
COPY collectors/ ./collectors/
COPY nlp/ ./nlp/
COPY scoring/ ./scoring/
COPY db.py .
COPY scheduler.py .

# Use shell form so $PORT gets expanded properly at runtime
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
