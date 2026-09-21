/**
 * Streaming parser for the bolt.diy artifact protocol.
 *
 * Inspired by stackblitz-labs/bolt.diy `app/lib/runtime/message-parser.ts`
 * (MIT). Rewritten without Remix / logger / nanostores so RealSync can
 * run it in Vite + React Router and in tests.
 */

import type { BoltAction, BoltArtifact, ParseEvent, ParsedAction, ActionType } from './types';

const ARTIFACT_OPEN = '<boltArtifact';
const ARTIFACT_CLOSE = '</boltArtifact>';
const ACTION_OPEN = '<boltAction';
const ACTION_CLOSE = '</boltAction>';

function stripFence(content: string, filePath: string): string {
  if (filePath.endsWith('.md')) return content;
  const match = content.match(/^\s*```\w*\n([\s\S]*?)\n\s*```\s*$/);
  return match ? match[1] : content;
}

function unescapeTags(content: string): string {
  return content.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? match[1] : undefined;
}

function parseActionTag(tag: string): BoltAction {
  const type = (attr(tag, 'type') ?? 'file') as ActionType;
  if (type === 'supabase') {
    const operation = attr(tag, 'operation') === 'query' ? 'query' : 'migration';
    return { type: 'supabase', operation, filePath: attr(tag, 'filePath'), content: '' };
  }
  if (type === 'file') {
    return { type: 'file', filePath: attr(tag, 'filePath') ?? '', content: '' };
  }
  return { type: type === 'start' || type === 'build' ? type : 'shell', content: '' };
}

interface MessageState {
  position: number;
  insideArtifact: boolean;
  insideAction: boolean;
  artifactCounter: number;
  actionId: number;
  currentArtifact?: BoltArtifact;
  currentAction?: BoltAction;
}

export class StreamingMessageParser {
  #messages = new Map<string, MessageState>();

  reset(): void {
    this.#messages.clear();
  }

  parse(messageId: string, input: string): ParseEvent[] {
    let state = this.#messages.get(messageId);
    if (!state) {
      state = {
        position: 0,
        insideArtifact: false,
        insideAction: false,
        artifactCounter: 0,
        actionId: 0,
      };
      this.#messages.set(messageId, state);
    }

    const events: ParseEvent[] = [];
    let i = state.position;
    let textBuf = '';

    const flushText = () => {
      if (textBuf) {
        events.push({ kind: 'text', text: textBuf });
        textBuf = '';
      }
    };

    while (i < input.length) {
      if (state.insideArtifact && state.currentArtifact) {
        if (state.insideAction && state.currentAction) {
          const close = input.indexOf(ACTION_CLOSE, i);
          if (close === -1) {
            if (state.currentAction.type === 'file') {
              const partial = unescapeTags(stripFence(input.slice(i), state.currentAction.filePath));
              events.push({
                kind: 'action-stream',
                parsed: {
                  artifactId: state.currentArtifact.id,
                  actionId: String(state.actionId - 1),
                  action: { ...state.currentAction, content: partial },
                },
              });
            }
            break;
          }
          let content = (state.currentAction.content + input.slice(i, close)).trim();
          if (state.currentAction.type === 'file') {
            content = unescapeTags(stripFence(content, state.currentAction.filePath));
            if (!content.endsWith('\n')) content += '\n';
          }
          const closed: ParsedAction = {
            artifactId: state.currentArtifact.id,
            actionId: String(state.actionId - 1),
            action: { ...state.currentAction, content } as BoltAction,
          };
          events.push({ kind: 'action-close', parsed: closed });
          state.insideAction = false;
          state.currentAction = undefined;
          i = close + ACTION_CLOSE.length;
          continue;
        }

        const actionOpen = input.indexOf(ACTION_OPEN, i);
        const artifactClose = input.indexOf(ARTIFACT_CLOSE, i);
        if (actionOpen !== -1 && (artifactClose === -1 || actionOpen < artifactClose)) {
          const end = input.indexOf('>', actionOpen);
          if (end === -1) break;
          state.insideAction = true;
          state.currentAction = parseActionTag(input.slice(actionOpen, end + 1));
          const parsed: ParsedAction = {
            artifactId: state.currentArtifact.id,
            actionId: String(state.actionId++),
            action: state.currentAction,
          };
          events.push({ kind: 'action-open', parsed });
          i = end + 1;
          continue;
        }
        if (artifactClose !== -1) {
          events.push({ kind: 'artifact-close', artifactId: state.currentArtifact.id });
          state.insideArtifact = false;
          state.currentArtifact = undefined;
          i = artifactClose + ARTIFACT_CLOSE.length;
          continue;
        }
        break;
      }

      if (input.startsWith(ARTIFACT_OPEN, i)) {
        const next = input[i + ARTIFACT_OPEN.length];
        if (next && next !== '>' && next !== ' ') {
          textBuf += input[i];
          i += 1;
          continue;
        }
        const end = input.indexOf('>', i);
        if (end === -1) break;
        flushText();
        const tag = input.slice(i, end + 1);
        const artifact: BoltArtifact = {
          id: `${messageId}-${state.artifactCounter++}`,
          title: attr(tag, 'title') ?? 'Untitled',
          type: attr(tag, 'type'),
        };
        state.insideArtifact = true;
        state.currentArtifact = artifact;
        events.push({ kind: 'artifact-open', artifact });
        i = end + 1;
        continue;
      }

      textBuf += input[i];
      i += 1;
    }

    flushText();
    state.position = i;
    return events;
  }
}

/** Collect completed file/shell actions from a full (non-streaming) message. */
export function collectActions(messageId: string, input: string): ParsedAction[] {
  const parser = new StreamingMessageParser();
  const events = parser.parse(messageId, input);
  return events.filter((e): e is Extract<ParseEvent, { kind: 'action-close' }> => e.kind === 'action-close').map((e) => e.parsed);
}
