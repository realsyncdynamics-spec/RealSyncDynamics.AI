-- Public Storage-Bucket für gerebuildete DSGVO-konforme Website-Bundles.
-- Public, weil HTML mit relativen Asset-Pfaden konsistent gerendert werden muss
-- (signed URLs scopen pro-Datei und brechen <link>/<img>/<script> innerhalb der HTML).
--
-- Object-Pfade: {rebuild_id}/index.html, {rebuild_id}/llms.txt,
--               {rebuild_id}/api/ai-info.json, {rebuild_id}/assets/...
--
-- Sicherheit by obscurity: rebuild_id ist UUID (122 bits Entropie), unguessable.
-- Wer den Link aus der Customer-Email hat, sieht den Preview — akzeptabel
-- für V2-Preview-UX (kein Login-Wall vor Customer-Freigabe).

INSERT INTO storage.buckets (id, name, public)
VALUES ('website-rebuilds', 'website-rebuilds', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "website-rebuilds public read" ON storage.objects;
CREATE POLICY "website-rebuilds public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'website-rebuilds');
