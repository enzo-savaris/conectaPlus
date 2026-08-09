import { Routes } from '@angular/router';

export const routes: Routes = [
  // Provisório: a raiz abre a tela de testes.
  // Para voltar ao comportamento final, troque 'teste' por 'login'.
  { path: '', pathMatch: 'full', redirectTo: 'teste' },
  {
    path: 'teste',
    title: 'Testes | Conecta+',
    loadComponent: () => import('./features/home/home').then((m) => m.Home)
  },
  {
    path: 'login',
    title: 'Entrar | Conecta+',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login)
  },

  // Ambiente da empresa
  {
    path: 'empresa/cadastro',
    title: 'Cadastro de Empresa | Conecta+',
    loadComponent: () =>
      import('./features/company/register/company-register').then((m) => m.CompanyRegister)
  }
];
