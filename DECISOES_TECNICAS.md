# 🏛️ Documentação de Decisões Técnicas, Arquitetura & Regras de Negócio

Este documento detalha as decisões de engenharia, requisitos funcionais e não-funcionais, modelagem e regras de conformidade trabalhista implementadas na plataforma **D&D Jornada**.

---

## 1. Justificativa da Escolha do Supabase

### 1.1. Velocidade de Desenvolvimento em Desafio Técnico
Por se tratar de um desafio técnico com prazo enxuto e escopo abrangente (envolvendo múltiplos perfis de usuários, fusos horários distintos e regras CLT), a **velocidade de entrega sem perda de qualidade** foi o principal direcionador arquitetural:
- **BaaS (Backend-as-a-Service) Enterprise:** A escolha do Supabase evitou a criação manual de boilerplate repetitivo (servidores HTTP em Node/NestJS, rotas CRUD, ORMs e controle manual de tokens de sessão).
- **Autenticação Padrão e Segura:** Utilização nativa do **Supabase Auth**, implementando emissão e renovação de tokens JWT assinados, hash seguro de senhas com algoritmo `bcrypt` e gerenciamento robusto de sessão.
- **Foco no Domínio do Problema:** O tempo economizado na infraestrutura de backend foi 100% canalizado para o que realmente gera valor: experiência do usuário impecável (Single-Action UX), precisão de fusos horários, cálculo em UTC absoluto, conformidade trabalhista e acessibilidade.

---

## 2. Decisão de Segurança: Ocultação do Banco de Dados no Repositório Público

O repositório do projeto no GitHub é público. Por este motivo, foi adotada a seguinte diretriz de segurança defensiva:

### 2.1. Ocultação Estrita da Pasta e Artefatos do Supabase
- **Não declaração no repositório:** A pasta `supabase/`, os scripts de migração (`migrations/`), os arquivos DDL (`schema.sql`) e credenciais de serviço foram **estritamente ignorados via `.gitignore`**.
- **Mitigação de Riscos de Engenharia Reversa:** A não exposição do schema evita que atores externos mapeiem a topologia de tabelas, nomes de colunas, índices e funções internas (`SECURITY DEFINER`) do banco de dados.
- **Chave de Serviço Protegida:** A chave administrativa `service_role` nunca é enviada ao repositório nem injetada no bundle do frontend Angular, prevenindo acesso não autorizado com privilégios de superusuário.

### 2.2. Row Level Security (RLS) Ativo no PostgreSQL
A segurança do sistema **não depende de sigilo no cliente (Security through Obscurity)**, mas de políticas declarativas implementadas diretamente no PostgreSQL:
- **Isolamento por Colaborador:** Políticas de RLS garantem que consultas `SELECT`, `INSERT` ou `UPDATE` realizadas com o token do usuário filtrem automaticamente `user_id = auth.uid()`. Mesmo inspecionando a chave `anon public` no navegador, nenhum colaborador consegue visualizar pontos alheios.
- **Privilégios Hierárquicos:**
  - **Gestor:** Visualiza apenas colaboradores cujo campo `manager_id` seja correspondente ao seu `auth.uid()`.
  - **RH (Admin):** Possui permissão de visualização e fechamento contábil global validada via função `is_hr()`.
- **Proteção Contra Adulteração:** Regras RLS impedem a alteração de pontos já computados em períodos com status `CLOSED`.

---

## 3. Requisitos e Regras de Negócio Implementadas

Para garantir que o sistema funcione de forma robusta e sem falhas operacionais ou jurídicas, foram projetadas as seguintes regras de negócio:

### 3.1. Máquina de Estados Finita e UX de Botão Único (Single-Action UX)
Para eliminar erros comuns de duplo clique ou batidas em ordem invertida, o fluxo diário é controlado por uma máquina de estados finita:
$$\text{Sem Batidas} \xrightarrow{\text{CLOCK\_IN}} \text{Trabalhando} \xrightarrow{\text{BREAK\_START}} \text{Em Pausa} \xrightarrow{\text{BREAK\_END}} \text{Trabalhando} \xrightarrow{\text{CLOCK\_OUT}} \text{Jornada Encerrada}$$
- O colaborador visualiza **um único botão de ação dinâmico**, cujo texto, cor e ícone correspondem estritamente ao próximo passo permitido.
- Não é possível bater "Saída" antes da "Entrada", nem registrar novo intervalo se a jornada já foi finalizada.

---

### 3.2. Limite Diário de 10 Horas (Art. 59 da CLT) & Justificativa Obrigatória
- **Jornada Padrão:** 8 horas diárias de trabalho.
- **Teto Máximo Legal:** 10 horas diárias (8h normais + 2h extras permitidas por lei).
- **Comportamento do Sistema ao Atingir 10 Horas:**
  1. A barra de progresso diária muda para estado de alerta (`fill-danger`).
  2. Novas entradas ou pausas são **bloqueadas**. O sistema habilita exclusivamente a ação de **Encerrar Jornada (`CLOCK_OUT`)**.
  3. Ao registrar um ponto onde a jornada diária extrapolou 10 horas (como a batida do dia 06/10 com 10h30min em Madri), o sistema exige o registro de uma **justificativa formal**.
  4. O registro é marcado com a tag visual `⚠️ >10h 🔍`, permitindo que o Colaborador, o Gestor e o RH abram um modal de auditoria para visualizar a motivação do excesso de jornada.

