ALTER TABLE `users`
  ADD COLUMN `platformOwner` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE `users`
SET `platformOwner` = true, `updatedAt` = NOW()
WHERE `username` = 'Lobo_2033' AND `name` = 'Gatinho';
