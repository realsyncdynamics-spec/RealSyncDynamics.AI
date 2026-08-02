# Builder Orchestrator — FastAPI auf Uvicorn
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
# Die Migration wird beim Start angewendet — sie MUSS ins Image.
# Fehlt sie, bricht der Lifespan mit FileNotFoundError ab und der
# Container startet gar nicht (nur mit gesetzter DATABASE_URL sichtbar).
COPY migrations ./migrations

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
