# Decisoes Tecnicas, Regras de Negocio e Arquitetura

Este documento descreve as escolhas tecnicas, os requisitos e as regras de negocio que adotei na construcao do sistema. Como desenvolvi este projeto de forma individual, fui o responsavel por todas as etapas: desde a concepcao da arquitetura e modelagem do banco ate a construcao da interface, integracao de sensores e cumprimento das normas trabalhistas.

---

## 1. Contexto do Projeto

O objetivo foi criar uma solucao robusta e intuitiva de controle de ponto para uma empresa com operacoes simultaneas no Brasil, em Portugal e na Espanha. O foco principal foi unir conformidade legal estrita (CLT), precisao matematica no calculo de horas trabalhadas em diferentes fusos e uma experiencia de uso simples para os colaboradores no dia a dia.

---

## 2. Requisitos do Sistema

### 2.1. Requisitos Funcionais (RF)

- RF01 - Autenticacao com controle de perfis: Acesso individualizado para Colaborador, Gestor e RH, com contas exclusivas para cada usuario.
- RF02 - Registro sequencial de ponto: Fluxo guiado em ordem logica (Entrada, Inicio de Intervalo, Retorno de Intervalo e Encerramento da Jornada).
- RF03 - Captura de geolocalizacao: Registro das coordenadas geograficas com precisao real no momento exato de cada batida.
- RF04 - Gestao de fusos horarios: Suporte nativo aos fusos de Sao Paulo (UTC-3), Lisboa (UTC+1) e Madri (UTC+2), com conversao automatica na interface.
- RF05 - Controle do limite de 10 horas diarias: Bloqueio de novas pausas ao atingir o limite legal da CLT e exigencia de justificativa para jornadas que ultrapassem essa marca.
- RF06 - Identificacao de inconsistencias (Batida Impar): Alerta visual imediato caso o colaborador nao tenha registrado a saida no dia anterior.
- RF07 - Painel do Gestor: Visualizacao consolidada da equipe, monitoramento de ocorrencias e auditoria de jornadas acima de 10 horas.
- RF08 - Painel do RH: Relatorio geral de auditoria e acao de fechamento mensal de folha.

### 2.2. Requisitos Nao-Funcionais (RNF)

- RNF01 - Seguranca e isolamento de dados: Politicas de Row Level Security (RLS) aplicadas diretamente no banco para garantir que colaboradores so acessem seus proprios dados.
- RNF02 - Precisao geografica: Calibracao ativa do sensor de GPS com alvo de precisao real de ate 20 metros e descarte de coordenadas nulas ou falsas.
- RNF03 - Responsividade e suporte a dispositivos moveis: Interface pensada para uso fluido em smartphones (PWA ou APK) e em navegadores desktop.
- RNF04 - Desempenho e reatividade: Uso do Angular 19 com Signals para atualizacao instantanea de contadores e regras de interface sem renderizacoes desnecessarias.
- RNF05 - Imutabilidade historica: Periodos mensais fechados pelo RH tornam-se somente leitura, impedindo alteracoes posteriores.

---

## 3. Por que escolhi o Supabase?

Por estar desenvolvendo o projeto sozinho e dentro do prazo de um desafio tecnico, precisei tomar decisoes que aliassem qualidade de engenharia e velocidade de entrega. Escolhi o Supabase como intermediador de backend (BaaS) pelos seguintes motivos:

- Agilidade na modelagem e persistencia: O Supabase fornece um banco relacional PostgreSQL completo. Isso me permitiu estruturar schemas limpos, tipos consistentes e relacoes fortes em pouco tempo.
- Autenticacao confiavel e segura: O sistema de autenticacao nativo do Supabase gera tokens JWT seguros, faz hash de senhas com bcrypt e gerencia sessoes automaticamente, eliminando o risco de falhas comuns em implementacoes manuais de login.
- Intermediacao de backend e processamento de regras: Em vez de manter um servidor intermediario apenas para repassar chamadas ao banco, o Supabase atua diretamente na intermediacao, aplicando validacoes de dados e garantindo alta performance com conexoes gerenciadas.

---

## 4. Por que nao enviei arquivos do banco para o repositorio?

Mesmo se tratando de um desafio tecnico, optei por tratar a seguranca do projeto com os mesmos padroes de um ambiente produtivo real. Por isso, nao inclui scripts internos do banco, schemas ou a pasta do Supabase no repositorio publico do GitHub:

- Protecao da arquitetura interna: Evitar a exposicao publica da estrutura das tabelas, funcoes e configuracoes internas reduz a superficie de ataque contra o projeto.
- Seguranca reforcada com RLS (Row Level Security): Todas as tabelas do banco possuem politicas ativas de RLS no PostgreSQL. Isso significa que, mesmo que a chave publica do frontend seja conhecida, o banco de dados autoriza unicamente as acoes permitidas para o usuario logado (verificado pelo token JWT). Um colaborador jamais consegue consultar ou manipular registros de outro colaborador.
- Testes de seguranca automatizados: Executei testes automatizados nas rotas e politicas de acesso para validar que tentativas de requisicoes nao autorizadas retornem erro e que dados confidenciais fiquem blindados.

---

