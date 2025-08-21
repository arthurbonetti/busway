-- 1. Definir o schema no início (opcional)
-- CREATE SCHEMA IF NOT EXISTS busway;
-- SET search_path TO busway;

-- OU trabalhar com o schema público (recomendado para simplicidade)
-- SET search_path TO public;

-- =============================================
-- CRIAÇÃO DAS TABELAS COM AUTO INCREMENT
-- =============================================

-- Tabela Usuario
CREATE TABLE IF NOT EXISTS Usuario (
  idUsuario SERIAL PRIMARY KEY,  -- Usando SERIAL em vez de INT + SEQUENCE manual
  nome VARCHAR(100),
  email VARCHAR(100),
  senha VARCHAR(50),
  cpf VARCHAR(14),
  cidade VARCHAR(100),
  uf VARCHAR(2)
);

-- Tabela Perfil
CREATE TABLE IF NOT EXISTS Perfil (
  idPerfil SERIAL PRIMARY KEY,
  idUsuario INT UNIQUE NOT NULL,
  trajetosFavoritos TEXT,
  historicoViagens TEXT,
  planoAssinatura VARCHAR(45),
  CONSTRAINT fk_Perfil_Usuario FOREIGN KEY (idUsuario)
    REFERENCES Usuario (idUsuario)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

-- Tabela Notificacoes
CREATE TABLE IF NOT EXISTS Notificacoes (
  idNotificacoes SERIAL PRIMARY KEY,
  tipoNotificacao VARCHAR(100),
  descricao TEXT,
  usuarioEnviado INT,
  CONSTRAINT fk_Notificacoes_Usuario FOREIGN KEY (usuarioEnviado)
    REFERENCES Usuario (idUsuario)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_usuarioEnviado ON Notificacoes (usuarioEnviado);

-- Tabela Gerente
CREATE TABLE IF NOT EXISTS Gerente (
  idGerente SERIAL PRIMARY KEY,
  nome VARCHAR(100)
);

-- Tabela Anunciante
CREATE TABLE IF NOT EXISTS Anunciante (
  idAnunciante SERIAL PRIMARY KEY,
  nome VARCHAR(100)
);

-- Tabela Feedback
CREATE TABLE IF NOT EXISTS Feedback (
  idFeedback SERIAL PRIMARY KEY,
  mediaEstrelasPorUsuario DECIMAL(3,2),
  dicasEscritas TEXT,
  idUsuario INT,
  idGerente INT,
  CONSTRAINT fk_Feedback_Usuario FOREIGN KEY (idUsuario)
    REFERENCES Usuario (idUsuario)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT fk_Feedback_Gerente FOREIGN KEY (idGerente)
    REFERENCES Gerente (idGerente)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_idUsuario_Feedback ON Feedback (idUsuario);
CREATE INDEX IF NOT EXISTS idx_idGerente_Feedback ON Feedback (idGerente);

-- Tabela Trajeto
CREATE TABLE IF NOT EXISTS Trajeto (
  idTrajeto SERIAL PRIMARY KEY,
  tempoEstimado TIME,
  origem VARCHAR(100),
  paradas TEXT
);

-- Tabela Onibus
CREATE TABLE IF NOT EXISTS Onibus (
  idOnibus SERIAL PRIMARY KEY,
  modelo VARCHAR(100),
  placa VARCHAR(10),
  idTrajeto INT,
  CONSTRAINT fk_Onibus_Trajeto FOREIGN KEY (idTrajeto)
    REFERENCES Trajeto (idTrajeto)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_idTrajeto_Onibus ON Onibus (idTrajeto);

-- Tabela Motorista
CREATE TABLE IF NOT EXISTS Motorista (
  idMotorista SERIAL PRIMARY KEY,
  nome VARCHAR(100),
  idOnibus INT,
  CONSTRAINT fk_Motorista_Onibus FOREIGN KEY (idOnibus)
    REFERENCES Onibus (idOnibus)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_idOnibus_Motorista ON Motorista (idOnibus);

-- Tabela Anuncios
CREATE TABLE IF NOT EXISTS Anuncios (
  idAnuncios SERIAL PRIMARY KEY,
  nomeAnunciante VARCHAR(100),
  produto VARCHAR(100),
  nivelAnuncio VARCHAR(50),
  idAnunciante INT,
  idPerfil INT,
  CONSTRAINT fk_Anuncios_Anunciante FOREIGN KEY (idAnunciante)
    REFERENCES Anunciante (idAnunciante)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT fk_Anuncios_Perfil FOREIGN KEY (idPerfil)
    REFERENCES Perfil (idPerfil)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_idAnunciante_Anuncios ON Anuncios (idAnunciante);
CREATE INDEX IF NOT EXISTS idx_idPerfil_Anuncios ON Anuncios (idPerfil);

-- Tabela Usuario_Trajeto (tabela de relacionamento)
CREATE TABLE IF NOT EXISTS Usuario_Trajeto (
  idUsuario INT NOT NULL,
  idTrajeto INT NOT NULL,
  PRIMARY KEY (idUsuario, idTrajeto),
  CONSTRAINT fk_UT_Usuario FOREIGN KEY (idUsuario)
    REFERENCES Usuario (idUsuario)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT fk_UT_Trajeto FOREIGN KEY (idTrajeto)
    REFERENCES Trajeto (idTrajeto)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_idTrajeto_Usuario_Trajeto ON Usuario_Trajeto (idTrajeto);

-- =============================================
-- INSERÇÃO DE DADOS DE TESTE
-- =============================================

-- Limpar dados existentes (opcional - apenas para testes)
-- TRUNCATE TABLE Usuario_Trajeto, Anuncios, Motorista, Onibus, Trajeto, 
-- Feedback, Notificacoes, Perfil, Usuario, Gerente, Anunciante RESTART IDENTITY CASCADE;

-- Inserção de usuários
INSERT INTO Usuario (nome, email, senha, cpf, cidade, uf) VALUES
('Alice Silva', 'alice@email.com', 'senha123', '123.456.789-00', 'São Paulo', 'SP'),
('Bruno Costa', 'bruno@email.com', '123456', '987.654.321-00', 'Rio de Janeiro', 'RJ'),
('Carla Mendes', 'carla@email.com', 'abc123', '456.789.123-99', 'Belo Horizonte', 'MG');

-- Inserção de gerentes
INSERT INTO Gerente (nome) VALUES
('Fernanda Gerente'),
('Carlos Lima'),
('Juliana Rocha');

-- Inserção de anunciantes
INSERT INTO Anunciante (nome) VALUES
('TechCorp'),
('EcoMobility'),
('FoodOnBus');

-- Inserção de trajetos
INSERT INTO Trajeto (tempoEstimado, origem, paradas) VALUES
('01:30:00', 'Centro - Bairro A', 'Parada 1; Parada 2'),
('00:45:00', 'Bairro B - Centro', 'Parada 3; Parada 4'),
('02:00:00', 'Rodoviária - Zona Leste', 'Parada 5; Parada 6; Parada 7');

-- Inserção de perfis (após usuários)
INSERT INTO Perfil (idUsuario, trajetosFavoritos, historicoViagens, planoAssinatura) VALUES
(1, 'Trajeto A;Trajeto B', 'Viagem X;Viagem Y', 'Premium'),
(2, 'Trajeto C', 'Viagem Z', 'Básico'),
(3, 'Trajeto A;Trajeto D', 'Viagem X;Viagem W', 'Premium');

-- Inserção de notificações
INSERT INTO Notificacoes (tipoNotificacao, descricao, usuarioEnviado) VALUES
('Promoção', '50% de desconto no trajeto!', 1),
('Atualização', 'Seu ônibus está a caminho!', 2),
('Alerta', 'Parada temporariamente desativada.', 3);

-- Inserção de feedbacks
INSERT INTO Feedback (mediaEstrelasPorUsuario, dicasEscritas, idUsuario, idGerente) VALUES
(4.5, 'Muito bom o trajeto, recomendo.', 1, 1),
(3.0, 'Viagem ok, mas pode melhorar a pontualidade.', 2, 2),
(5.0, 'Serviço excelente e muito confortável!', 3, 3);

-- Inserção de ônibus
INSERT INTO Onibus (modelo, placa, idTrajeto) VALUES
('Mercedes-Benz 2020', 'ABC1D23', 1),
('Volvo 9500', 'XYZ2K98', 2),
('Scania Touring', 'DEF4G56', 3);

-- Inserção de motoristas
INSERT INTO Motorista (nome, idOnibus) VALUES
('José Motorista', 1),
('Ana Condutora', 2),
('Pedro Motorista', 3);

-- Inserção de anúncios
INSERT INTO Anuncios (nomeAnunciante, produto, nivelAnuncio, idAnunciante, idPerfil) VALUES
('TechCorp', 'Smartphone X', 'Prata', 1, 1),
('EcoMobility', 'Patinete Elétrico', 'Ouro', 2, 2),
('FoodOnBus', 'Snacks Viagem', 'Bronze', 3, 3);

-- Inserção de relacionamentos usuario-trajeto
INSERT INTO Usuario_Trajeto (idUsuario, idTrajeto) VALUES
(1, 1),
(2, 2),
(3, 3),
(1, 2);