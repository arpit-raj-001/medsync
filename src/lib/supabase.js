// Utilize the global createClient from the CDN script in index.html
const createClient = window.supabase ? window.supabase.createClient : null;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Check your .env file.');
}

if (!createClient) {
  console.error('Supabase SDK not loaded from CDN. Check index.html.');
}

export const supabase = createClient ? createClient(supabaseUrl, supabaseAnonKey) : null;
