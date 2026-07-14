import type { MetricsCard } from './MetricsCard';

export interface DashboardData {
  period_start: string;
  period_end: string;
  cac: number;
  ltv: number;
  ltv_cac_ratio: number;
  conversion_rate: number;
  churn_rate: number;
  cmrr: number;
  metrics: {
    web_visitors: number;
    leads_generated: number;
    trials_started: number;
    customers_acquired: number;
    revenue: number;
  };
}

export function exportToCSV(data: DashboardData[], filename: string = 'seo-metrics-export.csv') {
  const headers = [
    'Period Start',
    'Period End',
    'Web Visitors',
    'Leads Generated',
    'Trials Started',
    'Customers Acquired',
    'Revenue (€)',
    'CAC (€)',
    'LTV (€)',
    'LTV:CAC Ratio',
    'Conversion Rate (%)',
    'Churn Rate (%)',
    'CMRR (€)',
  ];

  const rows = data.map((row) => [
    row.period_start,
    row.period_end,
    row.metrics.web_visitors,
    row.metrics.leads_generated,
    row.metrics.trials_started,
    row.metrics.customers_acquired,
    row.metrics.revenue.toFixed(2),
    row.cac.toFixed(2),
    row.ltv.toFixed(2),
    row.ltv_cac_ratio.toFixed(2),
    row.conversion_rate.toFixed(2),
    row.churn_rate.toFixed(2),
    row.cmrr.toFixed(2),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToJSON(data: DashboardData[], filename: string = 'seo-metrics-export.json') {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generatePDFContent(data: DashboardData[]): string {
  const now = new Date().toLocaleDateString('de-DE');
  const summary = generateSummary(data);

  let content = `SEO & Marketing Dashboard Report\n`;
  content += `Generated: ${now}\n\n`;
  content += `=== SUMMARY ===\n`;
  content += `Average CAC: €${summary.avgCac.toFixed(2)}\n`;
  content += `Average LTV: €${summary.avgLtv.toFixed(2)}\n`;
  content += `Average Ratio: ${summary.avgRatio.toFixed(2)}:1\n`;
  content += `Total Revenue: €${summary.totalRevenue.toFixed(2)}\n`;
  content += `Total Leads: ${summary.totalLeads}\n`;
  content += `Overall Conversion Rate: ${summary.avgConversion.toFixed(2)}%\n\n`;

  content += `=== DETAILED METRICS ===\n`;
  data.forEach((row) => {
    content += `\nPeriod: ${row.period_start} to ${row.period_end}\n`;
    content += `Web Visitors: ${row.metrics.web_visitors}\n`;
    content += `Leads: ${row.metrics.leads_generated}\n`;
    content += `Customers: ${row.metrics.customers_acquired}\n`;
    content += `Revenue: €${row.metrics.revenue.toFixed(2)}\n`;
    content += `CAC: €${row.cac.toFixed(2)}\n`;
    content += `LTV: €${row.ltv.toFixed(2)}\n`;
    content += `Ratio: ${row.ltv_cac_ratio.toFixed(2)}:1\n`;
    content += `Conversion: ${row.conversion_rate.toFixed(2)}%\n`;
    content += `Churn: ${row.churn_rate.toFixed(2)}%\n`;
  });

  return content;
}

export function exportToPDF(data: DashboardData[], filename: string = 'seo-metrics-export.txt') {
  const content = generatePDFContent(data);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface Summary {
  avgCac: number;
  avgLtv: number;
  avgRatio: number;
  totalRevenue: number;
  totalLeads: number;
  avgConversion: number;
}

export function generateSummary(data: DashboardData[]): Summary {
  if (data.length === 0) {
    return {
      avgCac: 0,
      avgLtv: 0,
      avgRatio: 0,
      totalRevenue: 0,
      totalLeads: 0,
      avgConversion: 0,
    };
  }

  const totalCac = data.reduce((sum, row) => sum + row.cac, 0);
  const totalLtv = data.reduce((sum, row) => sum + row.ltv, 0);
  const totalRatio = data.reduce((sum, row) => sum + row.ltv_cac_ratio, 0);
  const totalRevenue = data.reduce((sum, row) => sum + row.metrics.revenue, 0);
  const totalLeads = data.reduce((sum, row) => sum + row.metrics.leads_generated, 0);
  const totalConversion = data.reduce((sum, row) => sum + row.conversion_rate, 0);

  return {
    avgCac: totalCac / data.length,
    avgLtv: totalLtv / data.length,
    avgRatio: totalRatio / data.length,
    totalRevenue,
    totalLeads,
    avgConversion: totalConversion / data.length,
  };
}
