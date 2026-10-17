import { Routes } from '@angular/router';

import { ambienteGuard, visitanteGuard } from './shared/guards/ambiente.guard';

export const routes: Routes = [
  // Landing page pública: qualquer visitante vê as vagas abertas sem precisar
  // se cadastrar. Fora do Shell de propósito — quem chega aqui ainda não tem
  // sessão, então não faz sentido mostrar a sidebar. Quem já está logado
  // (ex.: "Lembrar de mim") e volta à plataforma vai direto para o seu Início.
  {
    path: '',
    pathMatch: 'full',
    canActivate: [visitanteGuard],
    title: 'Conecta+',
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing)
  },
  {
    path: 'vaga/:id',
    title: 'Vaga | Conecta+',
    loadComponent: () => import('./features/vaga-publica/vaga-publica').then((m) => m.VagaPublica)
  },
  {
    path: 'login',
    canActivate: [visitanteGuard],
    title: 'Entrar | Conecta+',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login)
  },
  {
    path: 'cadastro',
    canActivate: [visitanteGuard],
    title: 'Criar conta | Conecta+',
    loadComponent: () =>
      import('./features/auth/register-choice/register-choice').then((m) => m.RegisterChoice)
  },

  // Fora do Shell de propósito: quem se cadastra ainda não tem sessão, então
  // não faz sentido mostrar a sidebar nessas telas.
  {
    path: 'candidato/cadastro',
    canActivate: [visitanteGuard],
    title: 'Cadastro de Candidato | Conecta+',
    loadComponent: () =>
      import('./features/candidato/register/candidato-register').then((m) => m.CandidatoRegister)
  },
  {
    path: 'empresa/cadastro',
    canActivate: [visitanteGuard],
    title: 'Cadastro de Empresa | Conecta+',
    loadComponent: () =>
      import('./features/company/register/company-register').then((m) => m.CompanyRegister)
  },
  {
    path: 'empresa/aguardando-confirmacao',
    title: 'Aguardando Confirmação | Conecta+',
    loadComponent: () =>
      import('./features/company/aguardando-confirmacao/aguardando-confirmacao').then(
        (m) => m.AguardandoConfirmacao
      )
  },

  // Ambiente da equipe Conecta+: login próprio e layout próprio. As chamadas
  // à API /admin levam um token assinado (tokenAdminInterceptor).
  {
    path: 'admin/login',
    canActivate: [visitanteGuard],
    title: 'Equipe | Conecta+',
    loadComponent: () => import('./features/admin/login/admin-login').then((m) => m.AdminLogin)
  },
  {
    path: 'admin',
    canActivate: [ambienteGuard('admin')],
    loadComponent: () => import('./features/admin/layout/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'empresas' },
      {
        path: 'empresas',
        title: 'Validação de empresas | Conecta+',
        loadComponent: () => import('./features/admin/empresas/admin-empresas').then((m) => m.AdminEmpresas)
      },
      {
        path: 'empresas/:id',
        title: 'Análise de empresa | Conecta+',
        loadComponent: () =>
          import('./features/admin/empresa-detalhe/admin-empresa-detalhe').then((m) => m.AdminEmpresaDetalhe)
      },
      {
        path: 'equipe',
        title: 'Equipe | Conecta+',
        loadComponent: () => import('./features/admin/equipe/admin-equipe').then((m) => m.AdminEquipe)
      }
    ]
  },

  // Telas do sistema: compartilham a sidebar global via layout Shell.
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'cursos',
        title: 'Cursos | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () => import('./features/cursos/cursos').then((m) => m.Cursos)
      },
      {
        path: 'perfil',
        title: 'Perfil | Conecta+',
        canActivate: [ambienteGuard('usuario')],
        loadComponent: () => import('./features/perfil/perfil').then((m) => m.Perfil)
      },
      {
        path: 'painel',
        title: 'Painel | Conecta+',
        canActivate: [ambienteGuard('usuario')],
        loadComponent: () => import('./features/painel/painel').then((m) => m.Painel)
      },
      {
        path: 'vagas-disponiveis',
        title: 'Vagas Disponíveis | Conecta+',
        canActivate: [ambienteGuard('usuario')],
        loadComponent: () =>
          import('./features/candidato/vagas-disponiveis/vagas-disponiveis').then(
            (m) => m.VagasDisponiveis
          )
      },
      // Mesma tela de /vaga/:id (pública), mas dentro do Shell: candidato
      // logado que abre uma vaga pelo painel ou pelas vagas disponíveis
      // continua vendo a sidebar, em vez de cair na versão sem sessão.
      {
        path: 'vagas-disponiveis/:id',
        title: 'Vaga | Conecta+',
        canActivate: [ambienteGuard('usuario')],
        loadComponent: () => import('./features/vaga-publica/vaga-publica').then((m) => m.VagaPublica)
      },
      // Fluxo de candidatura: o formulário de envio e, depois, a confirmação
      // que também serve de acompanhamento do processo seletivo.
      {
        path: 'vagas-disponiveis/:id/candidatar',
        title: 'Candidatar-se | Conecta+',
        canActivate: [ambienteGuard('usuario')],
        loadComponent: () =>
          import('./features/candidato/candidatura/candidatura').then((m) => m.Candidatura)
      },
      {
        path: 'vagas-disponiveis/:id/candidatura',
        title: 'Candidatura enviada | Conecta+',
        canActivate: [ambienteGuard('usuario')],
        loadComponent: () =>
          import('./features/candidato/candidatura-enviada/candidatura-enviada').then(
            (m) => m.CandidaturaEnviada
          )
      },
      {
        path: 'cursos-disponiveis',
        title: 'Cursos Disponíveis | Conecta+',
        canActivate: [ambienteGuard('usuario')],
        loadComponent: () =>
          import('./features/candidato/cursos-disponiveis/cursos-disponiveis').then(
            (m) => m.CursosDisponiveis
          )
      },
      {
        path: 'cursos-disponiveis/:id/matricula',
        title: 'Matrícula | Conecta+',
        canActivate: [ambienteGuard('usuario')],
        loadComponent: () =>
          import('./features/candidato/matricula-curso/matricula-curso').then((m) => m.MatriculaCursoPagina)
      },
      {
        path: 'cursos-disponiveis/:id',
        title: 'Curso | Conecta+',
        canActivate: [ambienteGuard('usuario')],
        loadComponent: () =>
          import('./features/candidato/curso-detalhes/curso-detalhes').then((m) => m.CursoDetalhes)
      },

      // Ambiente da empresa: rotas marcadas com data.ambiente para o menu
      // lateral saber trocar "Perfil" (usuário) por "Candidatos" (empresa).
      // Todas exigem estar logado como empresa — o guard manda pro /login
      // quem não estiver (o cadastro em si fica fora do Shell, acima).
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
        path: 'empresa/candidatos/:id',
        title: 'Detalhes do Candidato | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () =>
          import('./features/company/candidato-detalhes/candidato-detalhes').then((m) => m.CandidatoDetalhes)
      },
      {
        path: 'empresa/candidaturas/:id',
        title: 'Gerenciar Candidatura | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () =>
          import('./features/company/candidatura-gestao/candidatura-gestao').then((m) => m.GerenciarCandidatura)
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
        path: 'empresa/cursos/novo',
        title: 'Cadastrar Curso | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () =>
          import('./features/company/curso-register/curso-register').then((m) => m.CursoRegister)
      },
      {
        path: 'empresa/cursos/:id',
        title: 'Detalhes do Curso | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () =>
          import('./features/company/curso-detalhes/curso-detalhes-empresa').then(
            (m) => m.CursoDetalhesEmpresa
          )
      },
      {
        path: 'empresa/cursos/:id/editar',
        title: 'Editar Curso | Conecta+',
        data: { ambiente: 'empresa' },
        canActivate: [ambienteGuard('empresa')],
        loadComponent: () =>
          import('./features/company/curso-register/curso-register').then((m) => m.CursoRegister)
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
