-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function called on new tenant INSERT
CREATE OR REPLACE FUNCTION private.trigger_notify_new_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM net.http_post(
      url     := 'https://dnysmcajtqsppqtlpjgv.supabase.co/functions/v1/notify-new-tenant',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRueXNtY2FqdHFzcHBxdGxwamd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTAwMTcsImV4cCI6MjA5NTkyNjAxN30.qU8985Dfu7DfIGegyZXxDECN9QFZjRfnqIPo_fwwDCM'
      ),
      body    := jsonb_build_object(
        'tenantId',   NEW.id,
        'tenantName', NEW.name,
        'tenantSlug', NEW.slug,
        'createdAt',  NEW.created_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_new_tenant_request ON tenants;

-- Create the trigger
CREATE TRIGGER on_new_tenant_request
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION private.trigger_notify_new_tenant();
