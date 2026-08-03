'use client';

import { useState } from 'react';

// Basis-URL des Orchestrators. Im Compose-Stack via Traefik: http://builder.localhost
const BUILDER_URL = process.env.NEXT_PUBLIC_BUILDER_URL ?? 'http://builder.localhost';

type AgentTask = {
  id: string;
  agent_type: string;
  status: string;
  depends_on: string[];
};

type TaskGraph = {
  project_id: string;
  tasks: AgentTask[];
};

/**
 * Stub der Builder-Chat-UI: ein Formular, das eine BuildSpec an
 * /api/v1/builder/create-spec schickt und den erzeugten Task-Graph anzeigt.
 *
 * TODO: durch echte Chat-UI mit Streaming-Antworten der Agenten ersetzen.
 */
export default function BuilderPage() {
  const [projectName, setProjectName] = useState('Demo App');
  const [prompt, setPrompt] = useState('Baue ein Kundenportal mit Support-Chat.');
  const [dataTypes, setDataTypes] = useState('email, support_messages');
  const [graph, setGraph] = useState<TaskGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BUILDER_URL}/api/v1/builder/create-spec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: projectName,
          description: prompt.slice(0, 200),
          prompt,
          data_types: dataTypes.split(',').map((s) => s.trim()).filter(Boolean),
          data_subjects: ['customers'],
          models: ['claude-3-5-sonnet'],
          llm_provider: 'anthropic',
          jurisdiction: 'eu',
          target_stack: 'nextjs_supabase',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      setGraph(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 760 }}>
      <h1>App Builder</h1>
      <p>Prompt eingeben — der Orchestrator registriert das Projekt und baut den Task-Graph.</p>

      <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        <label>
          Projektname
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            style={{ width: '100%', padding: 8 }}
          />
        </label>

        <label>
          Datenarten (kommagetrennt)
          <input
            value={dataTypes}
            onChange={(e) => setDataTypes(e.target.value)}
            style={{ width: '100%', padding: 8 }}
          />
        </label>

        <label>
          Prompt
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            style={{ width: '100%', padding: 8 }}
          />
        </label>

        <button type="submit" disabled={loading} style={{ padding: 10 }}>
          {loading ? 'Baue Task-Graph…' : 'Build starten'}
        </button>
      </form>

      {error && <p style={{ color: '#b00020', marginTop: 24 }}>Fehler: {error}</p>}

      {graph && (
        <section style={{ marginTop: 32 }}>
          <h2>Task-Graph</h2>
          <p style={{ fontFamily: 'monospace' }}>{graph.project_id}</p>
          <ul>
            {graph.tasks.map((task) => (
              <li key={task.id} style={{ fontFamily: 'monospace' }}>
                {task.agent_type} — {task.status}
                {task.depends_on.length > 0 && ` (nach ${task.depends_on.join(', ')})`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
