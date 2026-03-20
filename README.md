# BER Engenharia — App Interno

> App mobile nativo para gestão interna da BER Engenharia.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Mobile | React Native (iOS + Android) |
| Backend | Node.js + Express |
| Banco | PostgreSQL |
| Auth | JWT + email @ber-engenharia.com.br |
| Push | Firebase Cloud Messaging + APNs |
| Integrações | Agendor API, Google Calendar API |
| Hospedagem | A definir (Railway ou AWS) |

## Módulos MVP v1

1. **Comercial** — Pipeline de vendas, propostas, conversões, reuniões
2. **Engenharia** — Painel de obras (geral + individual), kanban por obra
3. **Comunicados** — Mural de avisos com status de leitura
4. **Chat Interno** — Por obra/equipe + mensagens diretas
5. **Mural de Fotos** — Upload por obra, timeline, comentários
6. **Registro de Ponto** — Check-in/out com geolocalização, relatório mensal
7. **Notificações Push** — Propostas, comunicados, chat, obras

## Níveis de Permissão

| Nível | Acesso |
|-------|--------|
| Diretoria | Tudo |
| Coordenação | Obras + comercial + gestão de equipe |
| Gestores | Obras atribuídas + comunicados + chat |
| Campo | Kanban da obra + chat + mural de fotos |

## Usuários estimados: ~25

## Roadmap

### v1 (MVP)
- [ ] Arquitetura e banco de dados
- [ ] Backend API
- [ ] Auth + permissões
- [ ] Módulo Comercial
- [ ] Módulo Engenharia
- [ ] Comunicados
- [ ] Chat interno
- [ ] Mural de fotos
- [ ] Push notifications
- [ ] Deploy + publicação nas stores

### v2 (Futuro)
- [ ] Pedidos de compra
- [ ] Documentos (contratos, ARTs, projetos)
- [ ] Aprovações
- [ ] Checklist de segurança
- [ ] Diário de obra
- [ ] Financeiro

## Decisões

- **Identidade visual**: Pegar com Tom (agente de marketing)
- **Stores**: Bruno precisa criar Apple Developer ($99/ano) e Google Play ($25 única)
- **Dados comerciais**: Integração com Agendor API
