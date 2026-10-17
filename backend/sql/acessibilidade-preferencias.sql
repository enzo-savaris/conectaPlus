-- Preferências de acessibilidade por conta: cada candidato PCD e cada
-- empresa guarda as suas (contraste, lupa, leitor de texto...), e elas
-- acompanham a pessoa em qualquer computador. Quem não está logado usa só
-- preferências de "visitante", guardadas no próprio navegador.
--
-- Uma linha por conta: exatamente um entre IDPCD e IDEMPRESA é preenchido.
-- As opções ficam num JSON (nome do recurso -> ligado/desligado), assim
-- uma opção nova no painel não exige mudar a tabela.

USE `conecta+`;

CREATE TABLE IF NOT EXISTS TBLCDSPREFACS0 (
  IDPREFERENCIA INT NOT NULL AUTO_INCREMENT,
  IDPCD INT NULL,
  IDEMPRESA INT NULL,
  PREFERENCIAS JSON NOT NULL,
  DTATUALIZACAO DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (IDPREFERENCIA),
  CONSTRAINT UQ_PREFACS_PCD UNIQUE (IDPCD),
  CONSTRAINT UQ_PREFACS_EMPRESA UNIQUE (IDEMPRESA),
  CONSTRAINT FK_PREFACS_PCD FOREIGN KEY (IDPCD) REFERENCES TBLCDSUSR0 (IDPCD) ON DELETE CASCADE,
  CONSTRAINT FK_PREFACS_EMPRESA FOREIGN KEY (IDEMPRESA) REFERENCES TBLCDSEMP0 (IDEMPRESA) ON DELETE CASCADE,
  CONSTRAINT CK_PREFACS_DONO CHECK ((IDPCD IS NULL) <> (IDEMPRESA IS NULL))
);
