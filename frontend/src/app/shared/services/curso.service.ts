import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import {
  CapituloCurso,
  Curso,
  CursoDetalhado,
  InscritoCurso,
  MatriculaCurso,
  MetodoPagamento,
  ModuloCurso,
  NivelCurso,
  NovoCurso,
  PagamentoCartao,
  PagamentoCurso,
  StatusCurso,
  StatusMatricula,
  StatusPagamento,
  TipoConteudoCurso
} from '../types/curso';

/** Formato bruto devolvido pela API: colunas da TBLCDSCURSO0 + NOMEEMPRESA (join). */
interface CursoDaApi {
  IDCURSO: number;
  IDEMPRESA: number;
  NOMEEMPRESA: string;
  TITULO: string;
  DESCRICAO: string | null;
  CARGAHORARIA: number | null;
  // O mysql2 devolve colunas DECIMAL como string, para não perder precisão.
  PRECO: string | null;
  DTCAD: string;
  STATUSCURSO: StatusCurso;
  NIVEL: NivelCurso | null;
  CERTIFICADO: number;
  AVALIACAOMEDIA: string | null;
  TOTALAVALIACOES: number;
}

interface CapituloDaApi {
  IDCAPITULO: number;
  TITULO: string;
  DESCRICAO: string | null;
  TIPOCONTEUDO: TipoConteudoCurso;
  LINKCAPITULO: string | null;
  ARQUIVOCAPITULO: string | null;
  MATERIAL: string | null;
}

interface ModuloDaApi {
  IDMODULO: number;
  TITULO: string;
  CARGAHORARIA: number | null;
  capitulos: CapituloDaApi[];
}

interface CursoDetalhadoDaApi extends CursoDaApi {
  aprendizados: string[];
  skills: string[];
  modulos: ModuloDaApi[];
  CONTEUDOLIBERADO: boolean;
  MATRICULA: { IDMATRICULA: number; STATUSMATRICULA: StatusMatricula; DTCONCLUSAO: string | null } | null;
  MINHAAVALIACAO: { NOTA: number; COMENTARIO: string | null } | null;
}

interface PagamentoDaApi {
  IDPAGAMENTO: number;
  METODO: MetodoPagamento;
  VALOR: string;
  PARCELAS: number;
  STATUSPAGAMENTO: StatusPagamento;
  DETALHESTATUS: string | null;
  PIXCOPIACOLA: string | null;
  PIXQRCODE: string | null;
  PIXEXPIRACAO: string | null;
  CARTAOBANDEIRA: string | null;
  CARTAOFINAL: string | null;
  STATUSMATRICULA?: StatusMatricula;
}

interface MatriculaDaApi {
  IDMATRICULA: number;
  IDCURSO: number;
  TITULO: string;
  NOMEEMPRESA: string;
  CARGAHORARIA: number | null;
  NIVEL: NivelCurso | null;
  CERTIFICADO: number;
  VALOR: string;
  STATUSMATRICULA: StatusMatricula;
  OBSACESSIBILIDADE: string | null;
  necessidades: string[];
  pagamento: PagamentoDaApi | null;
}

interface InscritoDaApi {
  IDMATRICULA: number;
  IDPCD: number;
  NOME: string;
  EMAIL: string | null;
  STATUSMATRICULA: StatusMatricula;
  VALOR: string;
  DTCAD: string;
  DTATIVACAO: string | null;
  DTCONCLUSAO: string | null;
  METODO: MetodoPagamento | null;
  STATUSPAGAMENTO: StatusPagamento | null;
  PARCELAS: number | null;
  DTPAGAMENTO: string | null;
  NECESSIDADES: string | null;
}

function paraInscrito(i: InscritoDaApi): InscritoCurso {
  return {
    idMatricula: i.IDMATRICULA,
    idCandidato: i.IDPCD,
    nome: i.NOME,
    email: i.EMAIL,
    statusMatricula: i.STATUSMATRICULA,
    valor: Number(i.VALOR),
    dataMatricula: i.DTCAD,
    dataAtivacao: i.DTATIVACAO,
    dataConclusao: i.DTCONCLUSAO,
    pagamento:
      i.METODO && i.STATUSPAGAMENTO
        ? { metodo: i.METODO, status: i.STATUSPAGAMENTO, parcelas: i.PARCELAS ?? 1, data: i.DTPAGAMENTO ?? i.DTCAD }
        : null,
    necessidades: i.NECESSIDADES ? i.NECESSIDADES.split('||') : []
  };
}

