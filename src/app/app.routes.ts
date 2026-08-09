import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    title: 'Entrar | Conecta+',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login)
  }
];
