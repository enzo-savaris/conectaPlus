-- Cadastro do candidato PCD: a TBLCDSUSR0 já existia (login já a usa), mas
-- faltava um jeito de se cadastrar. Aqui só entra o que o cadastro precisa:
-- uma foto de perfil opcional, e duas listas de múltipla escolha que não
-- cabem numa coluna só — recursos de acessibilidade que o candidato usa no
-- dia a dia e áreas de interesse profissional. Seguem o mesmo padrão das
-- tabelas filhas da vaga (uma linha de texto por item, apagadas e regravadas
-- inteiras a cada edição).

ALTER TABLE TBLCDSUSR0
  ADD COLUMN AVATAR VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS TBLCDSPCDREC0 (
  IDRECURSO INT NOT NULL AUTO_INCREMENT,
  IDPCD INT NOT NULL,
  DESCRICAO VARCHAR(100) NOT NULL,
  PRIMARY KEY (IDRECURSO),
  CONSTRAINT FK_PCDREC_PCD FOREIGN KEY (IDPCD) REFERENCES TBLCDSUSR0 (IDPCD) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS TBLCDSPCDINT0 (
  IDINTERESSE INT NOT NULL AUTO_INCREMENT,
  IDPCD INT NOT NULL,
  DESCRICAO VARCHAR(100) NOT NULL,
  PRIMARY KEY (IDINTERESSE),
  CONSTRAINT FK_PCDINT_PCD FOREIGN KEY (IDPCD) REFERENCES TBLCDSUSR0 (IDPCD) ON DELETE CASCADE
);
