-- Backfill: cargos criados antes da feature de permissões avançadas não tinham
-- VIEW_CHANNEL (nem as demais permissões básicas) no JSON `roles.permissions`,
-- o que escondia TODOS os canais de membros comuns em servidores antigos.
-- Idempotente: só adiciona a permissão se ela ainda não existir no array.
UPDATE roles SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'SEND_MESSAGES')
WHERE NOT JSON_CONTAINS(COALESCE(permissions, JSON_ARRAY()), '"SEND_MESSAGES"', '$');--> statement-breakpoint
UPDATE roles SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'READ_MESSAGES')
WHERE NOT JSON_CONTAINS(COALESCE(permissions, JSON_ARRAY()), '"READ_MESSAGES"', '$');--> statement-breakpoint
UPDATE roles SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'VIEW_CHANNEL')
WHERE NOT JSON_CONTAINS(COALESCE(permissions, JSON_ARRAY()), '"VIEW_CHANNEL"', '$');--> statement-breakpoint
UPDATE roles SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'CONNECT')
WHERE NOT JSON_CONTAINS(COALESCE(permissions, JSON_ARRAY()), '"CONNECT"', '$');--> statement-breakpoint
UPDATE roles SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'SPEAK')
WHERE NOT JSON_CONTAINS(COALESCE(permissions, JSON_ARRAY()), '"SPEAK"', '$');--> statement-breakpoint
UPDATE roles SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'STREAM')
WHERE NOT JSON_CONTAINS(COALESCE(permissions, JSON_ARRAY()), '"STREAM"', '$');
