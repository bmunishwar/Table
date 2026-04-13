<?php

declare(strict_types=1);

class Database
{
    private static ?PDO $instance = null;

    // -- Update these credentials for your environment --
    private const DB_HOST    = 'localhost';
    private const DB_NAME    = 'table_demo';
    private const DB_USER    = 'root';
    private const DB_PASS    = '';
    private const DB_CHARSET = 'utf8mb4';

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $dsn = sprintf(
                'mysql:host=%s;dbname=%s;charset=%s',
                self::DB_HOST,
                self::DB_NAME,
                self::DB_CHARSET
            );

            self::$instance = new PDO($dsn, self::DB_USER, self::DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }

        return self::$instance;
    }

    private function __construct() {}
    private function __clone() {}
}
