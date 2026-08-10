-- Make transactions.account_id and category_id nullable.
--
-- The local SQLite schema has always allowed NULL for these columns
-- (a transaction can be created without an account or category, e.g. a
-- quick expense entry or an OCR receipt with no match). The Supabase
-- schema declared them NOT NULL with FK references, so any write that
-- omitted an account/category threw a foreign-key violation and the
-- whole save failed silently.
--
-- This migration aligns the cloud schema with the app's data model.

ALTER TABLE public.transactions
  ALTER COLUMN account_id DROP NOT NULL;

ALTER TABLE public.transactions
  ALTER COLUMN category_id DROP NOT NULL;
