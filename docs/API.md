# BER App — API Reference (MVP v1)

Base URL: `https://api.ber-app.com.br/v1`

---

## Auth

| Method | Endpoint | Desc | Auth |
|--------|----------|------|------|
| POST | /auth/login | Login com email + senha | ❌ |
| POST | /auth/refresh | Refresh token | ❌ |
| POST | /auth/forgot-password | Enviar email de recuperação | ❌ |
| POST | /auth/reset-password | Resetar senha com token | ❌ |

---

## Users

| Method | Endpoint | Desc | Role mínimo |
|--------|----------|------|------------|
| GET | /users | Listar usuários | coordenacao |
| GET | /users/me | Meu perfil | campo |
| PUT | /users/me | Atualizar meu perfil | campo |
| POST | /users | Criar usuário | diretoria |
| PUT | /users/:id | Editar usuário | diretoria |
| DELETE | /users/:id | Desativar usuário | diretoria |
| PUT | /users/me/push-token | Registrar push token | campo |

---

## Obras

| Method | Endpoint | Desc | Role mínimo |
|--------|----------|------|------------|
| GET | /obras | Listar obras (filtro por status) | gestor |
| GET | /obras/:id | Detalhe da obra | gestor (membro) |
| POST | /obras | Criar obra | coordenacao |
| PUT | /obras/:id | Editar obra | coordenacao |
| GET | /obras/:id/members | Membros da obra | gestor (membro) |
| POST | /obras/:id/members | Adicionar membro | coordenacao |
| DELETE | /obras/:id/members/:userId | Remover membro | coordenacao |
| GET | /obras/:id/stats | Estatísticas da obra | gestor |

---

## Tasks (Kanban)

| Method | Endpoint | Desc | Role mínimo |
|--------|----------|------|------------|
| GET | /obras/:obraId/tasks | Listar tasks da obra | campo (membro) |
| POST | /obras/:obraId/tasks | Criar task | gestor (membro) |
| PUT | /tasks/:id | Editar task | gestor (membro) |
| PATCH | /tasks/:id/status | Mover no kanban | campo (membro) |
| PATCH | /tasks/:id/position | Reordenar | campo (membro) |
| DELETE | /tasks/:id | Deletar task | gestor |

---

## Proposals (Comercial)

| Method | Endpoint | Desc | Role mínimo |
|--------|----------|------|------------|
| GET | /proposals | Listar propostas | coordenacao |
| GET | /proposals/:id | Detalhe | coordenacao |
| GET | /proposals/stats | Dashboard (pipeline, conversão) | coordenacao |
| POST | /proposals/sync | Forçar sync com Agendor | diretoria |

---

## Meetings (Reuniões)

| Method | Endpoint | Desc | Role mínimo |
|--------|----------|------|------------|
| GET | /meetings | Listar reuniões (filtro por data) | coordenacao |
| GET | /meetings/upcoming | Próximas 48h | coordenacao |
| POST | /meetings/sync | Forçar sync com Google Cal | diretoria |

---

## Announcements (Comunicados)

| Method | Endpoint | Desc | Role mínimo |
|--------|----------|------|------------|
| GET | /announcements | Listar (filtrado por meu role) | campo |
| GET | /announcements/:id | Detalhe + marcar como lido | campo |
| POST | /announcements | Criar comunicado | coordenacao |
| PUT | /announcements/:id | Editar | coordenacao |
| DELETE | /announcements/:id | Deletar | diretoria |
| GET | /announcements/:id/reads | Quem leu | coordenacao |

---

## Chat

| Method | Endpoint | Desc | Role mínimo |
|--------|----------|------|------------|
| GET | /chat/rooms | Minhas salas | campo |
| POST | /chat/rooms | Criar sala | gestor |
| GET | /chat/rooms/:id/messages | Mensagens (paginado) | campo (membro) |
| POST | /chat/rooms/:id/messages | Enviar mensagem (REST fallback) | campo (membro) |

### WebSocket Events
| Event | Direction | Desc |
|-------|-----------|------|
| join_room | Client → Server | Entrar na sala |
| leave_room | Client → Server | Sair da sala |
| message | Client → Server | Enviar mensagem |
| new_message | Server → Client | Nova mensagem |
| typing | Client ↔ Server | Indicador de digitação |
| read | Client → Server | Marcar como lido |

---

## Photos (Mural)

| Method | Endpoint | Desc | Role mínimo |
|--------|----------|------|------------|
| GET | /obras/:obraId/photos | Listar fotos da obra | campo (membro) |
| POST | /obras/:obraId/photos | Upload de foto | campo (membro) |
| DELETE | /photos/:id | Deletar foto | gestor |
| GET | /photos/:id/comments | Listar comentários | campo (membro) |
| POST | /photos/:id/comments | Comentar | campo (membro) |

---

## Time Entries (Registro de Ponto)

| Method | Endpoint | Desc | Role mínimo |
|--------|----------|------|------------|
| POST | /time-entries/checkin | Registrar entrada | campo |
| POST | /time-entries/checkout | Registrar saída | campo |
| GET | /time-entries/me | Meus registros (filtro por mês) | campo |
| GET | /time-entries/me/status | Estou em campo agora? | campo |
| GET | /time-entries | Todos os registros (filtro por user/obra/mês) | coordenacao |
| GET | /time-entries/report | Relatório mensal (horas por pessoa/obra) | coordenacao |
| GET | /time-entries/active | Quem está em campo agora | coordenacao |
| DELETE | /time-entries/:id | Corrigir registro errado | diretoria |

---

## Notifications

| Method | Endpoint | Desc | Role mínimo |
|--------|----------|------|------------|
| GET | /notifications | Minhas notificações (paginado) | campo |
| PATCH | /notifications/:id/read | Marcar como lida | campo |
| PATCH | /notifications/read-all | Marcar todas como lidas | campo |
| GET | /notifications/unread-count | Contador de não lidas | campo |

---

## Padrões

### Paginação
```json
GET /endpoint?page=1&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Erros
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token inválido ou expirado"
  }
}
```

### Status codes
- 200 OK
- 201 Created
- 400 Bad Request (validação)
- 401 Unauthorized (sem token)
- 403 Forbidden (sem permissão)
- 404 Not Found
- 429 Too Many Requests
- 500 Internal Server Error
