import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = fs.readFileSync(resolve(__dirname, '../.env'), 'utf-8');
const supabaseUrlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/) || envContent.match(/SUPABASE_URL=(.+)/);
const supabaseKeyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/) || envContent.match(/SUPABASE_ANON_KEY=(.+)/) || envContent.match(/SUPABASE_KEY=(.+)/);

const SUPABASE_URL = "https://sodqxkvkxifczfscbxwo.supabase.co";
const SUPABASE_KEY = "sb_publishable_qanav-1ayeNA40f692w2Xg_qqGnFcuG";

async function testSupabase() {
  const payload = [{
    user_id: "81e973b6-eeda-464e-a66b-b95b9b79b70c",
    note_id: 123456789,
    deck_name: "Kaishi 1.5k",
    card_status: "learning",
    vocabulary: "テスト",
    reading: "テスト",
    meaning: "Test",
    sentence: "This is a test",
    audio: "",
    image: "",
    tags: ["test"],
    synced_at: new Date().toISOString()
  }];

  console.log("Sending payload...");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/anki_cards?on_conflict=user_id,note_id`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", text);
}

testSupabase();
