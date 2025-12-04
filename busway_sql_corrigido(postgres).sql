-- =============================================
-- ESQUEMA EM 3FN COM IDS AUTOMÁTICOS
-- =============================================

-- ============ TABELA USUARIO ============
CREATE TABLE IF NOT EXISTS Usuario (
  idUsuario SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  senha VARCHAR(60) NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  cidade VARCHAR(100),
  uf CHAR(2),
  planoAssinatura VARCHAR(45)
);

-- ============ GERENTE / NOTIFICAÇÕES / FEEDBACK ============
CREATE TABLE IF NOT EXISTS Gerente (
  idGerente SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS Notificacoes (
  idNotificacoes SERIAL PRIMARY KEY,
  tipoNotificacao VARCHAR(100) NOT NULL,
  descricao TEXT,
  usuarioEnviado INT NOT NULL REFERENCES Usuario (idUsuario)
);

CREATE TABLE IF NOT EXISTS Feedback (
  idFeedback SERIAL PRIMARY KEY,
  mediaEstrelasPorUsuario DECIMAL(3,2) CHECK (mediaEstrelasPorUsuario BETWEEN 0 AND 5),
  dicasEscritas TEXT,
  idUsuario INT NOT NULL REFERENCES Usuario (idUsuario),
  idGerente INT NOT NULL REFERENCES Gerente (idGerente)
);

-- ============ PARADAS / TRAJETOS / HORÁRIOS ============
CREATE TABLE IF NOT EXISTS Parada (
  idParada SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  numPessoasEmbarque INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS Trajeto (
  idTrajeto SERIAL PRIMARY KEY,
  tempoEstimado TIME,
  origem VARCHAR(100) NOT NULL,
  destino VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS Trajeto_Parada (
  idTrajeto INT NOT NULL REFERENCES Trajeto(idTrajeto),
  idParada INT NOT NULL REFERENCES Parada(idParada),
  ordem INT NOT NULL,
  PRIMARY KEY (idTrajeto, idParada),
  CONSTRAINT uk_traj_ordem UNIQUE (idTrajeto, ordem)
);

CREATE TABLE IF NOT EXISTS Horario (
  idHorario SERIAL PRIMARY KEY,
  idTrajeto INT NOT NULL REFERENCES Trajeto(idTrajeto),
  horaSaida TIME NOT NULL
);

-- ============ ÔNIBUS / MOTORISTAS ============
CREATE TABLE IF NOT EXISTS Onibus (
  idOnibus SERIAL PRIMARY KEY,
  modelo VARCHAR(100) NOT NULL,
  placa VARCHAR(10) UNIQUE NOT NULL,
  capacidadeMaxima INT NOT NULL CHECK (capacidadeMaxima > 0)
);

CREATE TABLE IF NOT EXISTS Onibus_Trajeto (
  idOnibus INT NOT NULL REFERENCES Onibus(idOnibus),
  idTrajeto INT NOT NULL REFERENCES Trajeto(idTrajeto),
  PRIMARY KEY (idOnibus, idTrajeto)
);

CREATE TABLE IF NOT EXISTS Motorista (
  idMotorista SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS Motorista_Onibus (
  idMotorista INT NOT NULL REFERENCES Motorista(idMotorista),
  idOnibus INT NOT NULL REFERENCES Onibus(idOnibus),
  PRIMARY KEY (idMotorista, idOnibus)
);

-- ============ VÍNCULOS DE USUÁRIO ============
CREATE TABLE IF NOT EXISTS Usuario_Parada (
  idUsuario INT NOT NULL REFERENCES Usuario(idUsuario),
  idParada INT NOT NULL REFERENCES Parada(idParada),
  PRIMARY KEY (idUsuario, idParada)
);

-- ============ VIAGEM ============
CREATE TABLE IF NOT EXISTS Viagem (
  idViagem SERIAL PRIMARY KEY,
  idUsuario INT NOT NULL REFERENCES Usuario(idUsuario),
  idHorario INT NOT NULL REFERENCES Horario(idHorario),
  idMotorista INT NOT NULL REFERENCES Motorista(idMotorista),
  idOnibus INT NOT NULL REFERENCES Onibus(idOnibus),
  dataViagem DATE NOT NULL
);

-- associativa: viagem pode ter vários trajetos
CREATE TABLE IF NOT EXISTS Viagem_Trajeto (
  idViagem INT NOT NULL REFERENCES Viagem(idViagem),
  idTrajeto INT NOT NULL REFERENCES Trajeto(idTrajeto),
  ordem INT NOT NULL,
  PRIMARY KEY (idViagem, idTrajeto)
);

-- ============ ANUNCIANTE / ANUNCIO ============
CREATE TABLE IF NOT EXISTS Anunciante (
  idAnunciante SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS Anuncio (
  idAnuncio SERIAL PRIMARY KEY,
  produto VARCHAR(100) NOT NULL,
  nivelAnuncio VARCHAR(50) NOT NULL,
  idAnunciante INT NOT NULL REFERENCES Anunciante(idAnunciante),
  idUsuario INT NOT NULL REFERENCES Usuario(idUsuario)
);

-- =============================================
-- ============ DADOS DE EXEMPLO
-- =============================================

-- USUÁRIOS
INSERT INTO Usuario (nome, email, senha, cpf, cidade, uf, planoAssinatura)
VALUES
('Alice Silva', 'alice@email.com', 'senha123', '123.456.789-00', 'São Paulo', 'SP', 'Premium'),
('Bruno Costa', 'bruno@email.com', '123456', '987.654.321-00', 'Rio de Janeiro', 'RJ', 'Básico'),
('Carla Mendes', 'carla@email.com', 'abc123', '456.789.123-99', 'Belo Horizonte', 'MG', 'Premium');

-- GERENTES
INSERT INTO Gerente (nome) VALUES
('Fernanda Gerente'),
('Carlos Lima'),
('Juliana Rocha');

-- NOTIFICAÇÕES
INSERT INTO Notificacoes (tipoNotificacao, descricao, usuarioEnviado)
VALUES
('Promoção', '50% de desconto no trajeto!', 1),
('Atualização', 'Seu ônibus está a caminho!', 2),
('Alerta', 'Parada temporariamente desativada.', 3);

-- FEEDBACKS
INSERT INTO Feedback (mediaEstrelasPorUsuario, dicasEscritas, idUsuario, idGerente)
VALUES
(4.5, 'Muito bom o trajeto, recomendo.', 1, 1),
(3.0, 'Viagem ok, mas pode melhorar a pontualidade.', 2, 2),
(5.0, 'Serviço excelente e muito confortável!', 3, 3);

-- PARADAS
INSERT INTO Parada (nome, latitude, longitude, numPessoasEmbarque)
VALUES
('Parada Central', -23.550520, -46.633308, 15),
('Parada Norte',  -22.906847, -43.172896, 8),
('Parada Leste',  -19.916681, -43.934493, 20);

-- TRAJETOS
INSERT INTO Trajeto (tempoEstimado, origem, destino)
VALUES
('01:30:00', 'Centro', 'Bairro A'),
('00:45:00', 'Bairro B', 'Centro'),
('02:00:00', 'Rodoviária', 'Zona Leste');

-- TRAJETO_PARADA
INSERT INTO Trajeto_Parada (idTrajeto, idParada, ordem) VALUES
(1, 1, 1),
(1, 2, 2),
(2, 3, 1);

-- HORÁRIOS
INSERT INTO Horario (idTrajeto, horaSaida)
VALUES
(1, '07:00:00'),
(2, '08:30:00'),
(3, '09:15:00');

-- ÔNIBUS
INSERT INTO Onibus (modelo, placa, capacidadeMaxima)
VALUES
('Mercedes-Benz 2020', 'ABC1D23', 50),
('Volvo 9500', 'XYZ2K98', 45),
('Scania Touring', 'DEF4G56', 60);

-- ONIBUS_TRAJETO
INSERT INTO Onibus_Trajeto (idOnibus, idTrajeto) VALUES
(1, 1),
(2, 2),
(3, 3);

-- MOTORISTAS
INSERT INTO Motorista (nome) VALUES
('José Motorista'),
('Ana Condutora'),
('Pedro Motorista');

-- MOTORISTA_ONIBUS
INSERT INTO Motorista_Onibus (idMotorista, idOnibus) VALUES
(1, 1),
(2, 2),
(3, 3);

-- USUARIO_PARADA
INSERT INTO Usuario_Parada (idUsuario, idParada) VALUES
(1, 1),
(2, 2),
(3, 3);

-- VIAGENS (sem trajeto direto, mas com motorista e ônibus)
INSERT INTO Viagem (idUsuario, idHorario, idMotorista, idOnibus, dataViagem)
VALUES
(1, 1, 1, 1, '2025-08-01'),
(2, 2, 2, 2, '2025-08-02'),
(3, 3, 3, 3, '2025-08-03');

-- VIAGEM_TRAJETO (uma viagem pode ter múltiplos trajetos)
INSERT INTO Viagem_Trajeto (idViagem, idTrajeto, ordem) VALUES
(1, 1, 1),
(1, 2, 2),
(2, 2, 1),
(3, 3, 1);

-- ANUNCIANTES
INSERT INTO Anunciante (nome) VALUES
('TechCorp'),
('EcoMobility'),
('FoodOnBus');

-- ANUNCIOS
INSERT INTO Anuncio (produto, nivelAnuncio, idAnunciante, idUsuario)
VALUES
('Smartphone X', 'Prata', 1, 1),
('Patinete Elétrico', 'Ouro', 2, 2),
('Snacks de Viagem', 'Bronze', 3, 3);
