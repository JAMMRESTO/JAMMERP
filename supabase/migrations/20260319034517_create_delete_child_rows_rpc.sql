
/*
  # Create delete_child_rows RPC function

  This function is used by the company-backup-restore edge function to delete
  rows from child tables (that don't have company_id) by joining to the parent table.

  Parameters:
  - p_child_table: the child table name (e.g. devis_lignes)
  - p_fk_column: the foreign key column in the child table (e.g. devis_id)
  - p_parent_table: the parent table name (e.g. devis)
  - p_company_id: the company UUID to filter by
*/

CREATE OR REPLACE FUNCTION delete_child_rows(
  p_child_table text,
  p_fk_column text,
  p_parent_table text,
  p_company_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'DELETE FROM %I WHERE %I IN (SELECT id FROM %I WHERE company_id = $1)',
    p_child_table, p_fk_column, p_parent_table
  ) USING p_company_id;
END;
$$;
