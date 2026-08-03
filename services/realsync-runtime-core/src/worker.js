// Cloudflare-Worker-Einstiegspunkt für den Containerbetrieb von
// realsync-runtime-core.
//
// Hintergrund: Der eigentliche Dienst ist ein Fastify-Node-Server mit
// dauerhaften TCP-Verbindungen zu Postgres, Redis (ioredis) und NATS. Solche
// Verbindungen laufen NICHT im V8-Edge-Runtime von Cloudflare Workers/Pages.
// Cloudflare **Containers** führen dagegen das Dockerfile als echten
// Linux-Container mit Netzwerk-Egress aus — dort laufen Fastify + die
// TCP-Clients unverändert. Dieser Worker ist nur der dünne Router davor:
// er reicht eingehende HTTP-Anfragen an die Container-Instanz durch und hält
// sie per Cron warm.
//
// Deployment/Secrets: siehe DEPLOY_CLOUDFLARE.md.

import { Container, getContainer } from '@cloudflare/containers';

export class RuntimeCoreContainer extends Container {
  // Muss mit dem Port übereinstimmen, auf dem Fastify im Container lauscht
  // (src/index.js → app.listen({ port: config.port, host: '0.0.0.0' })).
  // PORT wird unten als Env-Var auf denselben Wert gesetzt.
  defaultPort = 4000;

  // Wartezeit bis zum Schlafenlegen bei Inaktivität. Der Dienst hält einen
  // dauerhaften NATS-Event-Consumer offen (consumers/event.consumer.js) —
  // ein zu kurzes sleepAfter würde ihn abwürgen. Wir halten die Instanz lange
  // wach UND pingen sie zusätzlich per Cron (scheduled() unten + wrangler
  // crons), damit der Consumer auch ohne externen HTTP-Traffic weiterläuft.
  sleepAfter = '1h';

  // Worker-Secrets/Vars in die Prozess-Umgebung des Containers spiegeln.
  // Als Getter, damit this.env (die per `wrangler secret put` gesetzten
  // Werte) erst zum Container-Start gelesen wird. Namen 1:1 wie in
  // src/config.js erwartet.
  get envVars() {
    const e = this.env;
    return {
      NODE_ENV: 'production',
      PORT: '4000',
      LOG_LEVEL: e.LOG_LEVEL ?? 'info',
      GATEWAY_INTERNAL_API_KEY: e.GATEWAY_INTERNAL_API_KEY ?? '',
      JWT_SECRET: e.JWT_SECRET ?? '',
      RUNTIME_CORE_DATABASE_URL: e.RUNTIME_CORE_DATABASE_URL ?? '',
      REDIS_URL: e.REDIS_URL ?? '',
      NATS_URL: e.NATS_URL ?? '',
      NATS_USER: e.NATS_USER ?? 'realsync-core',
      NATS_PASSWORD: e.NATS_PASSWORD ?? '',
      EVIDENCE_RUNTIME_URL: e.EVIDENCE_RUNTIME_URL ?? '',
    };
  }
}

// Eine einzige, langlebige Instanz: Migrations laufen genau einmal beim Start
// und der NATS-Consumer soll genau einmal existieren — kein Sharding/Fan-out.
const INSTANCE = 'runtime-core-singleton';

export default {
  async fetch(request, env) {
    const container = getContainer(env.RUNTIME_CORE, INSTANCE);
    return container.fetch(request);
  },

  // Keep-warm: hält die Container-Instanz (und damit den NATS-Consumer) aktiv,
  // auch wenn kein externer HTTP-Traffic anliegt. Trifft den leichtgewichtigen
  // /health-Endpunkt (routes/health.js).
  async scheduled(_event, env, ctx) {
    const container = getContainer(env.RUNTIME_CORE, INSTANCE);
    ctx.waitUntil(
      container.fetch(new Request('https://runtime-core.internal/health')),
    );
  },
};
