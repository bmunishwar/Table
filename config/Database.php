<?php

declare(strict_types=1);

class Database
{
    private static ?PDO $instance = null;

    // -- Update these credentials for your environment --
    private const DB_HOST = 'localhost';
    private const DB_PORT = '5432';
    private const DB_NAME = 'table_demo';
    private const DB_USER = 'postgres';
    private const DB_PASS = '';

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $dsn = sprintf(
                'pgsql:host=%s;port=%s;dbname=%s',
                self::DB_HOST,
                self::DB_PORT,
                self::DB_NAME
            );

            self::$instance = new PDO($dsn, self::DB_USER, self::DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);

            // Set client encoding to UTF-8
            self::$instance->exec("SET client_encoding TO 'UTF8'");
        }

        return self::$instance;
    }

    private function __construct() {}
    private function __clone() {}
}
