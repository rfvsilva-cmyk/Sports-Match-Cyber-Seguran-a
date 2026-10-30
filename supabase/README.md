# Supabase migrations

`migrations/20260916210216_remote_schema.sql` is the baseline captured from the linked production database.
`migrations/20260921180000_align_application_schema.sql` upgrades that baseline to the schema required by the current API.
`migrations/20260922090000_profile_photos_storage.sql` creates the public `profile-photos` bucket with controlled image types and size.
`migrations/20260922110000_notifications.sql` creates the persistent in-app notifications table.

Before applying it directly to production:

1. Create a database backup in Supabase Dashboard → Database → Backups.
2. Run every file in `migrations/` in timestamp order with `supabase db push --linked`, or run the pending migrations in the Supabase SQL editor as the project owner.
3. Configure `SUPABASE_JWT_SECRET` in the API and enable the `mensagem` table in the `supabase_realtime` publication.
4. Confirm that the `profile-photos` bucket exists and that the API service-role key is configured only on the server; profile-image uploads are validated by the API before reaching Storage.
5. Run the production smoke test with two dedicated test accounts, including photo upload/removal and notification delivery.

The API uses the service role only on the server. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_JWT_SECRET` to the frontend.
