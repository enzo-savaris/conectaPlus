import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { ProcessoSeletivoDaApi, paraProcessoSeletivo } from './candidatura.service';
import {
  AcompanhamentoCandidatura,
  AdaptacoesCandidatura,
  Candidatura,
  CursoRecomendado,
  EnvioCandidatura,
  MinhaCandidatura,
  ModeloTrabalho,
  NovaVaga,
  StatusCandidatura,
  StatusVaga,
  TipoContratacao,
  Vaga,
  VagaDetalhada
} from '../types/vaga';

/** Formato bruto devolvido pela API: colunas da TBLCDSVAG0. */
interface VagaDaApi {
  IDVAGA: number;
  IDEMPRESA: number;
  NOMEEMPRESA: string;
  TITULO: string;
  AREA: string | null;
  DESCRICAO: string;
  IDCIDADE: number | null;
  CIDADE: string | null;
  ESTADO: string | null;
  MODELOTRABALHO: ModeloTrabalho;
  TIPOCONTRATACAO: TipoContratacao;
  // O mysql2 devolve colunas DECIMAL como string, para não perder precisão.
  SALARIOMIN: string | null;
  SALARIOMAX: string | null;
  DTCAD: string;
  STATUSVAGA: StatusVaga;
}

/** Formato bruto de um curso recomendado, devolvido dentro de GET /vagas/:id. */
interface CursoRecomendadoDaApi {
  IDCURSO: number;
  TITULO: string;
  CARGAHORARIA: number | null;
  PRECO: string | null;
}

function paraCursoRecomendado(curso: CursoRecomendadoDaApi): CursoRecomendado {
  return {
    id: curso.IDCURSO,
    titulo: curso.TITULO,
    cargaHoraria: curso.CARGAHORARIA,
    preco: curso.PRECO !== null ? Number(curso.PRECO) : null
  };
}

/** GET /vagas/:id devolve, além das colunas da vaga, as listas de itens do cadastro. */
interface VagaDetalhadaDaApi extends VagaDaApi {
  responsabilidades: string[];
  requisitos: string[];
  acessibilidade: string[];
  beneficios: string[];
  perguntas: string[];
  cursosRecomendados: CursoRecomendadoDaApi[];
}

function paraVaga(vaga: VagaDaApi): Vaga {
  return {
    id: vaga.IDVAGA,
    idEmpresa: vaga.IDEMPRESA,
    nomeEmpresa: vaga.NOMEEMPRESA,
    titulo: vaga.TITULO,
    area: vaga.AREA,
    descricao: vaga.DESCRICAO,
    idCidade: vaga.IDCIDADE,
    cidade: vaga.CIDADE,
    estado: vaga.ESTADO,
    modeloTrabalho: vaga.MODELOTRABALHO,
    tipoContratacao: vaga.TIPOCONTRATACAO,
    salarioMinimo: vaga.SALARIOMIN !== null ? Number(vaga.SALARIOMIN) : null,
    salarioMaximo: vaga.SALARIOMAX !== null ? Number(vaga.SALARIOMAX) : null,
    dataCadastro: vaga.DTCAD,
    status: vaga.STATUSVAGA
  };
}

function paraVagaDetalhada(vaga: VagaDetalhadaDaApi): VagaDetalhada {
  return {
    ...paraVaga(vaga),
    responsabilidades: vaga.responsabilidades,
    requisitos: vaga.requisitos,
    acessibilidade: vaga.acessibilidade,
    beneficios: vaga.beneficios,
    perguntas: vaga.perguntas,
    cursosRecomendados: vaga.cursosRecomendados.map(paraCursoRecomendado)
  };
}

/** Formato bruto devolvido pela API: GET /vagas/:id/candidaturas. */
interface CandidaturaDaApi {
  IDCANDIDATURA: number;
  IDPCD: number;
  NOME: string;
  EMAIL: string | null;
  SOBREMIM: string | null;
  STATUSCANDIDATURA: StatusCandidatura;
  DTCANDIDATURA: string;
  CARTAAPRESENTACAO: string | null;
  CURRICULOPDF: string | null;
  ENTREVISTAREMOTA: number;
  TEMPOESTENDIDO: number;
  INTERPRETELIBRAS: number;
  INICIOIMEDIATO: number;
  respostas: RespostaDaApi[];
}

