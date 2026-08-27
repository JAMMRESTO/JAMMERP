import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TABLES_WITH_COMPANY_ID = [
  'clients', 'fournisseurs', 'categories', 'produits', 'produit_unites',
  'roles', 'devis', 'factures', 'factures_fournisseurs',
  'paiements', 'paiements_fournisseurs', 'depenses', 'retours',
  'mouvements_stock', 'pos_sessions', 'pos_ventes', 'pos_facture_payments',
];

const CHILD_TABLES: { table: string; fk: string; parent: string }[] = [
  { table: 'devis_lignes', fk: 'devis_id', parent: 'devis' },
  { table: 'facture_lignes', fk: 'facture_id', parent: 'factures' },
  { table: 'factures_fournisseurs_lignes', fk: 'facture_fournisseur_id', parent: 'factures_fournisseurs' },
  { table: 'retour_lignes', fk: 'retour_id', parent: 'retours' },
  { table: 'pos_vente_lignes', fk: 'vente_id', parent: 'pos_ventes' },
];

const VALID_SCOPES = ['all', 'transactions', 'clients_fournisseurs', 'produits', 'depenses', 'factures_fournisseurs'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Forbidden: superadmin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'backup') {
      const companyId = url.searchParams.get('company_id');
      if (!companyId) {
        return new Response(JSON.stringify({ error: 'company_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
      if (!company) {
        return new Response(JSON.stringify({ error: 'Company not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const backup: Record<string, unknown[]> = { companies: [company] };

      for (const table of TABLES_WITH_COMPANY_ID) {
        const { data, error } = await supabase.from(table).select('*').eq('company_id', companyId);
        backup[table] = error ? [] : (data || []);
      }

      for (const childDef of CHILD_TABLES) {
        const { data: parentIds } = await supabase
          .from(childDef.parent)
          .select('id')
          .eq('company_id', companyId);

        if (parentIds && parentIds.length > 0) {
          const ids = parentIds.map((r: { id: string }) => r.id);
          const { data } = await supabase.from(childDef.table).select('*').in(childDef.fk, ids);
          backup[childDef.table] = data || [];
        } else {
          backup[childDef.table] = [];
        }
      }

      return new Response(JSON.stringify({
        version: '1.0',
        created_at: new Date().toISOString(),
        company_id: companyId,
        company_name: company.name,
        data: backup,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'restore') {
      const body = await req.json();
      const { company_id, backup_data, mode } = body;

      if (!company_id || !backup_data) {
        return new Response(JSON.stringify({ error: 'company_id and backup_data required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: company } = await supabase.from('companies').select('id').eq('id', company_id).maybeSingle();
      if (!company) {
        return new Response(JSON.stringify({ error: 'Company not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (mode === 'full') {
        const { error: resetError } = await supabase.rpc('reset_company_data', {
          p_company_id: company_id,
          p_scope: 'all',
        });
        if (resetError) {
          return new Response(JSON.stringify({ error: `Reset before restore failed: ${resetError.message}` }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const results: Record<string, { inserted: number; errors: number }> = {};

      const orderedInsert = [
        'roles', 'clients', 'fournisseurs', 'categories', 'produits', 'produit_unites',
        'devis', 'devis_lignes',
        'factures', 'facture_lignes', 'paiements',
        'factures_fournisseurs', 'factures_fournisseurs_lignes', 'paiements_fournisseurs',
        'retours', 'retour_lignes',
        'depenses', 'mouvements_stock',
        'pos_sessions', 'pos_ventes', 'pos_vente_lignes', 'pos_facture_payments',
      ];

      for (const table of orderedInsert) {
        const rows: Record<string, unknown>[] = backup_data[table] || [];
        if (rows.length === 0) {
          results[table] = { inserted: 0, errors: 0 };
          continue;
        }

        const isChild = CHILD_TABLES.some(c => c.table === table);
        const sanitized = isChild ? rows : rows.map(row => ({ ...row, company_id }));

        const { error } = await supabase.from(table).upsert(sanitized, { onConflict: 'id', ignoreDuplicates: false });
        results[table] = error
          ? { inserted: 0, errors: rows.length }
          : { inserted: rows.length, errors: 0 };
      }

      return new Response(JSON.stringify({ success: true, results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset') {
      const body = await req.json();
      const { company_id, scope } = body;

      if (!company_id) {
        return new Response(JSON.stringify({ error: 'company_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!scope || !VALID_SCOPES.includes(scope)) {
        return new Response(JSON.stringify({ error: 'Invalid scope. Use: all, transactions, clients_fournisseurs, produits, depenses, factures_fournisseurs' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: company } = await supabase.from('companies').select('id, name').eq('id', company_id).maybeSingle();
      if (!company) {
        return new Response(JSON.stringify({ error: 'Company not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: resetResult, error: resetError } = await supabase.rpc('reset_company_data', {
        p_company_id: company_id,
        p_scope: scope,
      });

      if (resetError) {
        return new Response(JSON.stringify({ error: resetError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results: Record<string, { deleted: number; errors: number }> = {};
      let totalDeleted = 0;
      if (resetResult && typeof resetResult === 'object') {
        for (const [table, count] of Object.entries(resetResult as Record<string, number>)) {
          results[table] = { deleted: count, errors: 0 };
          totalDeleted += count;
        }
      }

      return new Response(JSON.stringify({ success: true, total_deleted: totalDeleted, results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use ?action=backup, ?action=restore or ?action=reset' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
