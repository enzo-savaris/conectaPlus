-- Preço e conteúdo do curso: a empresa escolhe cadastrar com um link externo
-- OU anexando um vídeo/arquivo — TIPOCONTEUDO diz qual das duas colunas ler.
ALTER TABLE TBLCDSCURSO0
  ADD COLUMN PRECO DECIMAL(10,2) NULL,
  ADD COLUMN TIPOCONTEUDO ENUM('LINK','ARQUIVO') NOT NULL DEFAULT 'LINK',
  ADD COLUMN LINKCURSO VARCHAR(500) NULL,
  ADD COLUMN ARQUIVOCURSO VARCHAR(255) NULL;
