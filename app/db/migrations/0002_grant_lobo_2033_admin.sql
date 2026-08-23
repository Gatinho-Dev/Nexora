-- Promote the existing Nexora account requested by the platform owner.
-- Username is unique; the display-name guard prevents promoting an unexpected
-- account if this migration is applied to a different environment.
UPDATE `users`
SET `role` = 'admin', `updatedAt` = NOW()
WHERE `username` = 'Lobo_2033' AND `name` = 'Gatinho';