function paraPagamento(pagamento: PagamentoDaApi, statusMatricula?: StatusMatricula): PagamentoCurso {
  return {
    id: pagamento.IDPAGAMENTO,
    metodo: pagamento.METODO,
    valor: Number(pagamento.VALOR),
    parcelas: pagamento.PARCELAS,
    status: pagamento.STATUSPAGAMENTO,
    detalheStatus: pagamento.DETALHESTATUS,
    pixCopiaECola: pagamento.PIXCOPIACOLA,
    pixQrCodeBase64: pagamento.PIXQRCODE,
    pixExpiracao: pagamento.PIXEXPIRACAO,
    cartaoBandeira: pagamento.CARTAOBANDEIRA,
    cartaoFinal: pagamento.CARTAOFINAL,
    statusMatricula: pagamento.STATUSMATRICULA ?? statusMatricula ?? 'PENDENTE'
  };
}

function paraMatricula(matricula: MatriculaDaApi): MatriculaCurso {
  return {
    id: matricula.IDMATRICULA,
    idCurso: matricula.IDCURSO,
    tituloCurso: matricula.TITULO,
    nomeEmpresa: matricula.NOMEEMPRESA,
    cargaHoraria: matricula.CARGAHORARIA,
    nivel: matricula.NIVEL,
    certificado: Boolean(matricula.CERTIFICADO),
    valor: Number(matricula.VALOR),
    status: matricula.STATUSMATRICULA,
    necessidades: matricula.necessidades,
    observacao: matricula.OBSACESSIBILIDADE,
    pagamento: matricula.pagamento ? paraPagamento(matricula.pagamento, matricula.STATUSMATRICULA) : null
  };
}

function paraCurso(curso: CursoDaApi): Curso {
  return {
    id: curso.IDCURSO,
    idEmpresa: curso.IDEMPRESA,
    nomeEmpresa: curso.NOMEEMPRESA,
    titulo: curso.TITULO,
    descricao: curso.DESCRICAO,
    cargaHoraria: curso.CARGAHORARIA,
    preco: curso.PRECO !== null ? Number(curso.PRECO) : null,
    dataCadastro: curso.DTCAD,
    status: curso.STATUSCURSO,
    nivel: curso.NIVEL,
    certificado: Boolean(curso.CERTIFICADO),
    avaliacaoMedia: curso.AVALIACAOMEDIA !== null ? Number(curso.AVALIACAOMEDIA) : null,
    totalAvaliacoes: Number(curso.TOTALAVALIACOES ?? 0)
  };
}

function paraCapitulo(capitulo: CapituloDaApi): CapituloCurso {
  return {
    id: capitulo.IDCAPITULO,
    titulo: capitulo.TITULO,
    descricao: capitulo.DESCRICAO,
    tipoConteudo: capitulo.TIPOCONTEUDO,
    linkCapitulo: capitulo.LINKCAPITULO,
    arquivoCapituloUrl: capitulo.ARQUIVOCAPITULO ? `${URL_BASE_API}/uploads/cursos/${capitulo.ARQUIVOCAPITULO}` : null,
    materialUrl: capitulo.MATERIAL ? `${URL_BASE_API}/uploads/cursos/${capitulo.MATERIAL}` : null
  };
}

function paraModulo(modulo: ModuloDaApi): ModuloCurso {
  return {
    id: modulo.IDMODULO,
    titulo: modulo.TITULO,
    cargaHoraria: modulo.CARGAHORARIA,
    capitulos: modulo.capitulos.map(paraCapitulo)
  };
}

function paraCursoDetalhado(curso: CursoDetalhadoDaApi): CursoDetalhado {
  return {
    ...paraCurso(curso),
    aprendizados: curso.aprendizados,
    skills: curso.skills,
    modulos: curso.modulos.map(paraModulo),
    conteudoLiberado: curso.CONTEUDOLIBERADO,
    matricula: curso.MATRICULA
      ? {
          id: curso.MATRICULA.IDMATRICULA,
          status: curso.MATRICULA.STATUSMATRICULA,
          dataConclusao: curso.MATRICULA.DTCONCLUSAO ?? null
        }
      : null,
    minhaAvaliacao: curso.MINHAAVALIACAO
      ? { nota: curso.MINHAAVALIACAO.NOTA, comentario: curso.MINHAAVALIACAO.COMENTARIO }
      : null
  };
}