## 5. API de Localizacao e Calibracao de Precisao (Alvo de ate 20 Metros)

Para comprovar a presenca fisica do colaborador no momento do ponto, utilizei a Geolocation API nativa do navegador (`navigator.geolocation`):

### Descarte de Coordenadas Nulas e Falsas (Null Island)
Navegadores em computadores ou em celulares com GPS recem-aberto costumam retornar coordenadas aproximadas por IP ou respostas nulas `(0.0000, 0.0000)`, que apontam para o Oceano Atlantico (Golfo da Guine). Criei uma funcao de sanitizacao (`isOceanCoordinate`) que identifica e descarta imediatamente essas coordenadas maritimas, forcando o sensor a buscar a posicao terrestre real.

### Calibracao Continua com Alvo de ate 20 Metros
Em vez de depender de uma leitura unica instantanea (que frequentemente traz erro superior a centenas de metros), implementei a leitura via `watchPosition` com `enableHighAccuracy: true`. O sistema acompanha a sintonizacao dos satelites em tempo real ate que a margem de erro atinja a meta de ate 20 metros (`accuracy <= 20`).

### Auditoria no Google Maps
O painel gera dinamicamente um link direto para o Google Maps a partir das coordenadas coletadas, permitindo que colaborador e gestor confiram a exatidao da rua e do local registrado.

![Calibracao de Geolocalizacao e Link do Google Maps](./docs/screenshots/desktop_geolocalizacao_calibracao.png)

### Resguardo Legal (Caso o GPS esteja desligado)
Se o colaborador estiver em um dispositivo sem suporte a GPS ou optar por nao fornecer a permissao, o sistema nao impede o registro do ponto. Legalmente, a empresa nao pode inviabilizar o registro da jornada cumprida pelo empregado. No entanto, o sistema grava a ocorrencia como "Localizacao Nao Verificada", alertando imediatamente o gestor e o RH no painel para averiguação interna.

---

## 6. Regras de Negocio Trabalhistas e Operacionais

### 6.1. Botao Unico de Acao (Prevecao de Erro Operacional)
A interface apresenta sempre um unico botao de acao em destaque, exibindo apenas a etapa seguinte da jornada (Entrada -> Pausa -> Retorno -> Saida). Isso elimina duplos cliques acidentais e impede que o colaborador bata pausas ou saidas fora da sequencia cronologica correta.

### 6.2. Limite de 10 Horas Diarias (Artigo 59 da CLT)
A legislacao trabalhista brasileira estabelece a jornada padrao de 8 horas e impoe o teto maximo de 10 horas diarias (jornada padrao mais 2 horas extras):
- Ao atingir 10 horas de trabalho no dia, o painel bloqueia qualquer tentativa de novas pausas e exige o encerramento do expediente.
- Caso ocorra uma jornada excepcional acima de 10 horas (como registrado no cenario de Madri), o sistema destaca a batida com alerta visual e disponibiliza um modal com a justificativa formal cadastrada para fins de auditoria do RH.

### 6.3. Alerta de Batida Impar do Dia Anterior
Se o colaborador encerrou o dia anterior sem registrar a batida de saida, o sistema detecta a inconsistencia e exibe um alerta de aviso no topo da tela, orientando-o a procurar o gestor para regularizar o espelho de ponto antes de acumular horas incorretas.

### 6.4. Tratamento Universal de Fusos Horarios (UTC)
Para atender colaboradores no Brasil (UTC-3), Portugal (UTC+1) e Espanha (UTC+2) sem risco de inconsistencias:
- Todas as batidas sao persistidas no banco em UTC absoluto (tempo universal coordenado).
- O calculo do total de horas trabalhadas e realizado em milissegundos reais entre os eventos, tornando o calculo matematicamente imune a mudancas de horario de verao ou viagens de trabalho.
- A exibicao na tela converte o horario UTC para o fuso horario contratual configurado no perfil de cada colaborador.

### 6.5. Fechamento Mensal pelo RH
Ao final de cada mes contabil, o setor de RH pode acionar o fechamento do periodo. O mes recebe o status `CLOSED`, e as regras de RLS do banco de dados congelam as batidas contra qualquer alteracao ou exclusao retroativa, garantindo a integridade dos dados para envio a folha de pagamento.

---

## 7. Como Baixar e Usar o APK no Celular

Para testar o aplicativo diretamente no aparelho celular Android:
1. Abra o navegador do smartphone (como o Google Chrome).
2. Acesse o endereco do projeto ou o link direto disponibilizado para o download do arquivo `.apk`.
3. Conclua o download do arquivo no celular e clique para instalar.
4. Caso o Android solicite permissao para instalar aplicativos do navegador, autorize a instalacao e abra o aplicativo normalmente.

---

## 8. Credenciais para Validacao dos Cenarios

Todas as contas utilizam a senha padrao `password123`.

- Colaborador Brasil (Sao Paulo - UTC-3): `colaborador@dndgroup.com`
- Colaboradora Lisboa (Portugal - UTC+1): `colaborador2@dndgroup.com`
- Colaborador Madri (Espanha - UTC+2): `colaborador3@dndgroup.com`
- Gestor da Equipe: `gestor@dndgroup.com`
- RH / Administrador: `rh@dndgroup.com`
