import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/tracker/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard]
  },
  {
    path: 'gestor',
    loadComponent: () => import('./features/manager/manager-dashboard/manager-dashboard').then(m => m.ManagerDashboard),
    canActivate: [authGuard, roleGuard(['MANAGER', 'HR_ADMIN'])]
  },
  {
    path: 'rh',
    loadComponent: () => import('./features/hr/hr-dashboard/hr-dashboard').then(m => m.HrDashboard),
    canActivate: [authGuard, roleGuard(['HR_ADMIN'])]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
