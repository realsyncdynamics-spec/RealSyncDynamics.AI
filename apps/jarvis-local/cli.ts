/**
 * Local-only Jarvis CLI. This does not start a web server, use cloud APIs,
 * fetch models or persist conversations. Notes are read only when passed via
 * --note and remain on this machine. See docs/runbooks/jarvis-local.md.
 */
import { lstat, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { OllamaAdapter } from '../../src/core/ai-gateway/providers/ollamaAdapter';
import { Orchestrator } from '../../src/core/agent-os/orchestrator';
import { JARVIS_LOCAL_AGENT, registerJarvisLocalAgent } from '../../src/core/agent-os/local-jarvis';

const LOCAL_OLLAMA_URL = 'http://127.0.0.1:11434';
const LOCAL_TENANT = 'local-personal';
const MAX_NOTES = 10;
const MAX_NOTE_BYTES = 16_000;

interface CliArgs {
  model: string;
  notes: string[];
  question: string;
}

function parseArgs(argv: string[]): CliArgs {
  let model = 'qwen2.5:7b';
  const notes: string[] = [];
  const question: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item === '--model' || item === '--note') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error('Wert für ' + item + ' fehlt.');
      if (item === '--model') model = value;
      else notes.push(value);
    } else if (item === '--help' || item === '-h') {
      process.stdout.write(
        'Aufruf: npx tsx apps/jarvis-local/cli.ts [--model qwen2.5:7b] ' +
        '[--note ./meine-notiz.md] "Frage an Jarvis"\n'
      );
      process.exit(0);
    } else if (item?.startsWith('--')) {
      throw new Error('Unbekannte Option: ' + item);
    } else if (item) {
      question.push(item);
    }
  }
  if (!/^[a-zA-Z0-9_.:/-]+$/.test(model)) throw new Error('Ungültiger Modellname.');
  if (notes.length > MAX_NOTES) throw new Error('Maximal 10 Notizdateien pro Aufruf.');
  if (question.join(' ').trim().length === 0) throw new Error('Eine Frage ist erforderlich.');
  return { model, notes, question: question.join(' ') };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const ollama = new OllamaAdapter({ model: args.model, baseUrl: LOCAL_OLLAMA_URL });
  const health = await ollama.health();
  if (!health.ok) {
    throw new Error(
      'Lokales Ollama nicht erreichbar (' + LOCAL_OLLAMA_URL + '). ' +
      'Starte Ollama auf deinem Computer. ' + (health.error ?? '')
    );
  }
  if (!health.models?.includes(args.model)) {
    throw new Error(
      'Modell nicht lokal vorhanden: ' + args.model +
      '. Einmalig herunterladen: ollama pull ' + args.model
    );
  }

  const orchestrator = new Orchestrator();
  registerJarvisLocalAgent(orchestrator, { model: args.model });

  for (const path of args.notes) {
    const absolute = resolve(path);
    const stat = await lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_NOTE_BYTES) {
      throw new Error('Notiz muss eine normale Datei mit höchstens 16 KB sein: ' + path);
    }
    const content = await readFile(absolute, 'utf8');
    orchestrator.store.addMemory({
      tenant_id: LOCAL_TENANT,
      topic: basename(absolute),
      content,
      source: absolute,
      tags: ['local-note'],
    });
  }

  const task = orchestrator.store.createTask({
    tenant_id: LOCAL_TENANT,
    agent: JARVIS_LOCAL_AGENT,
    task: 'Lokale Frage beantworten',
    created_by: 'local-user',
    input: { prompt: args.question },
  });
  const completed = await orchestrator.run(task.id);
  if (completed?.status !== 'done') {
    throw new Error('Jarvis konnte die Frage nicht beantworten: ' + (completed?.blocker_reason ?? 'Unbekannt'));
  }
  const output = orchestrator.store.listOutputsForTask(task.id)[0]?.content as
    | { answer?: unknown; model?: string }
    | undefined;
  if (!output || typeof output.answer !== 'string') {
    throw new Error('Jarvis hat keine lesbare Antwort zurückgegeben.');
  }
  process.stdout.write('JARVIS (' + (output.model ?? args.model) + '):\n' + output.answer + '\n');
}

void main().catch((error: unknown) => {
  process.stderr.write('Jarvis Local: ' + (error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
});
