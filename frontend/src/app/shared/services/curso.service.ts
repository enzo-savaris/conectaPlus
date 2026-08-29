import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { Curso, NovoCurso, StatusCurso, TipoConteudoCurso } from '../types/curso';

/** Formato bruto devolvido pela API: colunas da TBLCDSCURSO0. */
interface CursoDaApi {
  IDCURSO: number;
  IDEMPRESA: number;
  TITULO: string;
  DESCRICAO: string | null;
  CARGAHORARIA: number | null;
  // O mysql2 devolve colunas DECIMAL como string, para não perder precisão.
  PRECO: string | null;
  TIPOCONTEUDO: TipoConteudoCurso;
  LINKCURSO: string | null;
  ARQUIVOCURSO: string | null;
  DTCAD: string;
  STATUSCURSO: StatusCurso;
}

function paraCurso(curso: CursoDaApi): Curso {
  return {
    id: curso.IDCURSO,
    idEmpresa: curso.IDEMPRESA,
    titulo: curso.TITULO,
    descricao: curso.DESCRICAO,
    cargaHoraria: curso.CARGAHORARIA,
    preco: curso.PRECO !== null ? Number(curso.PRECO) : null,
    tipoConteudo: curso.TIPOCONTEUDO,
    linkCurso: curso.LINKCURSO,
    arquivoCursoUrl: curso.ARQUIVOCURSO ? `${URL_BASE_API}/uploads/cursos/${curso.ARQUIVOCURSO}` : null,
    dataCadastro: curso.DTCAD,
    status: curso.STATUSCURSO
  };
}

/** Monta o multipart/form-data: o arquivo de vídeo só viaja assim, então usamos o mesmo formato pra tudo. */
function paraFormData(dados: NovoCurso, idEmpresa: number): FormData {
  const formData = new FormData();

  formData.append('idEmpresa', String(idEmpresa));
  formData.append('titulo', dados.titulo);
  formData.append('tipoConteudo', dados.tipoConteudo);

  if (dados.descricao) {
    formData.append('descricao', dados.descricao);
  }
  if (dados.cargaHoraria !== null) {
    formData.append('cargaHoraria', String(dados.cargaHoraria));
  }
  if (dados.preco !== null) {
    formData.append('preco', String(dados.preco));
  }
  if (dados.tipoConteudo === 'LINK' && dados.linkCurso) {
    formData.append('linkCurso', dados.linkCurso);
  }
  if (dados.tipoConteudo === 'ARQUIVO' && dados.arquivo) {
    formData.append('arquivo', dados.arquivo);
  }

  return formData;
}

@Injectable({ providedIn: 'root' })
export class CursoService {
  private readonly http = inject(HttpClient);

  listar(idEmpresa: number): Observable<Curso[]> {
    const parametros = new HttpParams().set('idEmpresa', idEmpresa);

    return this.http
      .get<CursoDaApi[]>(`${URL_BASE_API}/cursos`, { params: parametros })
      .pipe(map((cursos) => cursos.map(paraCurso)));
  }

  obterPorId(id: number): Observable<Curso> {
    return this.http.get<CursoDaApi>(`${URL_BASE_API}/cursos/${id}`).pipe(map(paraCurso));
  }

  cadastrar(dados: NovoCurso, idEmpresa: number): Observable<Curso> {
    return this.http
      .post<CursoDaApi>(`${URL_BASE_API}/cursos`, paraFormData(dados, idEmpresa))
      .pipe(map(paraCurso));
  }

  atualizar(id: number, dados: NovoCurso, idEmpresa: number): Observable<Curso> {
    return this.http
      .put<CursoDaApi>(`${URL_BASE_API}/cursos/${id}`, paraFormData(dados, idEmpresa))
      .pipe(map(paraCurso));
  }
}
