#!/usr/bin/env node
/**
 * SYNC media handoff: validate the editorial plan and generate editable assets.
 * Node.js built-ins only. This tool creates NO video/audio and never calls an API.
 *
 * node scripts/generate-sync-storyboard.mjs --check
 * node scripts/generate-sync-storyboard.mjs --out /tmp/sync-media
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const input = new URL('../docs/brand/sync/storyboard.json', import.meta.url);
const args = process.argv.slice(2);

function fail(message) {
  throw new Error('SYNC storyboard: ' + message);
}

function validate(plan) {
  if (plan?.schemaVersion !== 1) fail('unsupported schema version');
  const duration = plan?.format?.durationSeconds;
  if (!Number.isInteger(duration) || duration !== 90) fail('duration must equal 90 seconds');
  if (plan?.language !== 'de-DE') fail('audio language must be de-DE');
  if (!Array.isArray(plan.scenes) || !plan.scenes.length) fail('missing scenes');

  let position = 0;
  const ids = new Set();
  const tracks = new Set();
  for (const scene of plan.scenes) {
    if (typeof scene.id !== 'string' || ids.has(scene.id)) fail('missing/duplicate scene id');
    ids.add(scene.id);
    tracks.add(scene.track);
    if (!Number.isInteger(scene.start) || !Number.isInteger(scene.end)) fail(scene.id + ' uses non-integer times');
    if (scene.start !== position || scene.end <= scene.start || scene.end > duration) fail(scene.id + ' creates gap/overlap');
    position = scene.end;
    if (!scene.title || !scene.visual || !scene.proof || !scene.claim) fail(scene.id + ' missing editorial gate');
    if (!Array.isArray(scene.audio) || !scene.audio.length ||
        scene.audio.some((a) => !a.speaker || !a.text)) fail(scene.id + ' missing voice script');
    if (!Array.isArray(scene.captions) || !scene.captions.length) fail(scene.id + ' missing captions');

    let subtitlePosition = scene.start;
    for (const cue of scene.captions) {
      if (!Number.isInteger(cue.start) || !Number.isInteger(cue.end)) fail(scene.id + ' cue timing invalid');
      if (cue.start !== subtitlePosition || cue.end <= cue.start || cue.end > scene.end || !cue.text)
        fail(scene.id + ' cue gap/overlap or missing text');
      subtitlePosition = cue.end;
    }
    if (subtitlePosition !== scene.end) fail(scene.id + ' subtitles must cover whole scene');
  }
  if (position !== duration) fail('total duration does not match scene ends');
  for (const track of ['sync-3d', 'voice-demo', 'backend-capture', 'frontend-capture', 'governance-capture'])
    if (!tracks.has(track)) fail('missing required track: ' + track);
  const routes = plan.productRoutesTarget;
  if (!Array.isArray(routes) || routes.length !== 6 || new Set(routes).size !== 6 ||
      routes.some((route) => !/^\/[a-z-]+$/.test(route))) fail('expected six canonical target product routes');
  return { scenes: ids.size, captions: plan.scenes.reduce((n, s) => n + s.captions.length, 0) };
}

function timecode(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor(seconds / 60 % 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return h + ':' + m + ':' + s + '.000';
}

function escapeCsv(value) {
  const s = String(value ?? '').replace(/\r?\n/g, ' ');
  // Guard spreadsheet readers against formula execution.
  const safe = /^[=+@-]/.test(s) ? "'" + s : s;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function buildVtt(plan) {
  const cues = plan.scenes.flatMap((scene) => scene.captions);
  return 'WEBVTT\n\n' + cues.map((cue, index) =>
    String(index + 1) + '\n' + timecode(cue.start) + ' --> ' + timecode(cue.end) + '\n' + cue.text + '\n'
  ).join('\n');
}

function buildShotCsv(plan) {
  const columns = ['shot', 'start_s', 'end_s', 'track', 'title', 'visual', 'claim_gate', 'evidence_required'];
  const records = plan.scenes.map((s) =>
    [s.id, s.start, s.end, s.track, s.title, s.visual, s.claim, s.proof].map(escapeCsv).join(','));
  return columns.join(',') + '\n' + records.join('\n') + '\n';
}

function buildScript(plan) {
  return '# SYNC · Deutsches Master-Voice-Skript (90 Sekunden)\n\n' +
    '> **Produktionstext, keine echte Gesprächsaufzeichnung.** Das Beispieltelefonat ist fiktiv.\n' +
    '> Vor Veröffentlichung Voice-API, UI, Einwilligung und jeden Leistungsclaim separat prüfen.\n\n' +
    plan.scenes.map((s) => '## ' + s.id + ' · ' + timecode(s.start) + '–' + timecode(s.end) +
      ' · ' + s.title + '\n\n' + s.audio.map((a) => '**' + a.speaker + ':** ' + a.text).join('\n\n') +
      '\n\n**Bild:** ' + s.visual + '\n\n**Prüfnachweis:** ' + s.proof + '\n').join('\n');
}

const plan = JSON.parse(await readFile(input, 'utf8'));
const result = validate(plan);

if (args.length === 1 && args[0] === '--check') {
  process.stdout.write('SYNC OK: ' + result.scenes + ' Szenen, 90 Sekunden, ' +
    result.captions + ' Untertitel-Cues, 6 Produktziele.\n');
} else if (args.length === 2 && args[0] === '--out' && args[1]) {
  const directory = resolve(args[1]);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(resolve(directory, 'SYNC_Master_90s.vtt'), buildVtt(plan), 'utf8'),
    writeFile(resolve(directory, 'SYNC_Shotlist.csv'), buildShotCsv(plan), 'utf8'),
    writeFile(resolve(directory, 'SYNC_VoiceScript.md'), buildScript(plan), 'utf8'),
  ]);
  process.stdout.write('SYNC-Produktionsdateien erstellt: ' + directory + '\n');
} else {
  process.stderr.write('Nutzung: node scripts/generate-sync-storyboard.mjs --check | --out <Verzeichnis>\n');
  process.exitCode = 2;
}
