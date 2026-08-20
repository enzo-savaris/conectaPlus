-- Tabela de cursos cadastrados pelas empresas (cursos recomendados aos candidatos).
-- A tela de gestão de cursos ainda não existe; por enquanto os registros
-- precisam ser inseridos manualmente até o formulário ser criado.
CREATE TABLE IF NOT EXISTS TBLCDSCURSO0 (
  IDCURSO INT NOT NULL AUTO_INCREMENT,
  IDEMPRESA INT NOT NULL,
  TITULO VARCHAR(150) NOT NULL,
  DESCRICAO TEXT NULL,
  CARGAHORARIA INT NULL,
  DTCAD DATETIME DEFAULT CURRENT_TIMESTAMP,
  STATUSCURSO ENUM('ATIVO','INATIVO') DEFAULT 'ATIVO',
  PRIMARY KEY (IDCURSO),
  CONSTRAINT FK_CURSO_EMPRESA FOREIGN KEY (IDEMPRESA) REFERENCES TBLCDSEMP0 (IDEMPRESA) ON DELETE CASCADE
);
