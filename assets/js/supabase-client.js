(function initSupabase() {
  const { supabaseUrl, supabaseKey } = window.elERPConfig || {};
  if (!supabaseUrl || !supabaseKey) {
    console.error("elERP: configure assets/js/config.js");
    return;
  }
  if (!window.supabase?.createClient) {
    console.error("elERP: biblioteca Supabase não carregou");
    return;
  }
  window.elERPSb = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
})();
