import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import {
  Candidatura,
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
  TITULO: string;
  AREA: string | null;
  DESCRICAO: string;
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

/** GET /vagas/:id devolve, além das colunas da vaga, as listas de itens do cadastro. */
interface VagaDetalhadaDaApi extends VagaDaApi {
  responsabilidades: string[];
  requisitos: string[];
  acessibilidade: string[];
  beneficios: string[];
}

function paraVaga(vaga: VagaDaApi): Vaga {
  return {
    id: vaga.IDVAGA,
    idEmpresa: vaga.IDEMPRESA,
    titulo: vaga.TITULO,
    area: vaga.AREA,
    descricao: vaga.DESCRICAO,
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
    beneficios: vaga.beneficios
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
}

function paraCandidatura(candidatura: CandidaturaDaApi): Candidatura {
  return {
    id: candidatura.IDCANDIDATURA,
    idCandidato: candidatura.IDPCD,
    nome: candidatura.NOME,
    email: candidatura.EMAIL,
    sobreMim: candidatura.SOBREMIM,
    status: candidatura.STATUSCANDIDATURA,
    dataCandidatura: candidatura.DTCANDIDATURA
  };
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
  candidatar(idVaga: number, idPcd: number): Observable<void> {
    return this.http
      .post<unknown>(`${URL_BASE_API}/vagas/${idVaga}/candidaturas`, { idPcd })
      .pipe(map(() => undefined));
  }

  /** Lista as vagas em que o candidato logado já se candidatou, para marcar "Já candidatado" na lista. */
  listarMinhasCandidaturas(idPcd: number): Observable<MinhaCandidatura[]> {
    return this.http
      .get<MinhaCandidaturaDaApi[]>(`${URL_BASE_API}/usuarios/${idPcd}/candidaturas`)
      .pipe(map((candidaturas) => candidaturas.map(paraMinhaCandidatura)));
  }
}
