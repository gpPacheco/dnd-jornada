# D&D Jornada — Controle de Ponto Inteligente

Sistema de controle de ponto eletrônico desenvolvido para empresas com equipes distribuídas entre o **Brasil** e a **Europa**. 
 
---

## 🌐 Acesso Online (Deploy na Vercel)

A aplicação está pronta para ser testada diretamente pelo navegador, sem necessidade de instalar nada localmente:

 **[Acesse a Aplicação na Vercel](https://dnd-jornada.vercel.app)**

---

## Demonstração Visual (Prints do Sistema)

### Versão Desktop (Painel do Colaborador, Gestor e RH)

<!-- Adicione o print da tela do computador aqui -->
> *[Cole aqui o print da tela Desktop: `![Demonstração Desktop](link_ou_caminho_da_imagem)`]*

---

### Versão Mobile (Aplicativo para Celular)

<!-- Adicione o print da tela do celular aqui -->
> *[Cole aqui o print da tela Mobile: `![Demonstração Mobile](link_ou_caminho_da_imagem)`]*

---

## Contas de Acesso para Testes

O banco de dados já possui contas configuradas para testar todos os cenários da aplicação. Todas utilizam a mesma senha: `password123`.

| Perfil | E-mail | Senha | O que você pode ver / testar |
| :--- | :--- | :--- | :--- |
| **Colaborador Brasil (João)** | `colaborador@dndgroup.com` | `password123` | Bater ponto no fuso de São Paulo (UTC-3), ver horas e justificativas. |
| **Colaboradora Lisboa (Maria)** | `colaborador2@dndgroup.com` | `password123` | Bater ponto no fuso de Lisboa (UTC+1) com conversão automática. |
| **Colaborador Madri (Carlos)** | `colaborador3@dndgroup.com` | `password123` | Ponto no fuso de Madri (UTC+2) e visualização de horas extras. |
| **Gestor (Silva)** | `gestor@dndgroup.com` | `password123` | Visão geral da equipe, alertas de jornadas >10h e análise de fusos. |
| **RH / Admin** | `rh@dndgroup.com` | `password123` | Auditoria completa de todas as batidas e fechamento mensal. |

---

## Decisões Técnicas e Regras de Negócio

**[Acesse o documento de Decisões Técnicas (DECISOES_TECNICAS.md)](DECISOES_TECNICAS.md)**

---

## 🚀 Como Rodar o Projeto Localmente

Se quiser rodar o projeto na sua máquina de desenvolvimento:

### 1. Clonar e entrar na pasta do frontend
```bash
git clone https://github.com/gppacheco/dnd-jornada.git
cd dnd-jornada/dnd-jornada/web  # ou acesse a pasta web do projeto
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Configurar as variáveis de ambiente
Crie seu arquivo `environment.ts` a partir do exemplo:
```bash
cp src/environments/environment.example.ts src/environments/environment.ts
```
*(Preencha a URL e a chave pública Anon do seu projeto Supabase no arquivo `src/environments/environment.ts`)*

### 4. Iniciar a aplicação
```bash
npm start
```
Abra no navegador em: **[http://localhost:4200](http://localhost:4200)**

---

## Como Rodar no Celular (Download do APK / PWA)

### 1. Acesso Direto pelo Navegador do Celular (PWA)
Você não precisa gerar o APK para testar agora:
1. Abra o link do deploy da Vercel ou o IP da sua máquina no navegador do celular (ex: Chrome ou Safari).
2. Toque no botão de menu do navegador e selecione **"Adicionar à tela de início"**.
3. O ícone do app aparecerá na tela do seu celular, abrindo em tela cheia com acesso ao GPS exatamente como um app nativo.

---

## Tecnologias Usadas

- **Frontend:** Angular 19 (com Signals para reatividade fluida e componentes modernos)
- **Estilos:** CSS3 limpo e responsivo com tema escuro e glassmorphism
- **Banco de Dados & Autenticação:** Supabase (PostgreSQL 15 com Row-Level Security e autenticação JWT)
- **Geolocalização:** Web Geolocation API nativa com alta precisão
