# BER App — Arquitetura do Sistema

## Visão Geral

```
┌─────────────────────────────────────────────┐
│              Mobile App (React Native)       │
│  ┌─────────┬──────────┬──────────┬────────┐ │
│  │Comercial│Engenharia│Comunicados│  Chat  │ │
│  │         │          │          │        │ │
│  │Pipeline │Obras     │Mural     │Rooms   │ │
│  │Propostas│Kanban    │Avisos    │DMs     │ │
│  │Reuniões │Fotos     │Reads     │Push    │ │
│  └────┬────┴────┬─────┴────┬─────┴───┬────┘ │
│       └─────────┴──────────┴─────────┘       │
│                     │                         │
│              REST API + WebSocket             │
└─────────────────────┬───────────────────────┘
                      │ HTTPS
┌─────────────────────┴───────────────────────┐
│              Backend (Node.js)               │
│  ┌──────────────────────────────────────┐   │
│  │           Express + TypeScript        │   │
│  ├──────────────────────────────────────┤   │
│  │  Auth      │  RBAC     │  Validation  │   │
│  │  (JWT)     │  (roles)  │  (zod)       │   │
│  ├──────────────────────────────────────┤   │
│  │  Routes / Controllers / Services      │   │
│  ├──────────────────────────────────────┤   │
│  │  WebSocket (Socket.io) — Chat         │   │
│  ├──────────────────────────────────────┤   │
│  │  Push Service (FCM + APNs)            │   │
│  ├──────────────────────────────────────┤   │
│  │  Sync Jobs (Agendor, Google Cal)      │   │
│  └──────────┬───────────────┬───────────┘   │
│             │               │                │
│     ┌───────┴───┐   ┌──────┴──────┐        │
│     │PostgreSQL │   │  S3 / R2    │        │
│     │  (dados)  │   │  (uploads)  │        │
│     └───────────┘   └─────────────┘        │
└─────────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
   ┌──────┴──────┐     ┌─────────┴────────┐
   │ Agendor API │     │ Google Calendar   │
   │ (comercial) │     │ (reuniões)        │
   └─────────────┘     └──────────────────┘
```

---

## Estrutura do Projeto

```
ber-app/
├── backend/
│   ├── src/
│   │   ├── config/           # DB, auth, env vars
│   │   ├── middleware/        # auth, rbac, error handler
│   │   ├── modules/
│   │   │   ├── auth/         # login, registro, recuperação
│   │   │   ├── users/        # CRUD, perfil
│   │   │   ├── obras/        # CRUD, membros, progresso
│   │   │   ├── tasks/        # kanban, CRUD
│   │   │   ├── proposals/    # propostas, sync Agendor
│   │   │   ├── meetings/     # reuniões, sync Google Cal
│   │   │   ├── announcements/# comunicados, reads
│   │   │   ├── chat/         # rooms, mensagens, WebSocket
│   │   │   ├── photos/       # upload, comentários
│   │   │   └── notifications/# push, in-app
│   │   ├── jobs/             # sync jobs (cron)
│   │   ├── utils/            # helpers
│   │   └── app.ts            # entry point
│   ├── migrations/           # SQL migrations
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/
│   ├── src/
│   │   ├── navigation/       # React Navigation (tabs + stacks)
│   │   ├── screens/
│   │   │   ├── auth/         # Login, ForgotPassword
│   │   │   ├── comercial/    # Dashboard, Propostas, Reunioes
│   │   │   ├── engenharia/   # Obras, ObraDetail, Kanban
│   │   │   ├── comunicados/  # Lista, Detalhe
│   │   │   ├── chat/         # Rooms, Conversation
│   │   │   ├── fotos/        # Mural, Upload
│   │   │   └── profile/      # Perfil, Config
│   │   ├── components/       # UI reutilizáveis
│   │   ├── services/         # API client, WebSocket
│   │   ├── stores/           # Zustand (state management)
│   │   ├── hooks/            # Custom hooks
│   │   ├── theme/            # Cores, fontes, espaçamentos
│   │   └── utils/
│   ├── ios/
│   ├── android/
│   └── package.json
│
└── docs/
    ├── DATABASE.md
    ├── ARCHITECTURE.md
    └── API.md
```

---

## Tecnologias

### Backend
| Tech | Uso |
|------|-----|
| Node.js + Express | API REST |
| TypeScript | Tipagem estática |
| PostgreSQL | Banco relacional |
| Prisma | ORM |
| Socket.io | Chat real-time |
| Zod | Validação de input |
| JWT + bcrypt | Autenticação |
| node-cron | Jobs de sync |
| Firebase Admin SDK | Push notifications |
| AWS S3 ou Cloudflare R2 | Upload de fotos/arquivos |

### Mobile
| Tech | Uso |
|------|-----|
| React Native 0.76+ | Framework mobile |
| Expo (managed) | Build e tooling |
| React Navigation | Navegação |
| Zustand | State management |
| Socket.io-client | Chat real-time |
| React Query | Cache + data fetching |
| React Native Push | Notificações |
| React Native Image Picker | Upload de fotos |

---

## Fluxos Principais

### Autenticação
1. User abre app → tela de login
2. Email + senha → POST /api/auth/login
3. Backend valida → retorna JWT (access + refresh token)
4. App salva token no SecureStore
5. Todas as requests incluem `Authorization: Bearer <token>`
6. Refresh automático quando access token expira

### Sync Agendor (Comercial)
1. Job roda a cada 15 min
2. GET /deals do Agendor API
3. Upsert nas tabelas proposals e meetings
4. Notifica users relevantes se houve mudança

### Sync Google Calendar (Reuniões)
1. Job roda a cada 15 min
2. Busca eventos das próximas 48h
3. Upsert na tabela meetings
4. Push notification 1h antes da reunião

### Chat (Real-time)
1. User entra na sala → Socket.io connect
2. Mensagem enviada → emit('message', data)
3. Backend salva no DB + broadcast pra sala
4. Users offline → push notification

### Push Notifications
1. App registra push token no login
2. Backend salva token na tabela users
3. Eventos disparam notifications
4. Worker envia via FCM/APNs
5. Deep link abre a tela certa no app

---

## Segurança

- **HTTPS** em tudo
- **JWT** com expiração curta (15min access, 7d refresh)
- **bcrypt** para senhas (salt rounds: 12)
- **RBAC** middleware — checa role antes de cada rota
- **Rate limiting** — proteção contra brute force
- **Input validation** — Zod em todas as rotas
- **SQL injection** — Prisma ORM (queries parametrizadas)
- **Upload** — validação de tipo + tamanho (max 10MB imagens)
- **UUIDs** — sem IDs sequenciais expostos

---

## Deploy (Proposta)

| Componente | Onde |
|-----------|------|
| Backend API | Railway ou AWS ECS |
| PostgreSQL | Railway Postgres ou RDS |
| File Storage | Cloudflare R2 (mais barato que S3) |
| Push | Firebase (grátis) |
| Mobile Build | Expo EAS Build |
| iOS | Apple App Store |
| Android | Google Play Store |

**Custo estimado (~25 users):**
- Railway: ~$10-20/mês (backend + DB)
- R2: ~$0-5/mês (storage)
- Firebase: grátis (push)
- Apple Developer: $99/ano
- Google Play: $25 (único)
- **Total: ~$20-30/mês + taxas das stores**
