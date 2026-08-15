-- Storage bucket for the question screenshots.
--
-- Public read, because the object names are already the secret: the admin uploader
-- renames every file to an opaque id (`q7f3a91.png`) on the way in, so a screenshot
-- called `badge-orange-wrong.png` on the designer's disk never reaches the network
-- tab under that name. Signed URLs would add a round trip per option to a question
-- running on a 15 second timer, for no gain over an unguessable name.
--
-- Writes have no policy at all, so only the service key can upload — that is, only
-- the admin server actions.
--
-- SVG is allowed because the seeded placeholders are SVG. Two things keep that from
-- becoming a script-execution hole: the admin uploader only accepts raster types,
-- and the `/shots/[key]` route serves everything under a `default-src 'none';
-- sandbox` content security policy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shots',
  'shots',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
