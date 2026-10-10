import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Aguarda a verificação da sessão
  const session = await supabase.getSession();
  
  if (session) {
    return true;
  }

  router.navigate(['/']);
  return false;
};

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return async () => {
    const supabase = inject(SupabaseService);
    const router = inject(Router);

    let profile = supabase.profile;
    const session = await supabase.getSession();

    if (!profile && session?.user) {
      profile = await supabase.fetchProfileAsync(session.user.id);
    }

    const currentRole = profile?.role || supabase.getUserRole(session?.user);

    if (currentRole && allowedRoles.includes(currentRole)) {
      return true;
    }

    // Se o usuário não tem permissão para a rota atual, redireciona para o portal correto dele
    switch (currentRole) {
      case 'HR_ADMIN':
        router.navigate(['/rh']);
        break;
      case 'MANAGER':
        router.navigate(['/gestor']);
        break;
      default:
        router.navigate(['/dashboard']);
    }
    return false;
  };
};
