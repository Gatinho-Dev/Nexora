-- Normaliza URLs de arquivos salvass com origem absoluta (ex.: domínio
-- onrender.com) para caminhos relativos. Com domínio personalizado, URLs
-- absolutas para outro host são cross-origin: o cookie de sessão não é
-- enviado e /api/files/:id retorna 401 (avatars/ícones não carregam).
-- Idempotente: só altera linhas que começam com scheme://host/api/files/.
UPDATE users SET avatar = REGEXP_SUBSTR(avatar, '/api/files/.+')
WHERE avatar REGEXP '^https?://[^/]+/api/files/';--> statement-breakpoint
UPDATE users SET banner = REGEXP_SUBSTR(banner, '/api/files/.+')
WHERE banner REGEXP '^https?://[^/]+/api/files/';--> statement-breakpoint
UPDATE servers SET iconUrl = REGEXP_SUBSTR(iconUrl, '/api/files/.+')
WHERE iconUrl REGEXP '^https?://[^/]+/api/files/';--> statement-breakpoint
UPDATE servers SET bannerUrl = REGEXP_SUBSTR(bannerUrl, '/api/files/.+')
WHERE bannerUrl REGEXP '^https?://[^/]+/api/files/';--> statement-breakpoint
UPDATE conversations SET avatarUrl = REGEXP_SUBSTR(avatarUrl, '/api/files/.+')
WHERE avatarUrl REGEXP '^https?://[^/]+/api/files/';--> statement-breakpoint
UPDATE webhooks SET avatarUrl = REGEXP_SUBSTR(avatarUrl, '/api/files/.+')
WHERE avatarUrl REGEXP '^https?://[^/]+/api/files/';
