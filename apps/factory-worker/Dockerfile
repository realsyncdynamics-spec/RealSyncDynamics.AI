# SF-002 proof-of-concept. Pin this upstream base image by digest before controlled CI use.
FROM node:22.16.0-bookworm-slim
RUN groupadd --gid 10001 factory && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /tmp factory
WORKDIR /opt/factory
COPY apps/factory-worker/spec.mjs apps/factory-worker/worker.mjs ./
USER 10001:10001
ENTRYPOINT ["node", "/opt/factory/worker.mjs"]
