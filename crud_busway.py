import psycopg2
from psycopg2 import Error

# Configuração da conexão
conn = psycopg2.connect(
    host="localhost",
    port="5432",
    database="busway",
    user="arthur",
    password="190309"
)
cursor = conn.cursor()

# ======================== FUNÇÕES AUXILIARES =========================
def verificar_id_existe(tabela, coluna_id, id_valor):
    """Verifica se um ID existe na tabela"""
    try:
        cursor.execute(f"SELECT 1 FROM {tabela} WHERE {coluna_id} = %s", (id_valor,))
        return cursor.fetchone() is not None
    except Error as e:
        print(f"Erro ao verificar ID: {e}")
        return False

# ======================== USUARIO =========================
def criar_usuario():
    try:
        nome = input("Nome: ").strip()
        email = input("Email: ").strip()
        senha = input("Senha: ").strip()
        cpf = input("CPF: ").strip()
        cidade = input("Cidade: ").strip()
        uf = input("UF: ").strip()
        
        if not all([nome, email, senha, cpf, cidade, uf]):
            print("Todos os campos são obrigatórios!")
            return
            
        cursor.execute(
            "INSERT INTO Usuario (nome, email, senha, cpf, cidade, uf) VALUES (%s, %s, %s, %s, %s, %s) RETURNING idUsuario", 
            (nome, email, senha, cpf, cidade, uf)
        )
        id_usuario = cursor.fetchone()[0]
        conn.commit()
        print(f"Usuário criado com sucesso! ID: {id_usuario}")
        
    except Error as e:
        print(f"Erro ao criar usuário: {e}")
        conn.rollback()

def listar_usuarios():
    try:
        cursor.execute("SELECT idUsuario, nome, email, cpf, cidade, uf FROM Usuario ORDER BY idUsuario")
        usuarios = cursor.fetchall()
        
        if not usuarios:
            print("Nenhum usuário encontrado.")
            return
            
        print("\n=== LISTA DE USUÁRIOS ===")
        print(f"{'ID':<5} {'Nome':<20} {'Email':<25} {'CPF':<15} {'Cidade':<15} {'UF':<3}")
        print("-" * 90)
        
        for usuario in usuarios:
            print(f"{usuario[0]:<5} {usuario[1]:<20} {usuario[2]:<25} {usuario[3]:<15} {usuario[4]:<15} {usuario[5]:<3}")
            
    except Error as e:
        print(f"Erro ao listar usuários: {e}")

def editar_usuario():
    try:
        listar_usuarios()
        id_usuario = int(input("\nID do usuário a editar: "))
        
        if not verificar_id_existe("Usuario", "idUsuario", id_usuario):
            print("Usuário não encontrado!")
            return
            
        # Buscar dados atuais
        cursor.execute("SELECT nome, email, senha, cpf, cidade, uf FROM Usuario WHERE idUsuario = %s", (id_usuario,))
        dados_atuais = cursor.fetchone()
        
        print("\nDados atuais (pressione Enter para manter):")
        print(f"Nome atual: {dados_atuais[0]}")
        novo_nome = input("Novo nome: ").strip() or dados_atuais[0]
        
        print(f"Email atual: {dados_atuais[1]}")
        novo_email = input("Novo email: ").strip() or dados_atuais[1]
        
        print(f"CPF atual: {dados_atuais[3]}")
        novo_cpf = input("Novo CPF: ").strip() or dados_atuais[3]
        
        print(f"Cidade atual: {dados_atuais[4]}")
        nova_cidade = input("Nova cidade: ").strip() or dados_atuais[4]
        
        print(f"UF atual: {dados_atuais[5]}")
        nova_uf = input("Nova UF: ").strip() or dados_atuais[5]
        
        # Pergunta sobre senha
        alterar_senha = input("Deseja alterar a senha? (s/n): ").lower() == 's'
        nova_senha = input("Nova senha: ").strip() if alterar_senha else dados_atuais[2]
        
        cursor.execute(
            "UPDATE Usuario SET nome = %s, email = %s, senha = %s, cpf = %s, cidade = %s, uf = %s WHERE idUsuario = %s",
            (novo_nome, novo_email, nova_senha, novo_cpf, nova_cidade, nova_uf, id_usuario)
        )
        conn.commit()
        print("Usuário atualizado com sucesso!")
        
    except (ValueError, Error) as e:
        print(f"Erro ao editar usuário: {e}")
        conn.rollback()

def remover_usuario():
    try:
        listar_usuarios()
        id_usuario = int(input("\nID do usuário a remover: "))
        
        if not verificar_id_existe("Usuario", "idUsuario", id_usuario):
            print("Usuário não encontrado!")
            return
            
        confirmacao = input(f"Tem certeza que deseja remover o usuário ID {id_usuario}? (s/n): ")
        if confirmacao.lower() == 's':
            cursor.execute("DELETE FROM Usuario WHERE idUsuario = %s", (id_usuario,))
            conn.commit()
            print("Usuário removido com sucesso!")
        else:
            print("Operação cancelada.")
            
    except (ValueError, Error) as e:
        print(f"Erro ao remover usuário: {e}")
        conn.rollback()

# ===================== MENU PRINCIPAL =====================
def menu():
    print("=== SISTEMA CRUD BUSWAY ===")
    print("Conectado ao banco de dados com sucesso!")
    
    while True:
        try:
            print("\n" + "="*50)
            print("           MENU PRINCIPAL")
            print("="*50)
            print("USUÁRIOS:")
            print("1  - Criar usuário")
            print("2  - Listar usuários")
            print("3  - Editar usuário")
            print("4  - Remover usuário")
            print("0  - Sair")
            print("="*50)
            
            opcao = input("Escolha uma opção: ").strip()

            if opcao == "1": criar_usuario()
            elif opcao == "2": listar_usuarios()
            elif opcao == "3": editar_usuario()
            elif opcao == "4": remover_usuario()
            elif opcao == "0":
                print("\nEncerrando sistema...")
                confirmacao = input("Tem certeza? (s/n): ")
                if confirmacao.lower() == 's':
                    break
            else:
                print("❌ Opção inválida! Tente novamente.")
                
        except KeyboardInterrupt:
            print("\n\nSistema interrompido pelo usuário.")
            break
        except Exception as e:
            print(f"Erro inesperado: {e}")

    # Fechar conexões
    try:
        cursor.close()
        conn.close()
        print("✅ Conexão com banco de dados encerrada com sucesso.")
    except:
        print("⚠️  Erro ao fechar conexão com banco de dados.")
    
# Executar o programa principal
if __name__ == "__main__":
    try:
        menu()
    except Error as e:
        print(f"Erro de conexão com banco de dados: {e}")
    except Exception as e:
        print(f"Erro crítico: {e}")