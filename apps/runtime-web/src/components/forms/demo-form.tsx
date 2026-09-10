import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export function DemoForm({ intent = "demo" }: { intent?: "demo" | "signin" }) {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = Object.fromEntries(data.entries());
    try {
      const key = intent === "signin" ? "rs-signin" : "rs-demo";
      localStorage.setItem(key, JSON.stringify({ ...payload, at: new Date().toISOString() }));
    } catch {
      /* ignore quota */
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-xl bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Eingegangen</p>
        <h2 className="mt-3 text-xl font-medium text-fg">
          {intent === "signin" ? "Zugangsanfrage erfasst." : "Architektur-Review angefragt."}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Diese Vorschau speichert die Anfrage lokal auf diesem Gerät. Ein produktiver Mandant würde
          sie an den Enterprise-Desk von RealSync Dynamics AI leiten. Es wurde kein Konto angelegt.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
      {intent === "signin" ? (
        <>
          <div>
            <Label htmlFor="email">Geschäftliche E-Mail</Label>
            <Input id="email" name="email" type="email" required className="mt-2" placeholder="sie@firma.de" />
          </div>
          <div>
            <Label htmlFor="tenant">Mandanten-Kürzel</Label>
            <Input id="tenant" name="tenant" required className="mt-2" placeholder="acme-ops" />
          </div>
          <Button type="submit" className="w-full">
            Weiter
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled>
            Mit Enterprise-SSO fortfahren
          </Button>
          <p className="text-xs text-subtle">SSO wird je Mandant bereitgestellt. In dieser Vorschau nicht verfügbar.</p>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required className="mt-2" />
            </div>
            <div>
              <Label htmlFor="email">Geschäftliche E-Mail</Label>
              <Input id="email" name="email" type="email" required className="mt-2" />
            </div>
          </div>
          <div>
            <Label htmlFor="company">Unternehmen</Label>
            <Input id="company" name="company" required className="mt-2" />
          </div>
          <div>
            <Label htmlFor="estate">Was soll die Runtime steuern?</Label>
            <Textarea
              id="estate"
              name="estate"
              className="mt-2"
              placeholder="KI-Agenten, Software-Delivery, industrielle Operationen…"
            />
          </div>
          <Button type="submit" className="w-full">
            Architektur-Review anfragen
          </Button>
        </>
      )}
    </form>
  );
}
