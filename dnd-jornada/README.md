# Dungeons & Dragons Group — Plataforma de Jornada de Trabalho

Plataforma corporativa moderna e segura para gerenciamento e auditoria da jornada de trabalho para a **D&D Group**, projetada para atender equipes distribuídas globalmente (Brasil e Europa), com suporte nativo a múltiplos fusos horários, governança de dados e conformidade legal.

---

## 🏗️ Arquitetura e Decisões Técnicas

### 1. Stack Tecnológico
- **Frontend:** Angular 19 (Standalone Components, Signals reativos, Vanilla CSS com Design System moderno, Dark Mode e Glassmorphism).
- **Backend & Camada de Dados:** Supabase (PostgreSQL relacional com Row Level Security, Auth BaaS).
- **Segurança e Privacidade:** O repositório público não expõe credenciais, schemas de banco ou migrations proprietárias. A aplicação utiliza injeção de configurações desacoplada via `src/environments/environment.example.ts`.

### 2. Tratamento Multidimensional de Fuso Horário (Timezones)
Colaboradores atuam remotamente e realizam viagens internacionais com frequência (ex.: Brasil, Portugal, Espanha).
- **Tempo Absoluto UTC:** Todos os registros de eventos (`CLOCK_IN`, `BREAK_START`, `BREAK_END`, `CLOCK_OUT`) são persistidos com precisão estrita em `timestamp_utc` (`timestamptz`).
- **Contexto Local Preservado:** Cada evento armazena simultaneamente o identificador IANA do fuso do colaborador (`timezone_id`, ex: `America/Sao_Paulo`, `Europe/Lisbon`, `Europe/Madrid`) e o deslocamento em minutos (`timezone_offset`).
- **Visualização Contextualizada:** O colaborador, seu gestor e o RH visualizam as batidas convertidas tanto para o horário local da localidade de trabalho quanto para UTC, viabilizando cálculos exatos de horas trabalhadas e auditoria fiscal fidedigna.

### 3. Regras de Negócio e Conformidade
- **Máquina de Estados de Ponto:** Transição estrita e unidirecional via botão contextual único:
  `Entrada (CLOCK_IN)` ➔ `Início de Pausa (BREAK_START)` ➔ `Retorno de Pausa (BREAK_END)` ➔ `Encerramento (CLOCK_OUT)`.
- **Janela de Expediente:** Bloqueio e orientação contextual para registros fora do horário de trabalho contratual (Segunda a Sexta, 09:00 às 17:00).
- **Teto Legal Diário (CLT - 10 Horas):** Alerta em tempo real e bloqueio preventivo para impedir que o colaborador ultrapasse o limite legal diário de 10 horas trabalhadas.
- **Fechamento Mensal de Período:** O RH possui controle exclusivo para congelar o período fiscal do mês, garantindo a imutabilidade jurídica dos registros.
- **Trilha de Auditoria e Ajustes Manuais:** Registros de ponto nunca sofrem exclusão física. Alterações excepcionais exigem justificativa obrigatória e são rastreadas.

---

## 👥 Perfis de Acesso e Funcionalidades

| Perfil | Rota | Principais Capacidades |
| :--- | :--- | :--- |
| **Colaborador** | `/dashboard` | Botão contextual inteligente de marcação, progresso diário de horas, alerta de sobrecarga e quadro semanal com detecção de fuso e ajustes. |
| **Gestor** | `/gestor` | Acompanhamento da equipe sob sua gestão, KPIs consolidados, detecção de horas extras (>10h) e visualização de colaboradores em fusos internacionais. |
| **RH / Admin** | `/rh` | Consolidação geral da folha, supervisão de conformidade da empresa, auditoria detalhada de registros e congelamento/fechamento contábil mensal. |

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Node.js** (v18+ recomendado)
- **NPM**

### Instalação e Execução
1. Clone o repositório:
   ```bash
   git clone https://github.com/gppacheco/dnd-jornada.git
   cd dnd-jornada/web
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   - Duplique o arquivo de exemplo:
     ```bash
     cp src/environments/environment.example.ts src/environments/environment.ts
     ```
   - Preencha com a URL do seu projeto Supabase e a Chave Pública Anon.

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm start
   ```
   A aplicação estará disponível em `http://localhost:4200`.

---

## 🔐 Usuários de Demonstração (Ambiente de Testes)

Para testes locais e homologação das regras de negócio, as seguintes credenciais padrão podem ser utilizadas:

- **Colaborador (Brasil):** `colaborador@dndgroup.com` / `password123`
- **Colaboradora (Portugal):** `maria.lisboa@dndgroup.com` / `password123`
- **Colaborador (Espanha):** `carlos.madrid@dndgroup.com` / `password123`
- **Gestor:** `gestor@dndgroup.com` / `password123`
- **Recursos Humanos:** `rh@dndgroup.com` / `password123`
