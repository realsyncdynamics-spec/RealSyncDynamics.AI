import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-6xl flex-col justify-center px-5 py-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">404</p>
      <h1 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-fg">Diese Route liegt nicht in der Runtime.</h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        Dieser Pfad ist nicht abgebildet. Zurück zur Control Plane.
      </p>
      <div className="mt-8">
        <Button asChild>
          <AppLink to="/">Start</AppLink>
        </Button>
      </div>
    </main>
  );
}
