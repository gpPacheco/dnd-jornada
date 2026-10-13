# Decisões Técnicas e Regras de Negócio

Este documento explica de forma simples e direta as escolhas de engenharia e as regras que pensei para que o sistema funcione redondo.

---

## 1. Por que o Supabase?

Por se tratar de um desafio técnico, pensei em agilidade, para que em vez de gastar muito tempo configurando servidor Node, rotas manuais, criptografia de senha e banco do zero, tomamos a decisão prática de usar o **Supabase como nosso intermediador de backend (BaaS)**:

- **Velocidade de entrega:** O Supabase já entrega um banco de dados **PostgreSQL**, e atualizações em tempo real (Realtime).

- **Autenticação:** o sistema de login nativo do Supabase gera tokens JWT modernos, criptografa as senhas com `bcrypt` e cuida de toda a segurança da sessão.

---

## 2. Por que não enviei arquivos do Supabase para o GitHub?

O repositório no GitHub é **público**. Por isso, tomei a decisão de segurança de **não subir nenhuma pasta do Supabase (`supabase/`), nenhum schema, script de migração** para o Git para:

- **Não expor como o banco foi arquitetado**
- **Segurança com RLS (Row Level Security)**
  Com o **RLS ativado em todas as tabelas**, o próprio banco só devolve para o colaborador os pontos que pertencem a ele (`auth.uid()`). 
  Mesmo que alguém tenha a chave pública do frontend, é o PostgreSQL quem barra qualquer tentativa de espionar ou alterar dados de outros usuários.

---

## 3. Regras de Negócio

### Um botão só: para evitar que o colaborador bata o ponto errado
- O colaborador olha para a tela e vê **apenas um botão principal**.
- O botão só oferece o próximo passo lógico:
  1. Primeiro clique: **"Registrar Entrada"**;
  2. Depois: **"Iniciar Intervalo"**;
  3. Depois: **"Retornar do Intervalo"**;
  4. Por fim: **"Encerrar Jornada"**.

---

### A solicitação de GPS: e o que acontece se o colaborador não ligar?
O sistema pede a permissão de localização do celular ou computador (`navigator.geolocation`) com precisão real em metros no momento de registrar o ponto.

**E se o colaborador recusar ou estiver sem GPS?**
- **O que NÃO fazemos:** Nós **não travamos** o registro do ponto. Legalmente, a empresa não pode impedir o trabalhador de registrar que trabalhou só porque o GPS falhou ou foi desligado (isso geraria um processo trabalhista grave).
- **O que o sistema faz:** O ponto é registrado com sucesso para proteger o trabalhador, mas o sistema salva a ocorrência com um alerta explícito: **"Localização Não Verificada (GPS Desativado)"**.
- **Resultado:** O colaborador consegue registrar suas horas, mas o gestor e o RH ficam sabendo na hora que aquele ponto não teve comprovação geográfica, podendo cobrar explicações se a função exigia presença física na empresa.

---

### Limite de 10 horas diárias (Art. 59 da CLT)
Pela CLT, a jornada normal é de 8 horas e o limite máximo permitido com horas extras é de 10 horas por dia. O sistema trata isso com firmeza:
- **Ao bater 10 horas trabalhadas:** A tela avisa que o limite legal foi atingido e **bloqueia novas pausas ou reaberturas de expediente**. A única opção que sobra é **"Encerrar Jornada"**.
- **Jornadas com mais de 10 horas (ex: o ponto de 10h30min em Madri):** Se por algum motivo excepcional de trabalho o colaborador ultrapassar as 10 horas, o sistema marca a batida com um alerta chamativo `⚠️ >10h 🔍`.
- **Visualização da Justificativa:** Ao clicar nesse aviso, abre-se um modal detalhado tanto para o Colaborador, quanto para o Gestor e para o RH, mostrando a justificativa formal cadastrada para respaldar a empresa numa auditoria trabalhista.

---

### E se o colaborador esquecer de bater a saída no dia anterior?
Se no dia anterior o colaborador bateu a entrada mas foi embora sem bater a saída (a famosa *batida ímpar*):
- O sistema percebe automaticamente a pendência e coloca um banner de alerta no topo do painel:
  > *"⚠️ Atenção: Inconsistência identificada: encerramento (saída) não registrado no dia anterior. Regularize com seu gestor."*
- Isso evita que o colaborador passe dias com horas acumuladas de forma irreal.

---

### Fusos Horários
A empresa tem pessoas no Brasil (`UTC-3`), em Portugal (`UTC+1`) e na Espanha (`UTC+2`).
- Se salvar o horário local direto no banco, quando um colaborador viajasse de Lisboa para São Paulo a contagem de horas ficaria completamente maluca.
- **Solução:** Todas as batidas são gravadas no banco em **UTC absoluto** (a hora universal neutra).
- Quando o sistema calcula quanto tempo o colaborador trabalhou, ele calcula os milissegundos reais que se passaram no mundo. Não importa se o relógio do celular adiantou ou atrasou por causa de viagem ou horário de verão: a conta de horas trabalhadas é 100% matemática e exata.

---

### Fechamento do mês pelo RH: passado não se altera
Quando o mês acaba (como Outubro/2026), o RH acessa o painel e clica em **"Fechar Período"**:
- O mês ganha o status de `CLOSED` no banco de dados.
- A partir desse segundo, as regras de segurança (RLS) impedem qualquer alteração em pontos daquele mês. Ninguém consegue editar ou fraudar batidas antigas, garantindo que a folha de pagamento enviada para a contabilidade seja intocável.

---

## 4. Em resumo

O sistema foi desenhado para ser **amigável para quem usa todos os dias**, **justo com o colaborador** (sem bloqueá-lo injustamente) e **blindado para a empresa** (com auditoria, regras da CLT e segurança no banco).
