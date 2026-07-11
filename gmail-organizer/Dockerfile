FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY .env .env.example* ./

# Create directories for credentials and data
RUN mkdir -p /app/credentials /app/data /app/logs

# Set environment variable
ENV PYTHONUNBUFFERED=1

# Run the application
CMD ["python", "-m", "app.main"]
