/**
 * Tenant Configuration Example
 * Demonstrates retrieving and updating tenant settings and white-label branding
 */

import { RealSyncDynamicsSDK } from '@realsyncdynamics/sdk';

const sdk = new RealSyncDynamicsSDK({
  apiKey: process.env.REALSYNCDYNAMICS_API_KEY!,
});

async function manageTenantConfig() {
  const tenantId = 'your-tenant-id';

  try {
    // Get current tenant configuration
    console.log('📋 Fetching current tenant configuration...');
    const config = await sdk.getTenantConfig(tenantId);

    console.log(`\n📱 Current Settings:`);
    console.log(`  Company Name: ${config.name}`);
    console.log(`  Domain: ${config.custom_domain}`);
    console.log(`  Email: ${config.email}`);
    console.log(`  Phone: ${config.phone}`);

    // Update tenant configuration
    console.log('\n✏️  Updating tenant configuration...');
    const updated = await sdk.updateTenantConfig(tenantId, {
      name: 'Acme Corporation',
      email: 'support@acme.example.com',
      phone: '+1-800-ACME-CORP',
    });
    console.log(`✅ Configuration updated`);

    // Setup white-label branding
    console.log('\n🎨 Configuring white-label branding...');
    const branded = await sdk.updateBranding(tenantId, {
      company_name: 'Acme Corp',
      brand_colors: {
        primary: '#0F766E',
        secondary: '#64748B',
        accent: '#0052FF',
      },
      custom_logo_url: 'https://assets.acme.example.com/logo-dark.png',
      favicon_url: 'https://assets.acme.example.com/favicon.ico',
      support_email: 'support@acme.example.com',
      support_phone: '+1-800-ACME-CORP',
      support_url: 'https://support.acme.example.com',
      footer_text: '© 2024 Acme Corporation. All rights reserved.',
    });
    console.log(`✅ Branding configured`);

    // Verify updated branding
    console.log('\n✨ Branding Preview:');
    console.log(`  Company: ${branded.name}`);
    console.log(`  Primary Color: ${branded.brand_colors?.primary || 'default'}`);
    console.log(`  Logo: ${branded.custom_logo_url ? '✓ Custom' : 'Platform default'}`);
    console.log(`  Support Email: ${branded.support_email}`);
    console.log(`  Footer: ${branded.footer_text}`);
  } catch (error) {
    console.error('❌ Configuration update failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

manageTenantConfig();
