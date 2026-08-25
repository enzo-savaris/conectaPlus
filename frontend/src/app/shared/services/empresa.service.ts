import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { AtualizarEmpresa, Empresa, StatusEmpresa } from '../types/empresa';

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

  atualizar(id: number, dados: AtualizarEmpresa): Observable<Empresa> {
    return this.http
      .put<EmpresaDaApi>(`${URL_BASE_API}/empresas/${id}`, dados)
      .pipe(map(paraEmpresa));
  }
}