/**
 * Monta o multipart/form-data: os módulos/capítulos viajam como JSON num
 * único campo (`modulos`), o vídeo de capítulo vai num campo à parte,
 * nomeado `modulo_<i>_capitulo_<j>`, e o material de apoio (opcional, de
 * qualquer tipo de conteúdo) vai em `material_modulo_<i>_capitulo_<j>` — é
 * assim que o controller casa cada arquivo de volta com o capítulo certo.
 */
function paraFormData(dados: NovoCurso, idEmpresa: number): FormData {
  const formData = new FormData();

  formData.append('idEmpresa', String(idEmpresa));
  formData.append('titulo', dados.titulo);
  if (dados.descricao) {
    formData.append('descricao', dados.descricao);
  }
  if (dados.cargaHoraria !== null) {
    formData.append('cargaHoraria', String(dados.cargaHoraria));
  }
  if (dados.preco !== null) {
    formData.append('preco', String(dados.preco));
  }
  if (dados.nivel) {
    formData.append('nivel', dados.nivel);
  }
  formData.append('certificado', String(dados.certificado));
  formData.append('aprendizados', JSON.stringify(dados.aprendizados));
  formData.append('skills', JSON.stringify(dados.skills));

  const modulosParaJson = dados.modulos.map((modulo) => ({
    titulo: modulo.titulo,
    cargaHoraria: modulo.cargaHoraria,
    capitulos: modulo.capitulos.map((capitulo) => ({
      titulo: capitulo.titulo,
      descricao: capitulo.descricao,
      tipoConteudo: capitulo.tipoConteudo,
      linkCapitulo: capitulo.tipoConteudo === 'LINK' ? capitulo.linkCapitulo : null,
      arquivoAtual: capitulo.tipoConteudo === 'ARQUIVO' ? capitulo.arquivoAtual : null,
      materialAtual: capitulo.materialAtual
    }))
  }));
  formData.append('modulos', JSON.stringify(modulosParaJson));

  dados.modulos.forEach((modulo, indiceModulo) => {
    modulo.capitulos.forEach((capitulo, indiceCapitulo) => {
      const chave = `modulo_${indiceModulo}_capitulo_${indiceCapitulo}`;

      if (capitulo.tipoConteudo === 'ARQUIVO' && capitulo.arquivo) {
        formData.append(chave, capitulo.arquivo);
      }
      if (capitulo.material) {
        formData.append(`material_${chave}`, capitulo.material);
      }
    });
  });

  return formData;
}

@Injectable({ providedIn: 'root' })
export class CursoService {
  private readonly http = inject(HttpClient);

  /**
   * Sem `idEmpresa`, lista os cursos de todas as empresas. `status` é usado
   * pela busca aberta ao candidato PCD (`status: 'ATIVO'`), pra não mostrar
   * cursos desativados de nenhuma empresa.
   */
  listar(idEmpresa?: number, status?: StatusCurso): Observable<Curso[]> {
    let parametros = new HttpParams();
    if (idEmpresa !== undefined) {
      parametros = parametros.set('idEmpresa', idEmpresa);
    }
    if (status !== undefined) {
      parametros = parametros.set('status', status);
    }

    return this.http
      .get<CursoDaApi[]>(`${URL_BASE_API}/cursos`, { params: parametros })
      .pipe(map((cursos) => cursos.map(paraCurso)));
  }

  /**
   * Curso com os módulos e capítulos — usado na tela de detalhes e para
   * preencher a edição. Informe quem está pedindo: a empresa dona (`idEmpresa`)
   * recebe tudo; o candidato (`idPcd`) recebe o conteúdo das aulas só se o
   * curso for gratuito ou a matrícula estiver paga.
   */
  obterPorId(id: number, acesso: { idEmpresa?: number; idPcd?: number } = {}): Observable<CursoDetalhado> {
    let parametros = new HttpParams();
    if (acesso.idEmpresa !== undefined) {
      parametros = parametros.set('idEmpresa', acesso.idEmpresa);
    }
    if (acesso.idPcd !== undefined) {
      parametros = parametros.set('idPcd', acesso.idPcd);
    }

    return this.http
      .get<CursoDetalhadoDaApi>(`${URL_BASE_API}/cursos/${id}`, { params: parametros })
      .pipe(map(paraCursoDetalhado));
  }

