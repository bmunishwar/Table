<?php

declare(strict_types=1);

class Database
{
    private static ?PDO $instance = null;

    private static function env(string $key, string $default): string
    {
        return trim((string) ($_ENV[$key] ?? getenv($key) ?: $default));
    }

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $dsn = sprintf(
                'pgsql:host=%s;port=%s;dbname=%s;connect_timeout=5',
                self::env('DB_HOST', 'localhost'),
                self::env('DB_PORT', '5432'),
                self::env('DB_NAME', 'table_demo')
            );

            try {
                self::$instance = new PDO($dsn, self::env('DB_USER', 'postgres'), self::env('DB_PASS', ''), [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]);

                self::$instance->exec("SET client_encoding TO 'UTF8'");
            } catch (\PDOException $e) {
                error_log('[Database] Connection failed: ' . $e->getMessage());
                throw new \RuntimeException('Database connection failed.');
            }
        }

        return self::$instance;
    }

    private function __construct() {}
    private function __clone() {}
}
