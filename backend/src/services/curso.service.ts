import fs from 'node:fs/promises';
import path from 'node:path';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { PASTA_UPLOADS_CURSOS } from '../config/upload.ts';
import pool from '../config/dataBase.ts';
import { garantirEmpresaAtiva } from './empresa.service.ts';
import { erroDeValidacao, erroNaoEncontrado } from '../utils/erro-app.ts';
import type { DadosCurso } from '../utils/validacao-curso.ts';

/**
 * Junta com TBLCDSEMP0 pra devolver também o nome da empresa (NOMEEMPRESA) já
 * pronto — a busca de cursos disponíveis, aberta ao candidato PCD, mostra
 * quem oferece cada curso, igual a busca de vagas já faz com NOMEEMPRESA.
 */
const COLUNAS = `c.IDCURSO, c.IDEMPRESA, c.TITULO, c.DESCRICAO, c.CARGAHORARIA, c.PRECO,
                 c.DTCAD, c.STATUSCURSO,
                 COALESCE(emp.FANTASIA, emp.RAZAO) AS NOMEEMPRESA`;
const TABELA_COM_EMPRESA = `TBLCDSCURSO0 c LEFT JOIN TBLCDSEMP0 emp ON emp.IDEMPRESA = c.IDEMPRESA`;

/**
 * Lista os cursos cadastrados, dos mais recentes para os mais antigos (sem os
 * módulos/capítulos — só o resumo usado nas telas de lista).
 * Com `idEmpresa`, traz só os cursos daquela empresa (tela de gestão). Com
 * `status`, filtra pelo status (a busca aberta ao candidato PCD usa
 * ?status=ATIVO, pra não mostrar cursos desativados de nenhuma empresa).
 */
export async function listar(idEmpresa?: number, status?: string): Promise<RowDataPacket[]> {
  const condicoes: string[] = [];
  const parametros: (number | string)[] = [];

  if (idEmpresa !== undefined) {
    condicoes.push('c.IDEMPRESA = ?');
    parametros.push(idEmpresa);
  }

  if (status !== undefined) {
    condicoes.push('c.STATUSCURSO = ?');
    parametros.push(status);
  }

  const filtro = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';

  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM ${TABELA_COM_EMPRESA} ${filtro} ORDER BY c.DTCAD DESC`,
    parametros
  );

  return linhas;
}

export async function buscarPorId(id: number): Promise<RowDataPacket | null> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM ${TABELA_COM_EMPRESA} WHERE c.IDCURSO = ?`,
    [id]
  );

  return linhas[0] ?? null;
}

async function obterPorId(id: number): Promise<RowDataPacket> {
  const curso = await buscarPorId(id);

  if (curso === null) {
    throw erroNaoEncontrado('Curso não encontrado.');
  }

  return curso;
}

