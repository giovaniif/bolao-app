DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['push_subscriptions', 'expo_push_tokens', 'password_reset_tokens', 'user_identities', 'user_notification_log'] LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('DELETE FROM public.%I', t);
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'
    ) THEN
        UPDATE public.users SET email = NULL WHERE username <> 'giovani' AND email IS NOT NULL;
    END IF;
END $$;

DO $$
DECLARE
    t record;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    END IF;
END $$;