---

### 3.3. Geolocalização com Precisão Real (GPS) e Tratamento de Recusa
A aplicação solicita acesso à API de Geolocalização do navegador (`navigator.geolocation`) com alta precisão (`enableHighAccuracy: true`):
- **Coleta de Coordenadas:** Captura latitude, longitude e margem de erro em metros (`accuracy`) no momento do registro.
- **O que acontece se o colaborador NÃO ativar ou recusar o GPS?**
  - **Direito Trabalhista Preservado:** O sistema **não bloqueia** o registro do ponto. Impedir a batida por falta de GPS constituiria ilícito trabalhista, pois privaria o trabalhador de comprovar suas horas trabalhadas.
  - **Sinalização de Auditoria:** O ponto é gravado com sucesso, porém o sistema emite um aviso no painel e marca a ocorrência como **"Localização Não Verificada (GPS Desativado)"**.
  - **Visibilidade para Liderança e RH:** O Gestor e o RH recebem a indicação de que o ponto foi batido sem validação de coordenadas geográficas, permitindo averiguação em casos de trabalho presencial obrigatório.

---

### 3.4. Detecção de Inconsistências de Jornada (Batidas Ímpares)
- Se em um dia útil anterior o colaborador registrou a entrada mas esqueceu de registrar a saída (ou não retornou do intervalo), o sistema detecta a **batida ímpar**.
- Um alerta em destaque é exibido no topo do painel:
  > *"Atenção: Inconsistência identificada: encerramento (saída) não registrado no dia anterior. Regularize com seu gestor."*
- Isso impede que o colaborador acumule dias com cálculo distorcido sem prévia homologação gerencial.

---

### 3.5. Operação Multi-Fuso Horário com Base UTC Central
A empresa conta com colaboradores simultaneamente no **Brasil** (`America/Sao_Paulo`, UTC-3), **Portugal** (`Europe/Lisbon`, UTC+1) e **Espanha** (`Europe/Madrid`, UTC+2):
- **Armazenamento em UTC:** Todas as batidas são persistidas em UTC absoluto (`timestamp_utc`).
- **Cálculo Imune a Mudanças de Fuso:** A duração da jornada diária calcula a diferença em milissegundos absolutos transcorridos.
  - *Exemplo de Viagem Internacional:* Se o colaborador inicia a jornada em Lisboa e encerra o dia após desembarcar em São Paulo, o sistema computa as horas reais trabalhadas sem distorções causadas pela alteração do relógio do dispositivo.
- **Exibição Contextualizada:** O gestor e o RH conseguem visualizar tanto o horário no fuso de origem do registro quanto a conversão em UTC para efeito de auditoria comparativa.

---

### 3.6. Fechamento de Folha e Imutabilidade (Portaria 671 do MTE)
- **Congelamento Mensal:** O administrador de RH possui um módulo dedicado para "Fechar Período Mensal".
- Ao fechar o período (como o mês de Outubro/2026), o registro correspondente na tabela `closing_periods` recebe o status `CLOSED`.
- Qualquer tentativa de alteração manual, inserção ou exclusão de batida referente a um período fechado é rejeitada pelas regras de segurança RLS do PostgreSQL, garantindo integridade e validade jurídica para exportação contábil.

---

### 3.7. Auditoria de Alterações (`audit_logs`)
- Toda alteração ou ajuste manual homologado gera um registro imutável na tabela `audit_logs`, contendo:
  - ID da batida afetada (`time_entry_id`);
  - Usuário responsável pela alteração (`changed_by`);
  - Estado anterior e novo estado (JSONB);
  - Carimbo temporal inviolável (`created_at`).

---

## 4. Resumo das Regras de Negócio e Tratativas

| Regra / Cenário | Comportamento do Sistema | Base Legal / Decisão Técnica |
| :--- | :--- | :--- |
| **Ponto dentro do expediente (09:00 - 17:00)** | Ação permitida normalmente com botão dinâmico. | Acordo de Horário Flexível. |
| **Colaborador atinge 10h trabalhadas** | Bloqueia novas entradas/pausas; permite apenas `CLOCK_OUT`. | Art. 59 da CLT (Limite máximo diário). |
| **Jornada ultrapassa 10h** | Exige justificativa formal; gera tag `⚠️ >10h 🔍` com modal. | Compliance Trabalhista. |
| **Colaborador recusa permissão de GPS** | Registra o ponto com flag de "Localização não verificada". | Proteção do direito de registro do trabalhador. |
| **Colaborador esquece de bater a saída** | Detecta batida ímpar e emite banner de inconsistência. | Prevenção de passivo trabalhista. |
| **Colaborador em trânsito internacional** | Horas calculadas por diferença de milissegundos em UTC. | Arquitetura distribuída resiliente a fusos. |
| **Período mensal fechado pelo RH** | Pontos tornam-se somente-leitura; RLS rejeita alterações. | Portaria 671 MTE / Fechamento Contábil. |

---

*Documento elaborado como referência técnica e arquitetural da plataforma D&D Jornada.*
