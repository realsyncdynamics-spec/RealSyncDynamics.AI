/**
 * Audit Logger — revisionssicheres Logging aller Nutzeraktionen
 * Für DSGVO-Konformität, Evidence-Vault und Compliance-Prüfungen
 */

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: {
    userId: string;
    email: string;
    ipAddress?: string;
  };
  action: string;
  resource: {
    type: string; // 'audit', 'website', 'team', 'billing', 'settings', etc.
    id: string;
    name?: string;
  };
  details: Record<string, unknown>;
  result: 'success' | 'failure';
  errorMessage?: string;
  // Evidence-Trail Metadaten
  hash?: string; // SHA-256 für Revision-Sicherheit
  previousHash?: string; // Referenz zum vorherigen Log-Entry
}

export class AuditLogger {
  private static storageKey = 'realsync-audit-logs';
  private static logs: AuditLogEntry[] = [];

  /**
   * Log-Eintrag erstellen und speichern
   */
  static log(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'hash' | 'previousHash'>): AuditLogEntry {
    const timestamp = new Date().toISOString();
    const id = this.generateId();

    const fullEntry: AuditLogEntry = {
      ...entry,
      id,
      timestamp,
    };

    // Hash generieren (vereinfacht — in Produktion: SHA-256)
    const logJson = JSON.stringify({
      id,
      timestamp,
      actor: entry.actor,
      action: entry.action,
      resource: entry.resource,
      result: entry.result,
    });
    fullEntry.hash = this.simpleHash(logJson);

    // Vorheriger Hash referenzieren für Chain-Sicherheit
    if (this.logs.length > 0) {
      fullEntry.previousHash = this.logs[this.logs.length - 1].hash;
    }

    this.logs.push(fullEntry);
    this.persistLogs();

    console.log(`[AUDIT] ${entry.action} on ${entry.resource.type}:${entry.resource.id}`, {
      result: entry.result,
      actor: entry.actor.email,
    });

    return fullEntry;
  }

  /**
   * Alle Logs für einen bestimmten Nutzer abrufen
   */
  static getLogs(userId?: string, limit: number = 100): AuditLogEntry[] {
    let filtered = [...this.logs];

    if (userId) {
      filtered = filtered.filter((log) => log.actor.userId === userId);
    }

    return filtered.slice(-limit);
  }

  /**
   * Logs für eine bestimmte Ressource abrufen
   */
  static getLogsForResource(
    resourceType: string,
    resourceId: string,
    limit: number = 50,
  ): AuditLogEntry[] {
    return this.logs
      .filter((log) => log.resource.type === resourceType && log.resource.id === resourceId)
      .slice(-limit);
  }

  /**
   * Audit-Trail exportieren (für Compliance/Audit)
   */
  static exportTrail(
    startDate?: Date,
    endDate?: Date,
  ): { logs: AuditLogEntry[]; exportDate: string; hash: string } {
    let filtered = [...this.logs];

    if (startDate) {
      filtered = filtered.filter((log) => new Date(log.timestamp) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((log) => new Date(log.timestamp) <= endDate);
    }

    const exportDate = new Date().toISOString();
    const exportHash = this.simpleHash(JSON.stringify(filtered));

    return {
      logs: filtered,
      exportDate,
      hash: exportHash,
    };
  }

  /**
   * Logs leeren (nur für Tests/Demo)
   */
  static clear(): void {
    this.logs = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  }

  // ─── Private Helpers ───────────────────────────────────────

  private static generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private static simpleHash(str: string): string {
    // Vereinfachter Hash für Demo — in Produktion: SHA-256
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash &= hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 16);
  }

  private static persistLogs(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
      } catch (e) {
        console.warn('Failed to persist audit logs to localStorage', e);
      }
    }
  }

  private static loadLogs(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load audit logs from localStorage', e);
    }
  }

  static {
    this.loadLogs();
  }
}

// Convenience exports
export function logAuditEvent(action: string, resource: AuditLogEntry['resource'], details: Record<string, unknown> = {}, result: 'success' | 'failure' = 'success') {
  return AuditLogger.log({
    actor: {
      userId: 'user_1', // In Produktion: aus Auth-Context
      email: 'user@example.de',
    },
    action,
    resource,
    details,
    result,
  });
}
