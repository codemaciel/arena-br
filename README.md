# ARENA BR — FPS 3D para navegador

Jogo de tiro em primeira pessoa, rápido e leve, inspirado no **gênero** de FPS de navegador (como Krunker.io), mas com nome, visual, mapa e código **originais**. Tudo é geometria simples e texturas geradas por código: **nenhum asset externo**. Interface 100% em português brasileiro.

- **Versão local (jogável):** você contra bots, com menu, HUD, pausa, placar e tela de vitória/derrota.
- **Multiplayer (etapa 2):** servidor Node.js + Socket.IO com o servidor como autoridade. O servidor e seus testes estão prontos; a integração do cliente ainda está **pendente** (veja "Funcionalidades").

## Controles

| Tecla / Mouse | Ação |
|---|---|
| W A S D | Mover |
| Shift | Correr |
| Espaço | Pular |
| Mouse | Mirar |
| Botão esquerdo | Atirar (segure para rajada) |
| R | Recarregar |
| Tab (segurar) | Placar |
| Esc | Pausar |

## 1. Instalação no Windows (PowerShell)

1. Instale o Node.js LTS (versão 18 ou superior). No PowerShell:

   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

   Feche e abra o PowerShell e confirme:

   ```powershell
   node -v
   npm -v
   ```

2. Extraia o `.zip`, entre na pasta e instale as dependências:

   ```powershell
   cd C:\caminho\para\arena-br
   npm install
   ```

3. (Opcional) Abra no VS Code: `code .`

## 2. Executar

```powershell
npm run dev        # servidor de desenvolvimento (abre http://localhost:5173)
npm test           # testes automatizados (regras, dano, pontuação, bots, servidor)
npm run build      # gera a versão final na pasta dist/
npm run preview    # testa a versão final localmente
npm run server     # servidor multiplayer (porta 3001), etapa 2
```

