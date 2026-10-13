import { supabase } from './supabase';

export type ActivityAction =
  | 'DELETE_PRINTED_ITEM'
  | 'CANCEL_PAYMENT'
  | 'REPRINT_BILL'
  | 'CANCEL_ORDER'
  | 'VALIDATE_ORDER'
  | 'PAYMENT_DONE'
  | 'PRINT_SENT'
  | 'PRINT_FAILED';

export async function logActivity(
  userId: string,
  action: ActivityAction,
  entityType: string,
  entityId: string,
  details = ''
) {
  await supabase.from('activity_logs').insert({
    user_id: userId || null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
}
