-- Ajout du champ is_super_admin aux profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Table d'abonnement
CREATE TABLE IF NOT EXISTS subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT NOT NULL CHECK (plan IN ('mensuel', 'trimestriel', 'annuel')),
  date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
  date_fin DATE NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subscription ENABLE ROW LEVEL SECURITY;

-- Politique RLS : lecture pour tous les utilisateurs authentifies via app session
CREATE POLICY "select_subscription_for_all" ON subscription FOR SELECT
  TO anon USING (true);

-- Seul le super admin peut modifier via edge function (service_role), donc pas de policy INSERT/UPDATE/DELETE pour anon
-- L'edge function utilise le service_role qui bypass RLS

-- Marquer le premier admin comme super_admin s'il existe
UPDATE profiles SET is_super_admin = true 
WHERE id = (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1);
