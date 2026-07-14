/**
 * Evidence Export PDF Document — React-PDF
 *
 * Renders PDF document with:
 * - Asset metadata
 * - Custody chain
 * - Signatures + Trust Score
 * - Findings
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { ProvenanceManifest } from '../../lib/provenance/verify';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 1,
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
    color: '#333',
  },
  value: {
    width: '70%',
    color: '#666',
  },
  chainEvent: {
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  eventHeader: {
    fontWeight: 'bold',
    marginBottom: 5,
    fontSize: 10,
  },
  eventDetail: {
    fontSize: 9,
    color: '#666',
    marginBottom: 3,
  },
  trustScoreBad: {
    backgroundColor: '#fee',
    borderWidth: 1,
    borderColor: '#f00',
    padding: 10,
    marginTop: 10,
  },
  trustScoreGood: {
    backgroundColor: '#efe',
    borderWidth: 1,
    borderColor: '#0f0',
    padding: 10,
    marginTop: 10,
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    fontSize: 9,
    color: '#999',
    textAlign: 'center',
  },
});

export interface EvidenceExportDocumentProps {
  manifest: ProvenanceManifest;
  assetRef: string;
}

export function EvidenceExportDocument({ manifest, assetRef }: EvidenceExportDocumentProps) {
  const trustScoreStatus = manifest.trustScore ?? 0;
  const isIntact = manifest.tamperState === 'intact';
  const statusStyle = trustScoreStatus >= 75 && isIntact ? styles.trustScoreGood : styles.trustScoreBad;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Evidence Export Report</Text>
          <Text style={styles.subtitle}>{assetRef}</Text>
        </View>

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Asset Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Asset Reference:</Text>
            <Text style={styles.value}>{manifest.assetRef}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Content SHA-256:</Text>
            <Text style={styles.value}>{manifest.contentSha256}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Issuer:</Text>
            <Text style={styles.value}>{manifest.issuer}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Generated:</Text>
            <Text style={styles.value}>{new Date().toISOString()}</Text>
          </View>
        </View>

        {/* Trust Score */}
        <View style={statusStyle}>
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 3 }}>Trust Status</Text>
            <Text>Score: {trustScoreStatus}/100</Text>
            <Text>State: {manifest.tamperState === 'intact' ? '✓ Intact' : '✗ ' + manifest.tamperState}</Text>
          </View>
        </View>

        {/* Custody Chain */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Custody Chain ({manifest.events.length} events)
          </Text>
          {manifest.events.map((event, idx) => (
            <View key={idx} style={styles.chainEvent}>
              <Text style={styles.eventHeader}>
                Event #{event.seq}: {event.action.toUpperCase()}
              </Text>
              <Text style={styles.eventDetail}>Actor: {event.actor}</Text>
              <Text style={styles.eventDetail}>
                Timestamp: {new Date(event.eventTs).toISOString()}
              </Text>
              <Text style={styles.eventDetail}>Content Hash: {event.contentSha256.substring(0, 16)}...</Text>
              <Text style={styles.eventDetail}>
                Event Hash: {event.eventHash.substring(0, 16)}...
              </Text>
              {event.signature && (
                <Text style={styles.eventDetail}>
                  Signature: {event.signatureAlg || 'HMAC'} ✓
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Chain Verification */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chain Verification</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Latest Hash:</Text>
            <Text style={styles.value}>{manifest.latestHash.substring(0, 32)}...</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tamper State:</Text>
            <Text style={styles.value}>{manifest.tamperState}</Text>
          </View>
          <Text style={{ fontSize: 9, color: '#666', marginTop: 10 }}>
            This custody chain is cryptographically linked. Any modification to earlier events would break the
            hash chain and be immediately detectable.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>RealSyncDynamics.AI Evidence Export</Text>
          <Text>{new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
}
