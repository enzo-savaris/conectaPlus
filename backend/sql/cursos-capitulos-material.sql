-- Cada aula ganha uma descrição (opcional) e um material de apoio — um
-- arquivo à parte do conteúdo principal da aula (ex.: slides em PDF para
-- complementar um vídeo ou link).
ALTER TABLE TBLCDSCURSOCAP0
  ADD COLUMN DESCRICAO TEXT NULL,
  ADD COLUMN MATERIAL VARCHAR(255) NULL;