interface RespostaDaApi {
  PERGUNTA: string;
  RESPOSTA: string;
}

/** As flags de acessibilidade são TINYINT(1) no MySQL, então chegam como 0/1. */
function paraAdaptacoes(candidatura: {
  ENTREVISTAREMOTA: number;
  TEMPOESTENDIDO: number;
  INTERPRETELIBRAS: number;
}): AdaptacoesCandidatura {
  return {
    entrevistaRemota: Boolean(candidatura.ENTREVISTAREMOTA),
    tempoEstendido: Boolean(candidatura.TEMPOESTENDIDO),
    interpreteLibras: Boolean(candidatura.INTERPRETELIBRAS)
  };
}

function paraCandidatura(candidatura: CandidaturaDaApi): Candidatura {
  return {
    id: candidatura.IDCANDIDATURA,
    idCandidato: candidatura.IDPCD,
    nome: candidatura.NOME,
    email: candidatura.EMAIL,
    sobreMim: candidatura.SOBREMIM,
    status: candidatura.STATUSCANDIDATURA,
    dataCandidatura: candidatura.DTCANDIDATURA,
    cartaApresentacao: candidatura.CARTAAPRESENTACAO,
    curriculoPdfUrl: candidatura.CURRICULOPDF
      ? `${URL_BASE_API}/uploads/curriculos/${candidatura.CURRICULOPDF}`
      : null,
    adaptacoes: paraAdaptacoes(candidatura),
    inicioImediato: Boolean(candidatura.INICIOIMEDIATO),
    respostas: candidatura.respostas.map((item) => ({ pergunta: item.PERGUNTA, resposta: item.RESPOSTA }))
  };
}

/** Formato bruto devolvido pela API: GET /usuarios/:id/candidaturas/:idVaga. */
interface AcompanhamentoCandidaturaDaApi extends ProcessoSeletivoDaApi {
  IDCANDIDATURA: number;
  IDVAGA: number;
  TITULO: string;
  NOMEEMPRESA: string;
  ENTREVISTAREMOTA: number;
  TEMPOESTENDIDO: number;
  INTERPRETELIBRAS: number;
}

function paraAcompanhamento(candidatura: AcompanhamentoCandidaturaDaApi): AcompanhamentoCandidatura {
  return {
    ...paraProcessoSeletivo(candidatura),
    id: candidatura.IDCANDIDATURA,
    idVaga: candidatura.IDVAGA,
    tituloVaga: candidatura.TITULO,
    nomeEmpresa: candidatura.NOMEEMPRESA,
    adaptacoes: paraAdaptacoes(candidatura)
  };
}

/** Monta o multipart/form-data: o currículo em PDF opcional só viaja assim. */
function paraFormDataCandidatura(idPcd: number, dados: EnvioCandidatura): FormData {
  const formData = new FormData();

  formData.append('idPcd', String(idPcd));
  formData.append('cartaApresentacao', dados.cartaApresentacao);
  formData.append('aceiteTermos', String(dados.aceiteTermos));
  formData.append('inicioImediato', String(dados.inicioImediato));
  formData.append('entrevistaRemota', String(dados.adaptacoes.entrevistaRemota));
  formData.append('tempoEstendido', String(dados.adaptacoes.tempoEstendido));
  formData.append('interpreteLibras', String(dados.adaptacoes.interpreteLibras));
  formData.append('respostas', JSON.stringify(dados.respostas));

  if (dados.curriculoPdf) {
    formData.append('curriculoPdf', dados.curriculoPdf);
  }

  return formData;
}

/** Formato bruto devolvido pela API: GET /usuarios/:id/candidaturas. */
interface MinhaCandidaturaDaApi {
  IDCANDIDATURA: number;
  IDVAGA: number;
  TITULO: string;
  STATUSCANDIDATURA: StatusCandidatura;
  DTCANDIDATURA: string;
}

