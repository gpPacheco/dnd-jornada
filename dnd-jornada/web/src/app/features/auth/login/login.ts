import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  loading = signal(false);
  error = signal('');

  async ngOnInit() {
    const session = await this.supabase.getSession();
    if (session?.user) {
      await this.supabase.fetchProfileAsync(session.user.id);
      const role = this.supabase.getUserRole(session.user);
      this.redirectByRole(role);
    }
  }

  private redirectByRole(role?: string) {
    switch (role) {
      case 'HR_ADMIN':
        this.router.navigate(['/rh']);
        break;
      case 'MANAGER':
        this.router.navigate(['/gestor']);
        break;
      default:
        this.router.navigate(['/dashboard']);
    }
  }

  async handleLogin() {
    if (!this.email() || !this.password()) {
      this.error.set('Preencha todos os campos.');
      return;
    }

    try {
      this.loading.set(true);
      this.error.set('');

      const { data: { user }, error } = await this.supabase.signIn(this.email(), this.password());
      if (error) throw error;

      if (user) {
        // Busca perfil em segundo plano ou atualiza estado
        const profile = await this.supabase.fetchProfileAsync(user.id);
        const role = profile?.role || this.supabase.getUserRole(user);
        this.redirectByRole(role);
      }
    } catch (err: any) {
      this.error.set(err.message || 'Erro ao realizar login.');
    } finally {
      this.loading.set(false);
    }
  }
}
