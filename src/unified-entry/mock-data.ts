export const MOCK_DASHBOARD_DATA = {
  complianceScore: 67,
  riskLevel: 'medium' as const,
  scanDomain: 'example.com',
  findings: [
    {
      id: '1',
      severity: 'high' as const,
      title: 'Tracking vor Consent',
      description: '3 Tracking-Skripte wurden vor Zustimmung geladen',
      count: 3,
    },
    {
      id: '2',
      severity: 'high' as const,
      title: 'Fehlende Cookie-Banner',
      description: 'Keine explizite Zustimmung für Marketing-Cookies',
      count: 1,
    },
    {
      id: '3',
      severity: 'medium' as const,
      title: 'Datenschutzerklärung unvollständig',
      description: 'Einige Datenkategorien nicht dokumentiert',
      count: 2,
    },
    {
      id: '4',
      severity: 'medium' as const,
      title: 'Fehlende AVV-Dokumentation',
      description: 'Auftragsverarbeitungsverträge nicht nachweisbar',
      count: 5,
    },
    {
      id: '5',
      severity: 'low' as const,
      title: 'Veraltete Datenschutzerklärung',
      description: 'Letzte Aktualisierung vor 6 Monaten',
      count: 1,
    },
  ],
  scanResults: {
    trackersFound: 12,
    cookiesDetected: 23,
    thirdPartiesDomains: 8,
    durationSeconds: 45,
    scannedAt: new Date(),
  },
  dimensions: [
    { name: 'DSGVO Compliance', score: 65 },
    { name: 'EU AI Act Readiness', score: 42 },
    { name: 'Evidence & Audit Trail', score: 78 },
    { name: 'Data Protection', score: 71 },
    { name: 'Vendor Management', score: 55 },
    { name: 'Governance Setup', score: 30 },
    { name: 'Monitoring & Alerts', score: 48 },
    { name: 'Incident Response', score: 20 },
  ],
};

export type MockDashboardData = typeof MOCK_DASHBOARD_DATA;
