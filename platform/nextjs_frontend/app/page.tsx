import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 760 }}>
      <h1>AI App Builder mit Governance-Gate</h1>
      <p>
        Jeder Build läuft durch das Governance-Backend: Risikoklasse nach EU AI Act, Gate-Katalog
        pro Klasse, Laufzeit-Telemetrie nach dem Deployment.
      </p>
      <ul>
        <li>
          <Link href="/builder">Builder</Link> — Prompt eingeben, Task-Graph erzeugen
        </li>
        <li>
          <Link href="/governance">Governance-Cockpit</Link> — Projekte und Risikoklassen
        </li>
      </ul>
    </main>
  );
}
