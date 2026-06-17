import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://sodqxkvkxifczfscbxwo.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_qanav-1ayeNA40f692w2Xg_qqGnFcuG";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
