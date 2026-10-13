# Decisões Técnicas e Regras de Negócio

Desenvolvi este projeto de forma totalmente individual, sendo o único responsável por pensar a arquitetura, desenhar o banco de dados, implementar a segurança, construir as telas e aplicar as regras da legislação trabalhista. 

Este documento foi escrito de forma simples e direta para que qualquer pessoa, técnica ou não, consiga entender com clareza o motivo de cada escolha que fiz.

---

## O Desafio e as Necessidades do Sistema

O objetivo principal era construir um sistema de controle de ponto moderno para uma empresa com funcionários trabalhando no Brasil, em Portugal e na Espanha. 

Para que o projeto atendesse a realidade do negócio de forma eficiente, defini os seguintes pontos essenciais:

- Acesso individualizado: Telas e permissões separadas para colaboradores, gestores e profissionais de recursos humanos.
- Registro fácil e à prova de erros: O colaborador é guiado por um fluxo natural (Entrada, Pausa, Retorno e Saída) sem chance de errar a ordem das batidas.
- Presença com localização real: Registro da posição geográfica do colaborador no momento do ponto com alta precisão e sem coordenadas falsas.
- Fusos horários exatos: Tratamento matemático dos horários de São Paulo, Lisboa e Madri, garantindo que o total de horas trabalhadas seja sempre justo e correto.
- Cumprimento da lei trabalhista: Controle rigoroso do limite de 10 horas diárias da CLT, alerta de esquecimento de saída no dia anterior e fechamento seguro do mês pelo RH.
- Praticidade no uso diário: O sistema funciona com a mesma agilidade no celular ou no computador, carregando rápido e com visual agradável.

---

## Por que Decidi Usar o Supabase

Por estar desenvolvendo o projeto sozinho e com o prazo curto de um desafio técnico, minha prioridade foi aliar velocidade de entrega com confiabilidade de engenharia. Em vez de perder dias montando um servidor do zero, cuidando de rotas manuais e configurando banco de dados básico, escolhi o Supabase como intermediador de backend por três motivos claros:

1. Agilidade para estruturar o banco: O Supabase oferece um banco de dados relacional PostgreSQL completo. Consegui modelar as tabelas e relações de forma limpa, garantindo a persistência segura dos dados em tempo recorde.
2. Autenticação pronta e segura: O sistema de login já utiliza padrões consagrados de mercado, como criptografia de senhas com bcrypt e tokens seguros de sessão (JWT). Isso elimina vulnerabilidades comuns de sistemas de login feitos às pressas.
3. Intermediação de dados e regras de acesso: O Supabase atua diretamente no tratamento de dados e na aplicação das regras de segurança com alto desempenho, sem a necessidade de manter uma camada intermediária pesada.

---

## Por que Não Enviei Nada do Banco para o Repositório

O repositório do projeto no GitHub é público. Mesmo se tratando de um desafio técnico para avaliação, adotei uma postura séria de segurança desde o primeiro momento:

- Proteção da estrutura interna: Decidi não subir nenhum arquivo interno do Supabase, scripts de migração ou esquemas do banco para não expor a arquitetura do projeto publicamente na internet.
- Segurança garantida no próprio banco com RLS: Ativei a proteção de Row Level Security (segurança em nível de linha) em todas as tabelas no PostgreSQL. Isso significa que é o próprio banco de dados que valida quem está fazendo a requisição. Um colaborador só consegue ver e registrar seus próprios pontos, mesmo que alguém tenha acesso à chave pública da aplicação.
- Testes automatizados: Executei testes automáticos para confirmar que as permissões funcionam perfeitamente e que nenhuma conta consegue visualizar ou modificar dados de outros colaboradores.

---

## Como Funciona a Localização e o GPS

Para comprovar a presença física do colaborador, utilizei a API de geolocalização nativa do navegador (`navigator.geolocation`). Ajustei o funcionamento para resolver problemas comuns do dia a dia:

- Eliminação de coordenadas no mar: Em muitos navegadores, a primeira resposta de localização pode retornar zerada `(0, 0)`, apontando para o meio do oceano. Criei uma validação no sistema que descarta essas posições nulas ou marítimas e continua buscando o sinal terrestre real.
- Calibração de precisão até 20 metros: Em vez de capturar uma coordenada qualquer no primeiro segundo, o sistema mantém uma calibração ativa com os satélites de GPS até alcançar uma precisão real de até 20 metros de margem de erro.
- Conferência no Google Maps: O painel cria um link direto para o Google Maps com as coordenadas exatas da batida, permitindo que tanto o colaborador quanto o gestor confiram a rua e o local do ponto com apenas um clique.
- Resguardo da legislação: Se o colaborador estiver sem GPS ou recusar a permissão de localização, o sistema não trava a batida. Legalmente, a empresa não pode impedir o funcionário de registrar o trabalho que realizou. No entanto, o ponto é salvo com o aviso claro de "Localização Não Verificada", permitindo que o gestor e o RH façam a conferência administrativa necessária.

![Validação de Geolocalização e Google Maps](./docs/screenshots/desktop_geolocalizacao_calibracao.png)

---

## Regras de Negócio e Legislação Trabalhista

- Um único botão de ação: Para evitar que o colaborador dê dois cliques seguidos ou aperte o botão errado, a tela sempre mostra apenas uma ação em destaque (a próxima ação lógica do dia).
- Limite de 10 horas da CLT: O artigo 59 da CLT limita a jornada diária a no máximo 10 horas (8 horas normais mais 2 horas extras). Ao atingir 10 horas trabalhadas no dia, o sistema bloqueia novas pausas e exige o encerramento do expediente. Se por motivo de força maior a jornada ultrapassar esse limite, o ponto é destacado com alerta e exige a visualização de uma justificativa formal para auditoria.
- Alerta de esquecimento no dia anterior: Se o funcionário foi embora no dia anterior sem registrar a batida de saída, o sistema percebe a pendência e exibe um aviso de atenção na tela para que a situação seja regularizada com o gestor.
- Fusos horários unificados em UTC: Todas as batidas são gravadas no banco de dados na hora universal (UTC). Isso significa que o cálculo de tempo trabalhado é uma conta exata de milissegundos, imune a viagens ou horários de verão. Na tela, o colaborador vê as horas convertidas perfeitamente para o horário local da sua cidade (São Paulo, Lisboa ou Madri).
- Fechamento mensal pelo RH: Ao final do mês, o RH pode fechar o período no sistema. As batidas daquele mês ficam congeladas contra alterações, garantindo que os dados enviados para a folha de pagamento sejam confiáveis e definitivos.


