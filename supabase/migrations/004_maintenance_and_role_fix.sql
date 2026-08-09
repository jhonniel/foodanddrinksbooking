-- Maintenance mode setting + allow service-role role updates (auth.uid() is null).

INSERT INTO app_settings (key, value, updated_at)
VALUES ('maintenance_mode', 'false'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Service role / backend (no JWT) may change roles.
    -- Authenticated non-admins may not escalate.
    IF auth.uid() IS NOT NULL AND NOT is_admin_or_above() THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