/** Capítulos de um módulo, na ordem em que foram cadastrados. */
async function listarCapitulos(idModulo: number): Promise<RowDataPacket[]> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT IDCAPITULO, TITULO, DESCRICAO, TIPOCONTEUDO, LINKCAPITULO, ARQUIVOCAPITULO, MATERIAL
     FROM TBLCDSCURSOCAP0 WHERE IDMODULO = ? ORDER BY IDCAPITULO`,
    [idModulo]
  );

  return linhas;
}

/** Módulos do curso (com seus capítulos aninhados), na ordem em que foram cadastrados. */
async function listarModulos(idCurso: number): Promise<RowDataPacket[]> {
  const [modulos] = await pool.query<RowDataPacket[]>(
    'SELECT IDMODULO, TITULO FROM TBLCDSCURSOMOD0 WHERE IDCURSO = ? ORDER BY IDMODULO',
    [idCurso]
  );

  const comCapitulos = await Promise.all(
    modulos.map(async (modulo) => ({
      ...modulo,
      capitulos: await listarCapitulos(modulo['IDMODULO'] as number)
    }))
  );

  return comCapitulos;
}

/** Curso com os módulos e capítulos, usado na tela de detalhes (candidato) e na edição (empresa). */
export async function obterDetalhado(id: number): Promise<Record<string, unknown>> {
  const curso = await obterPorId(id);
  const modulos = await listarModulos(id);

  return { ...curso, modulos };
}

async function removerArquivo(nomeArquivo: string | null): Promise<void> {
  if (!nomeArquivo) {
    return;
  }

  try {
    await fs.unlink(path.join(PASTA_UPLOADS_CURSOS, nomeArquivo));
  } catch {
    // Já pode ter sido removido manualmente; não é motivo pra falhar a operação.
  }
}

/**
 * Grava os módulos e capítulos do curso. `arquivosPorChave` traz os arquivos
 * recém-enviados, indexados por `modulo_<i>_capitulo_<j>` (conteúdo principal,
 * só quando ARQUIVO) e `material_modulo_<i>_capitulo_<j>` (material de apoio,
 * opcional, qualquer tipo de conteúdo) — convenção combinada com o
 * controller, que monta o mapa a partir do `fieldname` de cada arquivo do
 * multer.
 */
async function inserirModulos(
  conexao: PoolConnection,
  idCurso: number,
  modulos: DadosCurso['modulos'],
  arquivosPorChave: Map<string, string>
): Promise<void> {
  for (let indiceModulo = 0; indiceModulo < modulos.length; indiceModulo++) {
    const modulo = modulos[indiceModulo]!;

    const [resultadoModulo] = await conexao.execute<ResultSetHeader>(
      'INSERT INTO TBLCDSCURSOMOD0 (IDCURSO, TITULO) VALUES (?, ?)',
      [idCurso, modulo.titulo]
    );
    const idModulo = resultadoModulo.insertId;

    for (let indiceCapitulo = 0; indiceCapitulo < modulo.capitulos.length; indiceCapitulo++) {
      const capitulo = modulo.capitulos[indiceCapitulo]!;
      const chave = `modulo_${indiceModulo}_capitulo_${indiceCapitulo}`;
      const chaveMaterial = `material_${chave}`;

      const arquivoNovo = arquivosPorChave.get(chave) ?? null;
      const arquivoFinal = capitulo.tipoConteudo === 'ARQUIVO' ? (arquivoNovo ?? capitulo.arquivoAtual) : null;

      const materialNovo = arquivosPorChave.get(chaveMaterial) ?? null;
      const materialFinal = materialNovo ?? capitulo.materialAtual;

      if (capitulo.tipoConteudo === 'ARQUIVO' && !arquivoFinal) {
        throw erroDeValidacao({
          [`modulos[${indiceModulo}].capitulos[${indiceCapitulo}].arquivo`]:
            'Anexe um vídeo ou troque a aula para um link.'
        });
      }

      await conexao.execute(
        `INSERT INTO TBLCDSCURSOCAP0 (IDMODULO, TITULO, DESCRICAO, TIPOCONTEUDO, LINKCAPITULO, ARQUIVOCAPITULO, MATERIAL)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          idModulo,
          capitulo.titulo,
          capitulo.descricao,
          capitulo.tipoConteudo,
          capitulo.tipoConteudo === 'LINK' ? capitulo.linkCapitulo : null,
          arquivoFinal,
          materialFinal
        ]
      );
    }
  }
}

export async function cadastrar(
  dados: DadosCurso,
  idEmpresa: number,
  arquivosPorChave: Map<string, string>
): Promise<Record<string, unknown>> {
  await garantirEmpresaAtiva(idEmpresa);

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const [resultado] = await conexao.execute<ResultSetHeader>(
      `INSERT INTO TBLCDSCURSO0 (IDEMPRESA, TITULO, DESCRICAO, CARGAHORARIA, PRECO)
       VALUES (?, ?, ?, ?, ?)`,
      [idEmpresa, dados.titulo, dados.descricao, dados.cargaHoraria, dados.preco]
    );
    const idCurso = resultado.insertId;

    await inserirModulos(conexao, idCurso, dados.modulos, arquivosPorChave);

    await conexao.commit();

    return await obterDetalhado(idCurso);
  } catch (erro) {
    await conexao.rollback();
    // Os arquivos já enviados pro disco nesta tentativa não têm mais curso que os referencie.
    for (const nomeArquivo of arquivosPorChave.values()) {
      await removerArquivo(nomeArquivo);
    }
    throw erro;
  } finally {
    conexao.release();
  }
}

