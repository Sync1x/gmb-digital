-- Public Storage bucket for featured images.
--
-- The app converts every picked/uploaded image to JPEG (max 1600px wide) and
-- uploads it here using the server-side secret key, which bypasses Storage
-- RLS, so no insert/update/delete policies are needed. The bucket is public
-- because each station's WordPress site must be able to download the image
-- (MainWP passes the URL as the post's featured image).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('featured', 'featured', true, 10485760, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
