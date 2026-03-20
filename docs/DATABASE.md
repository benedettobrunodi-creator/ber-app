# BER App — Arquitetura do Banco de Dados

## Diagrama Relacional

```
users ─────────┬──── user_roles
               │
               ├──── notifications
               │
               ├──── chat_messages ──── chat_rooms
               │
               ├──── announcements ──── announcement_reads
               │
               ├──── photos ──── photo_comments
               │
               ├──── proposals
               │
               └──── obra_tasks ──── obras
```

---

## Tabelas

### 1. users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,         -- @ber-engenharia.com.br
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'campo',  -- diretoria, coordenacao, gestor, campo
    phone VARCHAR(20),
    avatar_url TEXT,
    push_token TEXT,                            -- FCM/APNs token
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. obras
```sql
CREATE TABLE obras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    client VARCHAR(255),
    address TEXT,
    status VARCHAR(50) DEFAULT 'em_andamento',  -- planejamento, em_andamento, pausada, concluida
    start_date DATE,
    expected_end_date DATE,
    actual_end_date DATE,
    progress_percent INTEGER DEFAULT 0,          -- 0-100
    coordinator_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3. obra_members (equipe por obra)
```sql
CREATE TABLE obra_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID REFERENCES obras(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'membro',           -- coordenador, gestor, membro
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(obra_id, user_id)
);
```

### 4. obra_tasks (kanban)
```sql
CREATE TABLE obra_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID REFERENCES obras(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo',           -- todo, in_progress, review, done
    priority VARCHAR(20) DEFAULT 'medium',       -- low, medium, high, urgent
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    due_date DATE,
    position INTEGER DEFAULT 0,                  -- ordem no kanban
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 5. proposals (propostas comerciais)
```sql
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agendor_deal_id VARCHAR(100),               -- ID no Agendor
    client_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    value DECIMAL(15,2),
    status VARCHAR(50) DEFAULT 'em_elaboracao',  -- em_elaboracao, enviada, em_negociacao, ganha, perdida
    sent_date DATE,
    closed_date DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 6. meetings (reuniões agendadas)
```sql
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_event_id VARCHAR(255),               -- ID no Google Calendar
    title VARCHAR(255) NOT NULL,
    description TEXT,
    client_name VARCHAR(255),
    location TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    proposal_id UUID REFERENCES proposals(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 7. announcements (comunicados)
```sql
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'informativo',  -- urgente, informativo, rh, operacional
    target_roles TEXT[] DEFAULT '{diretoria,coordenacao,gestor,campo}',
    author_id UUID REFERENCES users(id),
    pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 8. announcement_reads (quem leu)
```sql
CREATE TABLE announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);
```

### 9. chat_rooms
```sql
CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    type VARCHAR(20) DEFAULT 'group',            -- group, direct, obra
    obra_id UUID REFERENCES obras(id),           -- se tipo = obra
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 10. chat_room_members
```sql
CREATE TABLE chat_room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);
```

### 11. chat_messages
```sql
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    body TEXT NOT NULL,
    attachment_url TEXT,
    attachment_type VARCHAR(20),                  -- image, file, audio
    read_by UUID[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 12. photos (mural de fotos)
```sql
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID REFERENCES obras(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(id),
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 13. photo_comments
```sql
CREATE TABLE photo_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 14. notifications
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,                   -- proposal_update, announcement, chat, obra_update, task
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',                     -- payload para deep link
    read BOOLEAN DEFAULT false,
    sent BOOLEAN DEFAULT false,                  -- push enviado?
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Índices

```sql
-- Performance queries frequentes
CREATE INDEX idx_obra_tasks_obra_id ON obra_tasks(obra_id);
CREATE INDEX idx_obra_tasks_status ON obra_tasks(status);
CREATE INDEX idx_obra_tasks_assigned ON obra_tasks(assigned_to);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_photos_obra ON photos(obra_id, created_at DESC);
CREATE INDEX idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX idx_announcement_reads_announcement ON announcement_reads(announcement_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id, timestamp DESC);
CREATE INDEX idx_time_entries_obra ON time_entries(obra_id, timestamp DESC);
CREATE INDEX idx_time_entries_date ON time_entries(user_id, type, DATE(timestamp));
```

---

### 15. time_entries (registro de ponto)
```sql
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    obra_id UUID REFERENCES obras(id),
    type VARCHAR(10) NOT NULL,                   -- checkin, checkout
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,                                 -- reverse geocoding
    photo_url TEXT,                               -- foto opcional no checkin
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 16. time_entry_summary (view materializada — relatório mensal)
```sql
CREATE VIEW time_entry_summary AS
SELECT 
    te_in.user_id,
    te_in.obra_id,
    DATE(te_in.timestamp) as work_date,
    te_in.timestamp as checkin_time,
    te_out.timestamp as checkout_time,
    EXTRACT(EPOCH FROM (te_out.timestamp - te_in.timestamp)) / 3600 as hours_worked
FROM time_entries te_in
LEFT JOIN LATERAL (
    SELECT timestamp FROM time_entries 
    WHERE user_id = te_in.user_id 
    AND type = 'checkout' 
    AND timestamp > te_in.timestamp
    ORDER BY timestamp ASC LIMIT 1
) te_out ON true
WHERE te_in.type = 'checkin';
```

---

## Notas

- UUIDs em tudo pra segurança (não expõe IDs sequenciais)
- Timestamps em UTC, conversão no frontend (America/Sao_Paulo)
- Soft delete via `is_active` no users (não deleta, desativa)
- JSONB no notifications.data pra flexibilidade de deep links
- Array `read_by` no chat_messages pra rastrear leituras sem tabela extra
- `target_roles` como array no announcements pra filtrar quem vê o comunicado