function paraMinhaCandidatura(candidatura: MinhaCandidaturaDaApi): MinhaCandidatura {
  return {
    idVaga: candidatura.IDVAGA,
    titulo: candidatura.TITULO,
    status: candidatura.STATUSCANDIDATURA,
    dataCandidatura: candidatura.DTCANDIDATURA
  };
}

@Injectable({ providedIn: 'root' })
export class VagaService {
  private readonly http = inject(HttpClient);

  /**
   * Sem `idEmpresa`, lista as vagas de todas as empresas. `status` é usado
   * pela busca aberta ao candidato PCD (`status: 'ATIVA'`), pra não mostrar
   * vagas encerradas ou inativas.
   */
  listar(idEmpresa?: number, status?: StatusVaga): Observable<Vaga[]> {
    let parametros = new HttpParams();
    if (idEmpresa !== undefined) {
      parametros = parametros.set('idEmpresa', idEmpresa);
    }
    if (status !== undefined) {
      parametros = parametros.set('status', status);
    }

    return this.http
      .get<VagaDaApi[]>(`${URL_BASE_API}/vagas`, { params: parametros })
      .pipe(map((vagas) => vagas.map(paraVaga)));
  }

  cadastrar(dados: NovaVaga, idEmpresa: number): Observable<Vaga> {
    return this.http
      .post<VagaDaApi>(`${URL_BASE_API}/vagas`, { ...dados, idEmpresa })
      .pipe(map(paraVaga));
  }

  /** Busca a vaga com as listas de itens, para preencher o formulário de edição. */
  obterPorId(id: number): Observable<VagaDetalhada> {
    return this.http
      .get<VagaDetalhadaDaApi>(`${URL_BASE_API}/vagas/${id}`)
      .pipe(map(paraVagaDetalhada));
  }

  atualizar(id: number, dados: NovaVaga, idEmpresa: number): Observable<Vaga> {
    return this.http
      .put<VagaDaApi>(`${URL_BASE_API}/vagas/${id}`, { ...dados, idEmpresa })
      .pipe(map(paraVaga));
  }

  /** Lista os inscritos da vaga, só se ela pertencer à empresa informada. */
  listarCandidaturas(idVaga: number, idEmpresa: number): Observable<Candidatura[]> {
    const parametros = new HttpParams().set('idEmpresa', idEmpresa);

    return this.http
      .get<CandidaturaDaApi[]>(`${URL_BASE_API}/vagas/${idVaga}/candidaturas`, { params: parametros })
      .pipe(map((candidaturas) => candidaturas.map(paraCandidatura)));
  }

  remover(id: number, idEmpresa: number): Observable<void> {
    const parametros = new HttpParams().set('idEmpresa', idEmpresa);
    return this.http.delete<void>(`${URL_BASE_API}/vagas/${id}`, { params: parametros });
  }

  /** Candidata o PCD logado (`idPcd`) à vaga. O backend recusa uma segunda candidatura à mesma vaga. */
  candidatar(idVaga: number, idPcd: number, dados: EnvioCandidatura): Observable<void> {
    return this.http
      .post<unknown>(`${URL_BASE_API}/vagas/${idVaga}/candidaturas`, paraFormDataCandidatura(idPcd, dados))
      .pipe(map(() => undefined));
  }

  /** Candidatura do candidato logado a uma vaga, para a tela de acompanhamento. */
  obterMinhaCandidatura(idPcd: number, idVaga: number): Observable<AcompanhamentoCandidatura> {
    return this.http
      .get<AcompanhamentoCandidaturaDaApi>(`${URL_BASE_API}/usuarios/${idPcd}/candidaturas/${idVaga}`)
      .pipe(map(paraAcompanhamento));
  }

  /** Lista as vagas em que o candidato logado já se candidatou, para marcar "Já candidatado" na lista. */
  listarMinhasCandidaturas(idPcd: number): Observable<MinhaCandidatura[]> {
    return this.http
      .get<MinhaCandidaturaDaApi[]>(`${URL_BASE_API}/usuarios/${idPcd}/candidaturas`)
      .pipe(map((candidaturas) => candidaturas.map(paraMinhaCandidatura)));
  }
}
