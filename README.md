# D&D Jornada - Controle de Ponto Inteligente

Desenvolvi este sistema de controle de ponto eletrônico pensando na realidade de empresas com equipes distribuídas entre o Brasil e a Europa (Portugal e Espanha). O projeto foi feito inteiramente por mim, com o objetivo de entregar uma experiência simples no dia a dia, respeitar as regras da CLT e resolver de forma transparente a diferença de fusos horários.

---

## Acesso Online

A aplicação está disponível na internet e pode ser testada diretamente pelo navegador:

[Acessar a Aplicação na Vercel](https://dnd-jornada.vercel.app)

---

## Telas do Sistema

### Versão para Computador (Desktop)

O painel no computador oferece uma visão ampla e limpa para colaboradores, gestores e RH.

Tela de login corporativo:
![Login no Computador](./docs/screenshots/desktop_login.png)

Registro de ponto e acompanhamento das horas trabalhadas:
![Início de Intervalo](./docs/screenshots/desktop_iniciar_pausa.png)

Encerramento da jornada diária:
![Encerramento de Jornada](./docs/screenshots/desktop_encerrar_jornada.png)

Quadro semanal e regras de expediente:
![Quadro Semanal](./docs/screenshots/desktop_quadro_semanal.png)

Validação de geolocalização com precisão real e conferência no Google Maps:
![Validação de Geolocalização](./docs/screenshots/desktop_geolocalizacao_calibracao.png)

---

### Versão para Celular (Mobile)

O aplicativo foi desenhado para funcionar com a mesma facilidade na tela do celular:

| Login | Início de Jornada | Início de Pausa |
| :---: | :---: | :---: |
| ![Login no Celular](./docs/screenshots/mobile_login.jpg) | ![Início de Jornada](./docs/screenshots/mobile_iniciar_jornada.jpg) | ![Início de Pausa](./docs/screenshots/mobile_pausa.jpg) |

| Quadro Semanal de Pontos | Encerramento de Jornada |
| :---: | :---: |
| ![Quadro Semanal no Celular](./docs/screenshots/mobile_quadro_semanal.jpg) | ![Encerramento de Jornada](./docs/screenshots/mobile_encerrar_jornada.jpg) |

---

## Usuários Disponíveis para Testes

Todas as contas utilizam a mesma senha: `password123`.

- Colaborador Brasil (São Paulo): `colaborador@dndgroup.com`
- Colaboradora Lisboa (Portugal): `colaborador2@dndgroup.com`
- Colaborador Madri (Espanha): `colaborador3@dndgroup.com`
- Gestor da Equipe: `gestor@dndgroup.com`
- Recursos Humanos / Administrador: `rh@dndgroup.com`

---

## Como Usar no Celular

Para testar no celular, você pode escolher o caminho que achar mais prático:

1. Usar direto pelo navegador (PWA): Abra o link `https://dnd-jornada.vercel.app` no navegador do celular (Chrome ou Safari) e toque em "Adicionar à tela de início". O sistema funcionará como um aplicativo comum, em tela cheia e com acesso ao GPS.

---

## Decisões Técnicas e Arquitetura

Expliquei em detalhes como pensei a segurança, a escolha do Supabase, o cálculo dos fusos horários e as regras trabalhistas em um documento separado:

[Ler o documento de Decisões Técnicas (DECISOES_TECNICAS.md)](DECISOES_TECNICAS.md)

---

## Como Rodar o Projeto no Computador

Caso queira executar o código na sua máquina:

1. Clone o repositório e acesse a pasta do projeto:
   ```bash
   git clone https://github.com/gppacheco/dnd-jornada.git
   cd dnd-jornada/dnd-jornada/web
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure o arquivo de ambiente:
   ```bash
   cp src/environments/environment.example.ts src/environments/environment.ts
   ```
   Informe a URL e a chave pública do Supabase no arquivo `src/environments/environment.ts`.

4. Inicie o sistema:
   ```bash
   npm start
   ```
   Acesse no navegador pelo endereço `http://localhost:4200`.
