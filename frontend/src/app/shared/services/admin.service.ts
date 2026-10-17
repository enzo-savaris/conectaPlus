import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import {
  AcaoEmpresaAdmin,
  EmpresaAdmin,
  EmpresaAdminDetalhada,
  MembroEquipe,
  StatusEmpresaAdmin
} from '../types/admin';

interface EmpresaDaApi {
  IDEMPRESA: number;
  RAZAO: string;
  FANTASIA: string | null;
  CNPJ: string;
  EMAIL: string | null;
  TELEFONE: string | null;
  CEP: string | null;
  NUMERO: string | null;
  COMPLEMENTO: string | null;
  BAIRRO: string | null;
  CIDADE: string | null;
  ESTADO: string | null;
  DTCAD: string;
  DTALT: string | null;
  STATUSEMP: StatusEmpresaAdmin;
}

interface EmpresaDetalhadaDaApi extends EmpresaDaApi {
  historico: { STATUSANTERIOR: StatusEmpresaAdmin | null; STATUSNOVO: StatusEmpresaAdmin; MOTIVO: string | null; DTCAD: string; NOMEADMIN: string | null }[];
  TOTALVAGAS: number;
  TOTALCURSOS: number;
  semelhantes: { IDEMPRESA: number; RAZAO: string; CNPJ: string; STATUSEMP: StatusEmpresaAdmin }[];
}

interface MembroDaApi {
  IDADMIN: number;
  NOME: string;
  EMAIL: string;
  STATUSADM: 'ATIVO' | 'INATIVO';
  DTCAD: string;
  DTULTIMOACESSO: string | null;
  TOTALDECISOES: number;
}

function paraEmpresa(e: EmpresaDaApi): EmpresaAdmin {
  return {
    id: e.IDEMPRESA,
    razaoSocial: e.RAZAO,
    nomeFantasia: e.FANTASIA,
    cnpj: e.CNPJ,
    email: e.EMAIL,
    telefone: e.TELEFONE,
    cep: e.CEP,
    numero: e.NUMERO,
    complemento: e.COMPLEMENTO,
    bairro: e.BAIRRO,
    cidade: e.CIDADE,
    estado: e.ESTADO,
    dataCadastro: e.DTCAD,
    // O banco já preenche DTALT no cadastro; só conta como alteração se veio depois.
    dataAlteracao: e.DTALT && new Date(e.DTALT).getTime() - new Date(e.DTCAD).getTime() > 60_000 ? e.DTALT : null,
    status: e.STATUSEMP
  };
}

function paraEmpresaDetalhada(e: EmpresaDetalhadaDaApi): EmpresaAdminDetalhada {
  return {
    ...paraEmpresa(e),
    historico: e.historico.map((h) => ({
      statusAnterior: h.STATUSANTERIOR,
      statusNovo: h.STATUSNOVO,
      motivo: h.MOTIVO,
      data: h.DTCAD,
      nomeAdmin: h.NOMEADMIN
    })),
    totalVagas: e.TOTALVAGAS,
    totalCursos: e.TOTALCURSOS,
    semelhantes: e.semelhantes.map((s) => ({ id: s.IDEMPRESA, razaoSocial: s.RAZAO, cnpj: s.CNPJ, status: s.STATUSEMP }))
  };
}

function paraMembro(m: MembroDaApi): MembroEquipe {
  return {
    id: m.IDADMIN,
    nome: m.NOME,
    email: m.EMAIL,
    ativo: m.STATUSADM === 'ATIVO',
    dataCadastro: m.DTCAD,
    ultimoAcesso: m.DTULTIMOACESSO,
    totalDecisoes: Number(m.TOTALDECISOES)
  };
}

/** API do ambiente da equipe. O token vai sozinho, pelo tokenAdminInterceptor. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  listarEmpresas(
    status: StatusEmpresaAdmin,
    busca: string
  ): Observable<{ empresas: EmpresaAdmin[]; contagem: Record<StatusEmpresaAdmin, number> }> {
    const parametros = new HttpParams().set('status', status).set('busca', busca);

    return this.http
      .get<{ empresas: EmpresaDaApi[]; contagem: Record<StatusEmpresaAdmin, number> }>(`${URL_BASE_API}/admin/empresas`, {
        params: parametros
      })
      .pipe(map((resposta) => ({ empresas: resposta.empresas.map(paraEmpresa), contagem: resposta.contagem })));
  }

  obterEmpresa(id: number): Observable<EmpresaAdminDetalhada> {
    return this.http
      .get<EmpresaDetalhadaDaApi>(`${URL_BASE_API}/admin/empresas/${id}`)
      .pipe(map(paraEmpresaDetalhada));
  }

  decidir(id: number, acao: AcaoEmpresaAdmin, motivo: string): Observable<EmpresaAdminDetalhada> {
    return this.http
      .put<EmpresaDetalhadaDaApi>(`${URL_BASE_API}/admin/empresas/${id}/decisao`, { acao, motivo })
      .pipe(map(paraEmpresaDetalhada));
  }

  listarEquipe(): Observable<MembroEquipe[]> {
    return this.http.get<MembroDaApi[]>(`${URL_BASE_API}/admin/equipe`).pipe(map((lista) => lista.map(paraMembro)));
  }

  criarMembro(nome: string, email: string, senha: string): Observable<MembroEquipe[]> {
    return this.http
      .post<MembroDaApi[]>(`${URL_BASE_API}/admin/equipe`, { nome, email, senha })
      .pipe(map((lista) => lista.map(paraMembro)));
  }

  alterarStatusMembro(id: number, ativo: boolean): Observable<MembroEquipe[]> {
    return this.http
      .put<MembroDaApi[]>(`${URL_BASE_API}/admin/equipe/${id}/status`, { ativo })
      .pipe(map((lista) => lista.map(paraMembro)));
  }
}
