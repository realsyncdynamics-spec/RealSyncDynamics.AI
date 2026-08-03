# Builder Orchestrator — FastAPI auf Uvicorn
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Kein Root im Container: Ein Prozess, der generierten Code ausfuehrt
# (BUILDER_TEST_COMMAND), soll das nicht als Root tun.
RUN useradd --create-home --uid 10001 dienst

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
# Die Migration wird beim Start angewendet — sie MUSS ins Image.
# Fehlt sie, bricht der Lifespan mit FileNotFoundError ab und der
# Container startet gar nicht (nur mit gesetzter DATABASE_URL sichtbar).
COPY migrations ./migrations

# Das Workspace-Verzeichnis muss dem Dienst gehoeren, bevor das Volume
# gemountet wird: Docker uebernimmt Inhalt und Eigentuemer des Image-Pfads in
# ein frisch angelegtes Named Volume. Fehlt der Schritt, gehoert der Mountpunkt
# Root und der Nicht-Root-Prozess kann nichts schreiben.
RUN mkdir -p /workspaces && chown dienst:dienst /workspaces

USER dienst

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
