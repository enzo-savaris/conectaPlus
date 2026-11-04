-- Cidades cadastradas no sistema. Antes, CIDADE/ESTADO eram texto livre
-- direto na tblcdsvag0; agora toda vaga aponta pra uma cidade cadastrada
-- aqui (IDCIDADE), pra normalizar o dado.
CREATE TABLE IF NOT EXISTS tblcdscid0 (
  IDCIDADE INT NOT NULL AUTO_INCREMENT,
  NOME VARCHAR(100) NOT NULL,
  ESTADO CHAR(2) NOT NULL,
  PRIMARY KEY (IDCIDADE),
  CONSTRAINT UQ_CIDADE UNIQUE (NOME, ESTADO)
);

ALTER TABLE tblcdsvag0 ADD COLUMN IDCIDADE INT NULL AFTER ESTADO;

-- Migra as cidades já digitadas nas vagas existentes pra tblcdscid0, sem duplicar.
INSERT IGNORE INTO tblcdscid0 (NOME, ESTADO)
SELECT DISTINCT CIDADE, ESTADO FROM tblcdsvag0 WHERE CIDADE IS NOT NULL AND ESTADO IS NOT NULL;

UPDATE tblcdsvag0 v
INNER JOIN tblcdscid0 c ON c.NOME = v.CIDADE AND c.ESTADO = v.ESTADO
SET v.IDCIDADE = c.IDCIDADE;

ALTER TABLE tblcdsvag0
  DROP COLUMN CIDADE,
  DROP COLUMN ESTADO,
  ADD CONSTRAINT FK_VAGA_CIDADE FOREIGN KEY (IDCIDADE) REFERENCES tblcdscid0 (IDCIDADE);