No VS Code, use o terminal integrado (Ctrl + `) e rode os mesmos comandos.

## 3. Estrutura do projeto

```
index.html              Menus, HUD e telas (HTML)
src/
  main.js               Inicialização
  config.js             Todas as constantes (jogador, arma, bots, dificuldade, pontuação, rede)
  settings.js           Configurações salvas no navegador (com validação)
  core/Game.js          Laço principal e gerenciamento da partida
  render/               Renderer, World (arena 3D), BotView, Effects (tiros/impactos)
  player/               PlayerController (teclado, mouse, física)
  weapons/              Weapon (munição/cadência), WeaponSystem (hitscan), ViewModel (arma na tela)
  ai/                   Bot (máquina de estados) e BotManager
  physics/              Collision (AABB, raycast) e Hitbox (cabeça/corpo)
  game/                 Match (pontuação e regras), Damage (dano e vida), spawn
  map/arena.js          Dados do mapa (usado também pelo servidor)
  audio/                AudioManager (sons sintetizados, sem arquivos)
  ui/                   UI (DOM) e styles.css
server/                 GameRoom (autoridade), RateLimiter, index.js (Socket.IO)
tests/                  Testes com o runner nativo do Node (node:test)
```

Módulos de regras, física, IA e servidor **não dependem do Three.js**, por isso são testáveis e reutilizados pelo servidor.

## 4. Como o jogo funciona

- **Partida (JOGAR):** primeiro a 20 eliminações ou maior pontuação em 5 minutos. Dificuldade escolhida no menu.
- **Treinamento:** 5 alvos que patrulham e **não atiram**, sem limite de tempo.
- **Pontuação:** 100 por eliminação, +50 por tiro na cabeça, +25 por eliminação seguida (teto +100).
- **Dano:** 22 por tiro, cabeça x2, queda de dano com a distância (a partir de 25 m). Vida regenera após 5 s sem dano.
- **Bots:** estados Patrulha, Busca, Perseguição, Ataque e Reposicionamento; reaparecem e voltam ao combate. Respeitam paredes e limites. Usam visão com campo de visão e linha de visada (não atiram através de paredes).
- **Mapa "Arena Urbana":** 80 x 80 m, com ruas, 4 edifícios, praça elevada, plataforma alta com escada de caixas, corredor, barreiras e caixas.

Ajuste tudo em `src/config.js` (sem mexer na lógica).

## 5. Publicar gratuitamente

Rode `npm run build`. A pasta `dist/` é um site estático (usa caminhos relativos), então funciona em qualquer hospedagem:

- **Netlify (mais simples):** acesse app.netlify.com/drop e arraste a pasta `dist`.
- **Vercel:** `npm i -g vercel`, depois `vercel` na pasta do projeto (Framework: Vite; saída: `dist`).
- **Cloudflare Pages:** conecte o repositório; comando `npm run build`, saída `dist`.
- **GitHub Pages:** envie o projeto para um repositório com branch `main`, ative em *Settings > Pages > Source: GitHub Actions*. O arquivo `.github/workflows/deploy.yml` já publica a cada push (e roda os testes antes).

Para o **servidor multiplayer** (quando o cliente estiver integrado), um plano gratuito do Render/Railway/Fly.io serve: comando de início `npm run server`, variáveis `PORT` (automática) e `CORS_ORIGIN` (URL do seu site). Planos gratuitos costumam "dormir" após inatividade.

## 6. Multiplayer (etapa 2) — o que existe

O servidor (`server/`) é a **autoridade** do estado:

- Salas (`join` com nome e sala), limite de jogadores, entrada/saída e tratamento de desconexão.
- O cliente envia **apenas intenção**: posição (`move`), direção do tiro (`shoot`) e recarga (`reload`).
- Movimentos são validados (velocidade, limites do mapa, paredes, altura); movimento inválido recebe `game:correction`.
- Disparos usam a posição do servidor, a munição e a cadência do servidor; acerto, dano, mortes, respawn e placar são calculados no servidor.
- Limite de frequência por jogador e por tipo de evento (balde de fichas).
- Eventos emitidos: `game:snapshot` (20 Hz), `game:shot`, `game:damage`, `game:kill`, `game:respawn`, `game:match_end`, `game:match_restart`, `game:player_joined`, `game:player_left`, `game:correction`.

## 7. Funcionalidades

**Implementadas**

- Câmera em primeira pessoa, WASD, corrida, pulo, mira, tiro, recarga, munição, vida, mortes e eliminações
- Crosshair, efeitos de disparo e impacto, sons de tiro/recarga/eliminação/dano (sintetizados)
- Pontuação, vitória/derrota/empate, reinício, pausa, placar (Tab)
- Bots com 5 estados, 3 dificuldades, reaparecimento e retorno ao combate
- Mapa original com colisões AABB, limites físicos e plataformas alcançáveis
- Menu (JOGAR, TREINAMENTO, CONFIGURAÇÕES), dificuldade, sensibilidade, volume e FOV salvos no navegador
- Delta time, limpeza de recursos (`dispose`), tratamento de erros (WebGL, áudio, armazenamento)
- Testes automatizados de pontuação, dano, arma, regras da partida, colisões, bots e servidor
- Servidor multiplayer autoritativo com salas, validação e limite de frequência

**Pendentes**

- **Cliente multiplayer:** conectar o jogo ao servidor (menu de salas, interpolação dos outros jogadores, predição/reconciliação). Deve ser feito **depois** de validar a versão local.
- Validação manual em navegador (veja abaixo): o código foi verificado por testes de lógica e por um teste de fumaça com Three.js simulado, **não** com renderização real.
- Navegação dos bots é por waypoints + desvio simples (sem malha de navegação): podem esbarrar em cantos.
- Sem modelos/texturas externos, minimapa, múltiplas armas, mobile/touch e persistência de recordes.

## 8. Validação manual antes de avançar ao multiplayer

Rode `npm run dev` e confira:

1. **Movimentação:** W A S D, Shift e pulo respondem; subir a escada de caixas até a plataforma alta funciona.
2. **Colisões:** não atravessa paredes, caixas, barreiras nem o muro do mapa; desliza ao encostar.
3. **Disparos:** o tiro acerta onde a mira aponta; tiro na cabeça mostra marcador rosa; recarga funciona (R e automática).
4. **Pontuação:** eliminação soma 100 (+50 na cabeça); o placar (Tab) e a tela final batem com o que aconteceu.
5. **Bots:** patrulham, perseguem, atacam, não atiram através de paredes e voltam após reaparecer.

## 9. Solução de problemas

| Problema | Solução |
|---|---|
| `npm : o arquivo npm.ps1 não pode ser carregado` (execução de scripts desabilitada) | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` ou use `npm.cmd run dev` |
| `'node' não é reconhecido` | Reinstale o Node.js LTS e reabra o PowerShell/VS Code |
| `'vite' não é reconhecido` | Rode `npm install` na pasta do projeto |
| Porta 5173 em uso | `npm run dev -- --port 5180` |
| Tela de erro "Não foi possível iniciar o WebGL" | Ative a aceleração de hardware no navegador, atualize o driver de vídeo ou use Chrome/Edge/Firefox atualizados |
| Tela preta ou travando | Feche outras abas pesadas; reduza o FOV nas configurações |
| O mouse não "prende" ou o jogo pausa sozinho | Clique na tela. Se acabou de apertar Esc, aguarde ~1 s antes de clicar em CONTINUAR (limite do navegador) |
| Sem som | O áudio só liga após o primeiro clique (regra dos navegadores); confira o volume nas configurações |
| `npm install` falha por rede/proxy | Verifique a conexão; tente `npm install --registry=https://registry.npmjs.org/` |
| Erros de caminho longo no Windows | Extraia o projeto perto da raiz, ex.: `C:\dev\arena-br` |
| Servidor: `EADDRINUSE` | Porta 3001 ocupada: `$env:PORT=3002; npm run server` |
| `npm test` mostra falhas | Use Node 18+ (`node -v`) e reinstale: apague `node_modules` e rode `npm install` |

## Licença e originalidade

Projeto autoral e educacional. Não usa nome, logotipo, mapas, assets ou código de outros jogos.
