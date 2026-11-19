/**
 * Lädt eine Ressource und versucht es nach einem Fehlschlag genau einmal erneut.
 *
 * Hintergrund: Direkt nach einem Deploy kann der erste Abruf des Modells am kalten
 * Edge-Cache scheitern, danach klappt er. Ohne Neuversuch bleibt die Bühne leer.
 * Abgebrochen wird über `isCancelled` (z. B. nach `dispose()`); die zurückgegebene
 * Funktion räumt einen noch ausstehenden Neuversuch ab.
 */
export interface LoadWithRetryOptions<T> {
  /** Startet einen Ladeversuch und meldet Erfolg oder Fehler. */
  load(onSuccess: (value: T) => void, onFailure: () => void): void;
  /** Wird auch nach einem Abbruch gemeldet, damit der Aufrufer aufräumen kann. */
  onSuccess(value: T): void;
  /** Wird erst gemeldet, wenn auch der Neuversuch scheitert. */
  onError(): void;
  isCancelled(): boolean;
  /** Wartezeit vor dem Neuversuch in Millisekunden. */
  retryDelayMs?: number;
}

export const DEFAULT_RETRY_DELAY_MS = 1500;

export function loadWithRetry<T>(options: LoadWithRetryOptions<T>): () => void {
  const { load, onSuccess, onError, isCancelled, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const attempt = (retriesLeft: number) => {
    load(
      // Erfolg immer melden: Der Aufrufer muss ein spät geladenes Ergebnis selbst freigeben.
      (value) => onSuccess(value),
      () => {
        if (isCancelled()) return;
        if (retriesLeft > 0) {
          timer = setTimeout(() => {
            timer = null;
            if (!isCancelled()) attempt(retriesLeft - 1);
          }, retryDelayMs);
        } else {
          onError();
        }
      },
    );
  };

  attempt(1);

  return () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
