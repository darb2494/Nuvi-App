import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://qwflfhqqgrqyjklekjbh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZmxmaHFxZ3JxeWprbGVramJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY2ODI1MywiZXhwIjoyMTAwMjQ0MjUzfQ.jL16Dk1j_rLa8HnsHS0o6YHCl0UO4esRAoKKYI6rT2A');

async function fixProfile() {
  const email = 'natashakaterin@gmail.com';
  
  // 1. Get user
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const user = usersData?.users?.find(u => u.email === email);
  
  if (!user) {
    console.log('❌ Usuario no encontrado en Auth.');
    return;
  }
  
  console.log('✅ Usuario encontrado:', user.id);
  
  // 2. Get tenant ID from metadata
  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) {
     console.log('❌ El usuario no tiene tenant_id en su metadata.');
     return;
  }
  
  console.log('✅ Tenant ID del usuario:', tenantId);
  
  // 3. Check if profile exists
  // We use insert with ON CONFLICT DO UPDATE (or upsert) to bypass RLS SELECT restrictions for service_role
  const { error: upsertErr } = await supabase.from('profiles').upsert({
    id: user.id,
    tenant_id: tenantId,
    first_name: user.user_metadata.first_name || 'Natasha',
    last_name: user.user_metadata.last_name || '',
    role: 'nutricionista'
  });
  
  if (upsertErr) {
    console.log('❌ Error al crear/actualizar el perfil:', upsertErr);
  } else {
    console.log('✅ PERFIL REPARADO EXITOSAMENTE. Natasha ya debería poder entrar.');
  }
}

fixProfile();
