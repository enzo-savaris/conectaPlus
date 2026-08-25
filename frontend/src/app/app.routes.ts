import { Routes } from '@angular/router';

import { ambienteGuard } from './shared/guards/ambiente.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    title: 'Entrar | Conecta+',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login)
  },
  {
    path: 'cadastro',
    title: 'Criar conta | Conecta+',
    loadComponent: () =>
      import('./features/auth/register-choice/register-choice').then((m) => m.RegisterChoice)
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
        path: 'curso',
        title: 'Curso | Conecta+',
        loadComponent: () => import('./features/curso/curso').then((m) => m.Curso)
      },
      {
        path: 'perfil',
        title: 'Perfil | Conecta+',
        loadComponent: () => import('./features/perfil/perfil').then((m) => m.Perfil)
      },
      {
        path: 'painel',
        title: 'Painel | Conecta+',
        canActivate: [ambienteGuard('usuario')],
        loadComponent: () => import('./features/painel/painel').then((m) => m.Painel)
      },

      // Ambiente da empresa: rotas marcadas com data.ambiente para o menu
      // lateral saber trocar "Perfil" (usuário) por "Candidatos" (empresa).
      // Todas, exceto o cadastro (é por onde uma empresa nova se registra),
      // exigem estar logado como empresa — o guard manda pro /login quem não estiver.
      {
        path: 'empresa/cadastro',
        title: 'Cadastro de Empresa | Conecta+',
        data: { ambiente: 'empresa' },
        loadComponent: () =>
          import('./features/company/register/company-register').then((m) => m.CompanyRegister)
      },
      {
        path: 'empresa/painel',
        title: 'Painel da empresa | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () =>
          import('./features/company/painel-empresa/painel-empresa').then((m) => m.PainelEmpresa)
      },
      {
        path: 'vagas',
        title: 'Vagas | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () => import('./features/vagas/vagas').then((m) => m.Vagas)
      },
      {
        path: 'empresa/perfil',
        title: 'Perfil da Empresa | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () =>
          import('./features/company/perfil-empresa/perfil-empresa').then((m) => m.PerfilEmpresa)
      },
      {
        path: 'empresa/candidatos',
        title: 'Candidatos | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () => import('./features/candidatos/candidatos').then((m) => m.Candidatos)
      },
      {
        path: 'empresa/vagas/nova',
        title: 'Cadastrar Vaga | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () =>
          import('./features/company/vaga-register/vaga-register').then((m) => m.VagaRegister)
      },
      {
        path: 'empresa/vagas/:id',
        title: 'Detalhes da Vaga | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () =>
          import('./features/company/vaga-detalhes/vaga-detalhes').then((m) => m.VagaDetalhes)
      },
      {
        path: 'empresa/vagas/:id/editar',
        title: 'Editar Vaga | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () =>
          import('./features/company/vaga-register/vaga-register').then((m) => m.VagaRegister)
      }
    ]
  }
];
