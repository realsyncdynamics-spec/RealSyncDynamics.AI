# RealSyncDynamics Evidence Tracker Extension

Browser extension for capturing and tracking compliance evidence for AI governance.

## Features

- 📸 **Screenshot Capture** — Capture evidence from any website
- 🏷️ **Evidence Metadata** — Add title, type, notes, and tags
- 🔐 **Secure Storage** — Evidence stored in Supabase with RLS protection
- ⚡ **Real-time Sync** — Automatically sync with governance dashboard
- 📱 **Context Menu** — Right-click to capture selections as evidence

## Development

### Build

```bash
# Install extension dependencies (if separate from main project)
npm install

# TypeScript compilation happens via esbuild (see build script)
```

### Installation (Development)

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` directory

### Structure

```
extension/
├── manifest.json           # Extension configuration (Manifest v3)
├── src/
│   ├── popup/             # Popup UI (screenshot, form)
│   ├── background/        # Service worker (auth, sync)
│   ├── content/           # Content script (injection points)
│   ├── options/           # Settings page
│   └── shared/            # Shared utilities (API, auth)
└── public/                # Icons and assets
```

### Environment Variables

The extension uses the same Supabase credentials as the main app:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

These are loaded from the main app's environment at build time.

## Testing

### Local Testing

1. Build extension: `npm run build`
2. Load unpacked in Chrome Developer mode
3. Navigate to any website
4. Click extension icon to open popup
5. Capture evidence and submit

### Required Setup

For evidence to save successfully:
1. User must be authenticated (have valid auth token)
2. Supabase project must have `governance_evidence` table
3. Storage bucket `governance-evidence` must exist with public read permissions

## Security Considerations

- Auth tokens stored in `chrome.storage.local` (not synced to cloud)
- Screenshots captured locally, sent directly to Supabase Storage
- All API calls include Bearer token for authentication
- RLS policies on Supabase enforce tenant_id filtering
- Extension runs in isolated context, no DOM manipulation

## APIs Used

- `chrome.tabs.captureVisibleTab()` — Screenshot capture
- `chrome.storage.local` — Auth token persistence
- `chrome.contextMenus` — Right-click capture
- `chrome.runtime.onMessage` — IPC between scripts
- Supabase REST API — Evidence persistence
- Supabase Storage API — Screenshot uploads

## Future Enhancements

- [ ] Offline mode with pending evidence queue
- [ ] Evidence annotations (highlight, redact)
- [ ] Custom evidence templates
- [ ] Batch upload for multiple screenshots
- [ ] Evidence preview before upload
- [ ] Settings page for:
  - Default evidence type
  - Auto-tag rules
  - Sync frequency
  - Storage preferences

## Troubleshooting

### Extension won't load
- Check manifest.json syntax: `python -m json.tool manifest.json`
- Check browser console for errors

### Screenshots not capturing
- Ensure `captureVisibleTab` permission in manifest
- Try on simple sites first (complex JS might interfere)

### Evidence not saving
- Verify auth token is set (check popup status)
- Check network tab for API errors
- Verify Supabase credentials are correct
