import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import {
  AcaoCandidatura,
  CandidaturaGestao,
  FormatoEntrevista,
  ModeloTrabalho,
  ProcessoSeletivo,
  StatusCandidatura
} from '../types/vaga';

/** Colunas do processo seletivo, iguais na visão da empresa e na do candidato. */
export interface ProcessoSeletivoDaApi {
  STATUSCANDIDATURA: StatusCandidatura;
  DTCANDIDATURA: string;
  DTENTREVISTA: string | null;
  FORMATOENTREVISTA: FormatoEntrevista | null;
  LOCALENTREVISTA: string | null;
  OBSENTREVISTA: string | null;
  DTINICIO: string | null;
  MENSAGEMEMPRESA: string | null;
  historico: { STATUSCANDIDATURA: StatusCandidatura; DTCAD: string }[];
}

export function paraProcessoSeletivo(processo: ProcessoSeletivoDaApi): ProcessoSeletivo {
  return {
    status: processo.STATUSCANDIDATURA,
    dataCandidatura: processo.DTCANDIDATURA,
    entrevista:
      processo.DTENTREVISTA && processo.FORMATOENTREVISTA
        ? {
            data: processo.DTENTREVISTA,
            formato: processo.FORMATOENTREVISTA,
            local: processo.LOCALENTREVISTA ?? '',
            observacoes: processo.OBSENTREVISTA
          }
        : null,
    dataInicio: processo.DTINICIO,
    mensagemEmpresa: processo.MENSAGEMEMPRESA,
    historico: processo.historico.map((item) => ({ status: item.STATUSCANDIDATURA, data: item.DTCAD }))
  };
}

/** Formato bruto devolvido por GET /candidaturas/:id e PUT /candidaturas/:id/etapa. */
interface CandidaturaGestaoDaApi extends ProcessoSeletivoDaApi {
  IDCANDIDATURA: number;
  IDVAGA: number;
  TITULO: string;
  MODELOTRABALHO: ModeloTrabalho;
  CARTAAPRESENTACAO: string | null;
  CURRICULOPDF: string | null;
  ENTREVISTAREMOTA: number;
  TEMPOESTENDIDO: number;
  INTERPRETELIBRAS: number;
  INICIOIMEDIATO: number;
  IDPCD: number;
  NOME: string;
  EMAIL: string | null;
  TELEFONE: string | null;
  TIPODEF: string;
  CIDADE: string | null;
  ESTADO: string | null;
  AVATAR: string | null;
  TITULOPROFISSIONAL: string | null;
  respostas: { PERGUNTA: string; RESPOSTA: string }[];
}

function paraCandidaturaGestao(c: CandidaturaGestaoDaApi): CandidaturaGestao {
  return {
    ...paraProcessoSeletivo(c),
    id: c.IDCANDIDATURA,
    idVaga: c.IDVAGA,
    tituloVaga: c.TITULO,
    modeloTrabalho: c.MODELOTRABALHO,
    candidato: {
      id: c.IDPCD,
      nome: c.NOME,
      email: c.EMAIL,
      telefone: c.TELEFONE,
      tipoDeficiencia: c.TIPODEF,
      cidade: c.CIDADE,
      estado: c.ESTADO,
      avatarUrl: c.AVATAR ? `${URL_BASE_API}/uploads/avatares/${c.AVATAR}` : null,
      tituloProfissional: c.TITULOPROFISSIONAL
    },
    cartaApresentacao: c.CARTAAPRESENTACAO,
    curriculoPdfUrl: c.CURRICULOPDF ? `${URL_BASE_API}/uploads/curriculos/${c.CURRICULOPDF}` : null,
    adaptacoes: {
      entrevistaRemota: Boolean(c.ENTREVISTAREMOTA),
      tempoEstendido: Boolean(c.TEMPOESTENDIDO),
      interpreteLibras: Boolean(c.INTERPRETELIBRAS)
    },
    inicioImediato: Boolean(c.INICIOIMEDIATO),
    respostas: c.respostas.map((item) => ({ pergunta: item.PERGUNTA, resposta: item.RESPOSTA }))
  };
}

/** Processo seletivo do lado da empresa: consultar a candidatura e avançar as etapas. */
@Injectable({ providedIn: 'root' })
export class CandidaturaService {
  private readonly http = inject(HttpClient);

  /** Só devolve a candidatura se a vaga for da empresa informada. */
  obter(id: number, idEmpresa: number): Observable<CandidaturaGestao> {
    const parametros = new HttpParams().set('idEmpresa', idEmpresa);

    return this.http
      .get<CandidaturaGestaoDaApi>(`${URL_BASE_API}/candidaturas/${id}`, { params: parametros })
      .pipe(map(paraCandidaturaGestao));
  }

  /** Avança a candidatura para a etapa da ação; devolve a candidatura já atualizada. */
  alterarEtapa(id: number, idEmpresa: number, acao: AcaoCandidatura): Observable<CandidaturaGestao> {
    return this.http
      .put<CandidaturaGestaoDaApi>(`${URL_BASE_API}/candidaturas/${id}/etapa`, { ...acao, idEmpresa })
      .pipe(map(paraCandidaturaGestao));
  }
}
