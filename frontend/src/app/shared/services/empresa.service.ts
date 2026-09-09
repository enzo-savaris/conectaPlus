import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { CandidatoRelacionado, TipoDeficiencia } from '../types/candidato';
import { AtualizarEmpresa, CadastrarEmpresa, Empresa, StatusEmpresa } from '../types/empresa';

/** Formato bruto devolvido pela API: colunas da TBLCDSEMP0. */
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
  STATUSEMP: StatusEmpresa;
}

/** Formato bruto devolvido pela API: GET /empresas/:id/candidatos. */
interface CandidatoDaApi {
  IDPCD: number;
  NOME: string;
  EMAIL: string | null;
  TELEFONE: string | null;
  SOBREMIM: string | null;
  TIPODEF: TipoDeficiencia;
  CIDADE: string | null;
  ESTADO: string | null;
}

function paraCandidato(candidato: CandidatoDaApi): CandidatoRelacionado {
  return {
    id: candidato.IDPCD,
    nome: candidato.NOME,
    email: candidato.EMAIL,
    telefone: candidato.TELEFONE,
    sobreMim: candidato.SOBREMIM,
    tipoDeficiencia: candidato.TIPODEF,
    cidade: candidato.CIDADE,
    estado: candidato.ESTADO
  };
}

function paraEmpresa(empresa: EmpresaDaApi): Empresa {
  return {
    id: empresa.IDEMPRESA,
    razaoSocial: empresa.RAZAO,
    nomeFantasia: empresa.FANTASIA,
    cnpj: empresa.CNPJ,
    email: empresa.EMAIL,
    telefone: empresa.TELEFONE,
    cep: empresa.CEP,
    numero: empresa.NUMERO,
    complemento: empresa.COMPLEMENTO,
    bairro: empresa.BAIRRO,
    cidade: empresa.CIDADE,
    estado: empresa.ESTADO,
    dataCadastro: empresa.DTCAD,
    dataAlteracao: empresa.DTALT,
    status: empresa.STATUSEMP
  };
}

@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly http = inject(HttpClient);

  obterPorId(id: number): Observable<Empresa> {
    return this.http.get<EmpresaDaApi>(`${URL_BASE_API}/empresas/${id}`).pipe(map(paraEmpresa));
  }

  cadastrar(dados: CadastrarEmpresa): Observable<Empresa> {
    return this.http
      .post<EmpresaDaApi>(`${URL_BASE_API}/empresas`, dados)
      .pipe(map(paraEmpresa));
  }

  atualizar(id: number, dados: AtualizarEmpresa): Observable<Empresa> {
    return this.http
      .put<EmpresaDaApi>(`${URL_BASE_API}/empresas/${id}`, dados)
      .pipe(map(paraEmpresa));
  }

  /** Candidatos PCD já inscritos em alguma vaga da empresa, sem repetir, não importa em qual. */
  listarCandidatos(idEmpresa: number): Observable<CandidatoRelacionado[]> {
    return this.http
      .get<CandidatoDaApi[]>(`${URL_BASE_API}/empresas/${idEmpresa}/candidatos`)
      .pipe(map((candidatos) => candidatos.map(paraCandidato)));
  }
}
