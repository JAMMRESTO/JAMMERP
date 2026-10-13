/*
  # Add user permissions system

  ## Overview
  Adds a granular permissions system that allows admins to define
  specific access rights per user, independent of their role.

  ## New Tables

  ### `user_permissions`
  Stores individual permission flags per user.
  - `id` (uuid, primary key)
  - `user_id` (uuid, FK → users.id, unique)
  - `can_view_orders` - Can view orders list
  - `can_create_orders` - Can create new orders
  - `can_edit_orders` - Can edit existing orders
  - `can_cancel_orders` - Can cancel/void orders
  - `can_process_payments` - Can process payments
  - `can_view_sales_history` - Can view sales history & reports
  - `can_manage_products` - Can add/edit/delete products & categories
  - `can_manage_tables` - Can manage zones and tables
  - `can_manage_printers` - Can manage printers & print jobs
  - `can_manage_users` - Can manage users (admin-level)
  - `can_access_settings` - Can access app settings
  - `can_print_tickets` - Can print tickets
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled with anon access (matches existing pattern)
*/

CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_view_orders boolean DEFAULT true,
  can_create_orders boolean DEFAULT false,
  can_edit_orders boolean DEFAULT false,
  can_cancel_orders boolean DEFAULT false,
  can_process_payments boolean DEFAULT false,
  can_view_sales_history boolean DEFAULT false,
  can_manage_products boolean DEFAULT false,
  can_manage_tables boolean DEFAULT false,
  can_manage_printers boolean DEFAULT false,
  can_manage_users boolean DEFAULT false,
  can_access_settings boolean DEFAULT false,
  can_print_tickets boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_permissions_user_id_unique UNIQUE (user_id)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select user_permissions"
  ON user_permissions FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert user_permissions"
  ON user_permissions FOR INSERT TO anon WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "Anon can update user_permissions"
  ON user_permissions FOR UPDATE TO anon
  USING (user_id IS NOT NULL)
  WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "Anon can delete user_permissions"
  ON user_permissions FOR DELETE TO anon USING (id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
