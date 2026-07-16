FROM python:3.11-slim 

WORKDIR /app 

RUN apt-get update && apt-get install -y --no-install-recommends \ 
    gcc \ 
    g++ \ 
    ca-certificates \ 
    && update-ca-certificates \ 
    && rm -rf /var/lib/apt/lists/* 

COPY requirements-pipeline.txt . 

RUN pip install --no-cache-dir --upgrade pip && \ 
    pip install --no-cache-dir -r requirements-pipeline.txt 

# Create the missing directory structure needed by your API
RUN mkdir -p data/processed

COPY api/ ./api/ 
COPY collectors/ ./collectors/ 
COPY nlp/ ./nlp/ 
COPY scoring/ ./scoring/ 
COPY db.py . 
COPY scheduler.py . 

# Hardcoded to 8080 to match your Railway Target Port settings 
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