/**
 * Atualiza o curso, só se ele pertencer à empresa informada. Módulos e
 * capítulos são regravados do zero a cada edição (mesmo padrão usado pelas
 * listas de itens da vaga): mais simples que tentar casar cada item editado
 * com a linha existente, e o custo é desprezível pro tamanho desses dados.
 *
 * Os vídeos dos capítulos que não mudaram são mantidos (via `arquivoAtual`);
 * os que saíram de uso — capítulo removido, ou trocado por um vídeo novo ou
 * por um link — são apagados do disco só depois do commit, pra nunca deixar
 * a edição inteira falhar por causa de um arquivo que não pôde ser removido.
 */
export async function atualizar(
  id: number,
  dados: DadosCurso,
  idEmpresa: number,
  arquivosPorChave: Map<string, string>
): Promise<Record<string, unknown>> {
  await garantirEmpresaAtiva(idEmpresa);

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.query<RowDataPacket[]>(
      'SELECT IDCURSO FROM TBLCDSCURSO0 WHERE IDCURSO = ? AND IDEMPRESA = ? FOR UPDATE',
      [id, idEmpresa]
    );

    if (linhas.length === 0) {
      throw erroNaoEncontrado('Curso não encontrado.');
    }

    const [modulosAntigos] = await conexao.query<RowDataPacket[]>(
      'SELECT IDMODULO FROM TBLCDSCURSOMOD0 WHERE IDCURSO = ?',
      [id]
    );
    const idsModulosAntigos = modulosAntigos.map((linha) => linha['IDMODULO'] as number);

    const arquivosAntigos = new Set<string>();
    if (idsModulosAntigos.length > 0) {
      const [capitulosAntigos] = await conexao.query<RowDataPacket[]>(
        `SELECT ARQUIVOCAPITULO, MATERIAL FROM TBLCDSCURSOCAP0 WHERE IDMODULO IN (${idsModulosAntigos.map(() => '?').join(',')})`,
        idsModulosAntigos
      );
      for (const linha of capitulosAntigos) {
        const arquivo = linha['ARQUIVOCAPITULO'] as string | null;
        const material = linha['MATERIAL'] as string | null;
        if (arquivo) {
          arquivosAntigos.add(arquivo);
        }
        if (material) {
          arquivosAntigos.add(material);
        }
      }
    }

    await conexao.execute(
      `UPDATE TBLCDSCURSO0 SET TITULO = ?, DESCRICAO = ?, CARGAHORARIA = ?, PRECO = ? WHERE IDCURSO = ?`,
      [dados.titulo, dados.descricao, dados.cargaHoraria, dados.preco, id]
    );

    // TBLCDSCURSOCAP0 vai junto por ON DELETE CASCADE.
    await conexao.query('DELETE FROM TBLCDSCURSOMOD0 WHERE IDCURSO = ?', [id]);
    await inserirModulos(conexao, id, dados.modulos, arquivosPorChave);

    await conexao.commit();

    const arquivosEmUso = new Set<string>();
    for (const modulo of dados.modulos) {
      for (const capitulo of modulo.capitulos) {
        if (capitulo.arquivoAtual) {
          arquivosEmUso.add(capitulo.arquivoAtual);
        }
        if (capitulo.materialAtual) {
          arquivosEmUso.add(capitulo.materialAtual);
        }
      }
    }
    for (const arquivoNovo of arquivosPorChave.values()) {
      arquivosEmUso.add(arquivoNovo);
    }

    for (const arquivoAntigo of arquivosAntigos) {
      if (!arquivosEmUso.has(arquivoAntigo)) {
        await removerArquivo(arquivoAntigo);
      }
    }

    return await obterDetalhado(id);
  } catch (erro) {
    await conexao.rollback();
    for (const nomeArquivo of arquivosPorChave.values()) {
      await removerArquivo(nomeArquivo);
    }
    throw erro;
  } finally {
    conexao.release();
  }
}
