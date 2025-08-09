BEGIN;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.vault_member_role AS ENUM ('owner','editor','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.proactive_event_status AS ENUM ('triggered','executed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Vaults
CREATE TABLE IF NOT EXISTS public.vaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view their vaults" ON public.vaults;
CREATE POLICY "Owners can view their vaults" ON public.vaults
FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can modify their vaults" ON public.vaults;
CREATE POLICY "Owners can modify their vaults" ON public.vaults
FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete their vaults" ON public.vaults;
CREATE POLICY "Owners can delete their vaults" ON public.vaults
FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can insert their vaults" ON public.vaults;
CREATE POLICY "Owners can insert their vaults" ON public.vaults
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Vault Members
CREATE TABLE IF NOT EXISTS public.vault_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.vault_member_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vault_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_members_vault ON public.vault_members (vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_members_user ON public.vault_members (user_id);

ALTER TABLE public.vault_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view memberships they belong to" ON public.vault_members;
CREATE POLICY "Members can view memberships they belong to" ON public.vault_members
FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.vaults v WHERE v.id = vault_id AND v.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Only vault owners can add members" ON public.vault_members;
CREATE POLICY "Only vault owners can add members" ON public.vault_members
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.vaults v WHERE v.id = vault_id AND v.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Only vault owners can update memberships" ON public.vault_members;
CREATE POLICY "Only vault owners can update memberships" ON public.vault_members
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.vaults v WHERE v.id = vault_id AND v.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Only vault owners can delete memberships" ON public.vault_members;
CREATE POLICY "Only vault owners can delete memberships" ON public.vault_members
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.vaults v WHERE v.id = vault_id AND v.owner_id = auth.uid())
);

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_vault_member(_user_id uuid, _vault_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vault_members vm
    WHERE vm.vault_id = _vault_id AND vm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_vault_role(_user_id uuid, _vault_id uuid, _role public.vault_member_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vault_members vm
    WHERE vm.vault_id = _vault_id AND vm.user_id = _user_id AND vm.role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_vault_member(_vault_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_vault_member(auth.uid(), _vault_id);
$$;

CREATE OR REPLACE FUNCTION public.has_current_user_vault_role(_vault_id uuid, _role public.vault_member_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_vault_role(auth.uid(), _vault_id, _role);
$$;

-- Trigger to auto-add owner membership
CREATE OR REPLACE FUNCTION public.add_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vault_members (vault_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (vault_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_owner_membership ON public.vaults;
CREATE TRIGGER trg_add_owner_membership
AFTER INSERT ON public.vaults
FOR EACH ROW EXECUTE FUNCTION public.add_owner_membership();

-- updated_at trigger for vaults
DROP TRIGGER IF EXISTS update_vaults_updated_at ON public.vaults;
CREATE TRIGGER update_vaults_updated_at
BEFORE UPDATE ON public.vaults
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notes
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vault_id uuid,
  title text NOT NULL,
  content text,
  tags text[],
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON public.notes (user_id);
CREATE INDEX IF NOT EXISTS idx_notes_vault ON public.notes (vault_id);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notes or vault notes they have access to" ON public.notes;
CREATE POLICY "Users can view their own notes or vault notes they have access to" ON public.notes
FOR SELECT USING (
  auth.uid() = user_id OR
  (vault_id IS NOT NULL AND public.is_current_user_vault_member(vault_id))
);

DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
CREATE POLICY "Users can insert their own notes" ON public.notes
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  (vault_id IS NULL OR public.is_current_user_vault_member(vault_id))
);

DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
CREATE POLICY "Users can update their own notes" ON public.notes
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
CREATE POLICY "Users can delete their own notes" ON public.notes
FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Proactive rules
CREATE TABLE IF NOT EXISTS public.proactive_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vault_id uuid,
  name text NOT NULL,
  description text,
  conditions jsonb,
  action jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rules_user ON public.proactive_rules (user_id);
CREATE INDEX IF NOT EXISTS idx_rules_vault ON public.proactive_rules (vault_id);
ALTER TABLE public.proactive_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own rules" ON public.proactive_rules;
CREATE POLICY "Users can view their own rules" ON public.proactive_rules
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own rules" ON public.proactive_rules;
CREATE POLICY "Users can insert their own rules" ON public.proactive_rules
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own rules" ON public.proactive_rules;
CREATE POLICY "Users can update their own rules" ON public.proactive_rules
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own rules" ON public.proactive_rules;
CREATE POLICY "Users can delete their own rules" ON public.proactive_rules
FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_rules_updated_at ON public.proactive_rules;
CREATE TRIGGER update_rules_updated_at
BEFORE UPDATE ON public.proactive_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Proactive events
CREATE TABLE IF NOT EXISTS public.proactive_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  user_id uuid NOT NULL,
  vault_id uuid,
  status public.proactive_event_status NOT NULL DEFAULT 'triggered',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_rule ON public.proactive_events (rule_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON public.proactive_events (user_id);
CREATE INDEX IF NOT EXISTS idx_events_vault ON public.proactive_events (vault_id);

ALTER TABLE public.proactive_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own events" ON public.proactive_events;
CREATE POLICY "Users can view their own events" ON public.proactive_events
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own events" ON public.proactive_events;
CREATE POLICY "Users can insert their own events" ON public.proactive_events
FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;