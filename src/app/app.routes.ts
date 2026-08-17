import { Routes } from '@angular/router';

export const routes: Routes = [
  // Provisório: a raiz abre a tela de testes.
  // Para voltar ao comportamento final, troque 'teste' por 'login'.
  { path: '', pathMatch: 'full', redirectTo: 'teste' },
  {
    path: 'login',
    title: 'Entrar | Conecta+',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login)
  },

  // Telas do sistema: compartilham a sidebar global via layout Shell.
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'teste',
        title: 'Testes | Conecta+',
        loadComponent: () => import('./features/home/home').then((m) => m.Home)
      },
      {
        path: 'vagas',
        title: 'Vagas | Conecta+',
        loadComponent: () => import('./features/vagas/vagas').then((m) => m.Vagas)
      },
      {
        path: 'curso',
        title: 'Curso | Conecta+',
        loadComponent: () => import('./features/curso/curso').then((m) => m.Curso)
      },
      {
        path: 'perfil',
        title: 'Perfil | Conecta+',
        loadComponent: () => import('./features/perfil/perfil').then((m) => m.Perfil)
      },

      // Ambiente da empresa: rotas marcadas com data.ambiente para o menu
      // lateral saber trocar "Perfil" (usuário) por "Candidatos" (empresa).
      {
        path: 'empresa/cadastro',
        title: 'Cadastro de Empresa | Conecta+',
        data: { ambiente: 'empresa' },
        loadComponent: () =>
          import('./features/company/register/company-register').then((m) => m.CompanyRegister)
      },
      {
        path: 'empresa/candidatos',
        title: 'Candidatos | Conecta+',
        data: { ambiente: 'empresa' },
        loadComponent: () => import('./features/candidatos/candidatos').then((m) => m.Candidatos)
      },
      {
        path: 'empresa/vagas/nova',
        title: 'Cadastrar Vaga | Conecta+',
        data: { ambiente: 'empresa' },
        loadComponent: () =>
          import('./features/company/vaga-register/vaga-register').then((m) => m.VagaRegister)
      }
    ]
  }
];
