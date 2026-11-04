-- Relaciona uma vaga aos cursos que a própria empresa recomenda pra ela
-- (mostrados na página da vaga e escolhidos no cadastro/edição da vaga).
CREATE TABLE IF NOT EXISTS tblcdsvagcurso0 (
  IDVAGA INT NOT NULL,
  IDCURSO INT NOT NULL,
  PRIMARY KEY (IDVAGA, IDCURSO),
  CONSTRAINT FK_VAGACURSO_VAGA FOREIGN KEY (IDVAGA) REFERENCES tblcdsvag0 (IDVAGA) ON DELETE CASCADE,
  CONSTRAINT FK_VAGACURSO_CURSO FOREIGN KEY (IDCURSO) REFERENCES tblcdscurso0 (IDCURSO) ON DELETE CASCADE
);
