-- Supabase's security advisor flags trigger functions with a mutable
-- search_path. set_updated_at() only touches NEW, so an empty path is safe.

alter function public.set_updated_at() set search_path = '';
