-- ==============================================================================
-- Vocal Remover & Karaoke Maker - Supabase Database Schema
-- Project: https://kfgsksteuyhqtsigvtyx.supabase.co
-- Completely idempotent & safe to run multiple times without any errors or warnings
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. PROFILES TABLE (Linked to auth.users with 5 free starting tokens)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    tokens INTEGER NOT NULL DEFAULT 5 CHECK (tokens >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. TOKEN TRANSACTIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('free_grant', 'conversion_use', 'voucher_recharge', 'admin_grant')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON public.token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON public.token_transactions(created_at DESC);

-- ==============================================================================
-- 4. VOUCHERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    is_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    redeemed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers(code);

-- ==============================================================================
-- 5. PROJECTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    original_file_name TEXT,
    file_size BIGINT,
    duration REAL,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

-- ==============================================================================
-- 6. AUTOMATIC PROFILE CREATION TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_display_name TEXT;
BEGIN
    user_display_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (id, email, name, tokens, created_at, updated_at)
    VALUES (NEW.id, NEW.email, user_display_name, 5, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.token_transactions (user_id, type, amount, balance_after, description, created_at)
    VALUES (NEW.id, 'free_grant', 5, 5, 'Initial 5 Free Trial Conversion Tokens', NOW());

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
    ) THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_new_user();
    END IF;
END;
$$;

-- ==============================================================================
-- 7. SECURE RPC FUNCTIONS (Atomic Token Deduction & Voucher Redemption)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.deduct_conversion_token(song_name TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_uid UUID;
    user_tokens INTEGER;
    new_tokens INTEGER;
BEGIN
    current_uid := auth.uid();
    IF current_uid IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'remaining_tokens', 0,
            'message', 'Authentication required. Please sign in.'
        );
    END IF;

    SELECT tokens INTO user_tokens
    FROM public.profiles
    WHERE id = current_uid
    FOR UPDATE;

    IF user_tokens IS NULL OR user_tokens < 1 THEN
        RETURN json_build_object(
            'success', false,
            'remaining_tokens', COALESCE(user_tokens, 0),
            'message', 'You have 0 tokens left. Please recharge with minimum 10 tokens (₹10).'
        );
    END IF;

    new_tokens := user_tokens - 1;

    UPDATE public.profiles
    SET tokens = new_tokens, updated_at = NOW()
    WHERE id = current_uid;

    INSERT INTO public.token_transactions (user_id, type, amount, balance_after, description, created_at)
    VALUES (
        current_uid,
        'conversion_use',
        -1,
        new_tokens,
        'Vocal separation for: ' || COALESCE(song_name, 'Audio Track'),
        NOW()
    );

    RETURN json_build_object(
        'success', true,
        'remaining_tokens', new_tokens,
        'message', '1 conversion token used. ' || new_tokens || ' remaining.'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_token_voucher(voucher_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_uid UUID;
    clean_code TEXT;
    voucher_record RECORD;
    current_tokens INTEGER;
    new_tokens INTEGER;
BEGIN
    current_uid := auth.uid();
    IF current_uid IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Authentication required. Please sign in to redeem vouchers.'
        );
    END IF;

    clean_code := upper(trim(voucher_code));
    IF clean_code IS NULL OR clean_code = '' THEN
        RETURN json_build_object('success', false, 'message', 'Please enter a valid voucher code.');
    END IF;

    SELECT * INTO voucher_record
    FROM public.vouchers
    WHERE upper(code) = clean_code
    FOR UPDATE;

    IF voucher_record.id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Invalid voucher code. Please check and try again.');
    END IF;

    IF voucher_record.is_redeemed THEN
        RETURN json_build_object('success', false, 'message', 'This voucher code has already been redeemed.');
    END IF;

    SELECT tokens INTO current_tokens
    FROM public.profiles
    WHERE id = current_uid
    FOR UPDATE;

    new_tokens := COALESCE(current_tokens, 0) + voucher_record.amount;

    UPDATE public.vouchers
    SET is_redeemed = TRUE,
        redeemed_by = current_uid,
        redeemed_at = NOW()
    WHERE id = voucher_record.id;

    UPDATE public.profiles
    SET tokens = new_tokens, updated_at = NOW()
    WHERE id = current_uid;

    INSERT INTO public.token_transactions (user_id, type, amount, balance_after, description, created_at)
    VALUES (
        current_uid,
        'voucher_recharge',
        voucher_record.amount,
        new_tokens,
        'Redeemed voucher: ' || clean_code,
        NOW()
    );

    RETURN json_build_object(
        'success', true,
        'tokens_added', voucher_record.amount,
        'new_balance', new_tokens,
        'message', 'Successfully recharged ' || voucher_record.amount || ' tokens! New balance: ' || new_tokens
    );
END;
$$;

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Cleanly replaces any existing policies without 42710 error or destructive warnings
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Safely refresh policies if they already exist
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own profile name" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own token transactions" ON public.token_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view vouchers they have redeemed" ON public.vouchers';
END $$;

-- 8a. Profiles
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile name"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 8b. Token Transactions
CREATE POLICY "Users can view their own token transactions"
    ON public.token_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- 8c. Projects
CREATE POLICY "Users can view their own projects"
    ON public.projects FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
    ON public.projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
    ON public.projects FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
    ON public.projects FOR DELETE
    USING (auth.uid() = user_id);

-- 8d. Vouchers
CREATE POLICY "Users can view vouchers they have redeemed"
    ON public.vouchers FOR SELECT
    USING (auth.uid() = redeemed_by);