  /** Etapa 1 da matrícula: cria (ou atualiza, se ainda pendente) a matrícula. Curso gratuito já volta ATIVA. */
  matricular(
    idCurso: number,
    idPcd: number,
    dados: { necessidades: string[]; observacao: string }
  ): Observable<MatriculaCurso> {
    return this.http
      .post<MatriculaDaApi>(`${URL_BASE_API}/cursos/${idCurso}/matriculas`, { idPcd, ...dados })
      .pipe(map(paraMatricula));
  }

  obterMatricula(idPcd: number, idCurso: number): Observable<MatriculaCurso> {
    return this.http
      .get<MatriculaDaApi>(`${URL_BASE_API}/usuarios/${idPcd}/matriculas/${idCurso}`)
      .pipe(map(paraMatricula));
  }

  /** Cursos em que o candidato tem matrícula (ativa ou aguardando pagamento). */
  listarMatriculas(idPcd: number): Observable<{ idCurso: number; status: StatusMatricula; concluido: boolean }[]> {
    return this.http
      .get<{ IDCURSO: number; STATUSMATRICULA: StatusMatricula; DTCONCLUSAO: string | null }[]>(
        `${URL_BASE_API}/usuarios/${idPcd}/matriculas`
      )
      .pipe(
        map((lista) =>
          lista.map((item) => ({ idCurso: item.IDCURSO, status: item.STATUSMATRICULA, concluido: !!item.DTCONCLUSAO }))
        )
      );
  }

  /** O aluno marca (ou desmarca) que terminou o curso; devolve a data de conclusão (ou `null`). */
  marcarConclusao(idCurso: number, idPcd: number, concluido: boolean): Observable<string | null> {
    return this.http
      .post<{ DTCONCLUSAO: string | null }>(`${URL_BASE_API}/cursos/${idCurso}/conclusao`, { idPcd, concluido })
      .pipe(map((matricula) => matricula.DTCONCLUSAO));
  }

  /** Inscritos no curso, com situação do pagamento — só para a empresa dona. */
  listarInscritos(idCurso: number, idEmpresa: number): Observable<InscritoCurso[]> {
    return this.http
      .get<InscritoDaApi[]>(`${URL_BASE_API}/cursos/${idCurso}/matriculas`, {
        params: new HttpParams().set('idEmpresa', idEmpresa)
      })
      .pipe(map((lista) => lista.map(paraInscrito)));
  }

  /** Etapa 2: cobra a matrícula pelo Mercado Pago. Pix devolve o QR Code; cartão já devolve aprovado/recusado. */
  pagar(idMatricula: number, idPcd: number, dados: { metodo: 'PIX' } | ({ metodo: 'CARTAO' } & PagamentoCartao)): Observable<PagamentoCurso> {
    return this.http
      .post<PagamentoDaApi>(`${URL_BASE_API}/matriculas/${idMatricula}/pagamentos`, { idPcd, ...dados })
      .pipe(map((pagamento) => paraPagamento(pagamento)));
  }

  /** Status atualizado do último pagamento — a tela do Pix consulta isso a cada poucos segundos. */
  consultarPagamento(idMatricula: number, idPcd: number): Observable<PagamentoCurso> {
    return this.http
      .get<PagamentoDaApi>(`${URL_BASE_API}/matriculas/${idMatricula}/pagamentos/ultimo`, {
        params: new HttpParams().set('idPcd', idPcd)
      })
      .pipe(map((pagamento) => paraPagamento(pagamento)));
  }

  /** Chave pública do Mercado Pago (o navegador usa para transformar o cartão em token). */
  obterConfiguracaoPagamentos(): Observable<{ habilitado: boolean; chavePublica: string | null }> {
    return this.http.get<{ habilitado: boolean; chavePublica: string | null }>(`${URL_BASE_API}/pagamentos/config`);
  }

  avaliar(idCurso: number, idPcd: number, nota: number, comentario: string): Observable<void> {
    return this.http.post<void>(`${URL_BASE_API}/cursos/${idCurso}/avaliacoes`, { idPcd, nota, comentario });
  }

  cadastrar(dados: NovoCurso, idEmpresa: number): Observable<CursoDetalhado> {
    return this.http
      .post<CursoDetalhadoDaApi>(`${URL_BASE_API}/cursos`, paraFormData(dados, idEmpresa))
      .pipe(map(paraCursoDetalhado));
  }

  atualizar(id: number, dados: NovoCurso, idEmpresa: number): Observable<CursoDetalhado> {
    return this.http
      .put<CursoDetalhadoDaApi>(`${URL_BASE_API}/cursos/${id}`, paraFormData(dados, idEmpresa))
      .pipe(map(paraCursoDetalhado));
  }
}
