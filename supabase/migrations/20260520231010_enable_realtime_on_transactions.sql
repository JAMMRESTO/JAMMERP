/*
  # Enable Realtime on encaissements and decaissements

  Adds both tables to the Supabase Realtime publication so that
  INSERT/UPDATE/DELETE events are broadcast to all subscribers.
  This allows the solde to update in real time on every connected device.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE encaissements;
ALTER PUBLICATION supabase_realtime ADD TABLE decaissements;
