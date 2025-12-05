import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qvkfoitbatyrwqbicwwc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2a2ZvaXRiYXR5cndxYmljd3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NjE5NjMsImV4cCI6MjA3OTIzNzk2M30.YzaC8z3e3ut6FFiNsr4e-NJtcVQvvLX-QuOKtjd78YM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);