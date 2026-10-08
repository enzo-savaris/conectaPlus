import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import {
  CapituloCurso,
  Curso,
  CursoDetalhado,
  ModuloCurso,
  NovoCurso,
  StatusCurso,
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
  capitulos: CapituloDaApi[];
}

interface CursoDetalhadoDaApi extends CursoDaApi {
  modulos: ModuloDaApi[];
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
    status: curso.STATUSCURSO
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
    capitulos: modulo.capitulos.map(paraCapitulo)
  };
}

function paraCursoDetalhado(curso: CursoDetalhadoDaApi): CursoDetalhado {
  return { ...paraCurso(curso), modulos: curso.modulos.map(paraModulo) };
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

  const modulosParaJson = dados.modulos.map((modulo) => ({
    titulo: modulo.titulo,
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

  /** Curso com os módulos e capítulos — usado na tela de detalhes e para preencher a edição. */
  obterPorId(id: number): Observable<CursoDetalhado> {
    return this.http.get<CursoDetalhadoDaApi>(`${URL_BASE_API}/cursos/${id}`).pipe(map(paraCursoDetalhado));
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
