/**
 * Erro que a camada de service usa para avisar o controller do que deu
 * errado, sem precisar conhecer o Express. O controller lê o `status` e
 * monta a resposta HTTP.
 */
export class ErroApp extends Error {
  readonly status: number;
  readonly erros: Record<string, string> | undefined;

  constructor(status: number, mensagem: string, erros?: Record<string, string>) {
    super(mensagem);
    this.name = 'ErroApp';
    this.status = status;
    this.erros = erros;
  }
}

/** 422 — os dados enviados não passaram na validação. */
export function erroDeValidacao(erros: Record<string, string>): ErroApp {
  return new ErroApp(422, 'Alguns campos estão inválidos.', erros);
}

/** 404 — o registro não existe. */
export function erroNaoEncontrado(mensagem: string): ErroApp {
  return new ErroApp(404, mensagem);
}

/** 409 — conflito com um registro que já existe. */
export function erroDeConflito(mensagem: string, erros?: Record<string, string>): ErroApp {
  return new ErroApp(409, mensagem, erros);
}

/**
 * 401 — CPF/CNPJ ou senha incorretos. A mensagem é sempre a mesma, sem dizer
 * qual dos dois está errado, para não revelar quais documentos têm conta.
 */
export function erroDeAutenticacao(): ErroApp {
  return new ErroApp(401, 'CPF/CNPJ ou senha incorretos.');
}

/**
 * 403 — a senha confere, mas a empresa ainda está PENDENTE de confirmação.
 * `erros.situacao` é lido pelo frontend para redirecionar à tela de
 * "Aguardando Confirmação" em vez de mostrar um erro genérico de login.
 */
export function erroEmpresaPendente(): ErroApp {
  return new ErroApp(
    403,
    'Cadastro em análise. Aguarde a confirmação para acessar a plataforma.',
    { situacao: 'PENDENTE' }
  );
}

/**
 * 403 — a empresa está logada, mas não está ATIVA (PENDENTE de uma nova
 * aprovação após editar CNPJ/razão social, ou INATIVA). Enquanto isso, ela só
 * pode visualizar as vagas e cursos já cadastrados, não criar ou editar.
 * `erros.situacao` é lido pelo frontend para adaptar a tela (esconder ou
 * desabilitar os botões de cadastro).
 */
export function erroEmpresaNaoAtiva(): ErroApp {
  return new ErroApp(
    403,
    'Seu cadastro está em análise ou inativo. Você pode visualizar as vagas e cursos já cadastrados, mas não cadastrar ou editar novos até a aprovação.',
    { situacao: 'NAO_ATIVA' }
  );
}
