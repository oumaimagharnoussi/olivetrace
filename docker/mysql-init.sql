-- Prisma Migrate a besoin de créer une base temporaire (shadow database) en développement.
GRANT ALL PRIVILEGES ON *.* TO 'olivetrace'@'%';
FLUSH PRIVILEGES;
