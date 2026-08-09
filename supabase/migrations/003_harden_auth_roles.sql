-- Harden public signup: always create CUSTOMER profiles.
-- Staff/driver roles must be assigned by admins (service role / admin UI).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'CUSTOMER'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent non-admins from escalating their own role via client updates
CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT is_admin_or_above() THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_prevent_role_escalation ON profiles;
CREATE TRIGGER tr_prevent_role_escalation
  BEFORE UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_self_role_escalation();
