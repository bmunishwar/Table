<?php

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Base path to project root
define('BASE_PATH', dirname(__DIR__));

// Simple autoloader
spl_autoload_register(function (string $class): void {
    $dirs = [
        BASE_PATH . '/config/',
        BASE_PATH . '/models/',
        BASE_PATH . '/controllers/',
        BASE_PATH . '/helpers/',
    ];

    foreach ($dirs as $dir) {
        $file = $dir . $class . '.php';
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }
});

// ---- Simple Router ----

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';

// Strip the script directory from the URI for subdirectory installs
$basePath = dirname($scriptName);
if ($basePath !== '/' && $basePath !== '\\') {
    $requestUri = substr($requestUri, strlen($basePath)) ?: '/';
}

// Remove query string and trim slashes
$url = parse_url($requestUri, PHP_URL_PATH);
$url = trim($url ?: '/', '/');

// Block path traversal and null bytes
if (str_contains($url, '..') || str_contains($url, "\0")) {
    handleNotFound();
}

// Route dispatch
try {
    match ($url) {
        '', 'users'            => (new UserController())->index(),
        'users/data'           => (new UserController())->data(),
        'users/demo-merged'    => (new UserController())->demoMerged(),
        default                => handleNotFound(),
    };
} catch (\Throwable $e) {
    error_log('[Router] Unhandled error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    handleServerError();
}

function handleNotFound(): void
{
    http_response_code(404);

    $acceptsJson = str_contains(($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');
    $isXhr       = ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'XMLHttpRequest';

    if ($acceptsJson || $isXhr) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Route not found'], JSON_THROW_ON_ERROR);
    } else {
        echo '<!DOCTYPE html><html><head><title>404</title></head>';
        echo '<body style="font-family:sans-serif;text-align:center;padding:60px">';
        echo '<h1>404 — Page Not Found</h1>';
        echo '<p><a href="/">Go to Home</a></p>';
        echo '</body></html>';
    }
    exit;
}

function handleServerError(): void
{
    http_response_code(500);

    $acceptsJson = str_contains(($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');
    $isXhr       = ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'XMLHttpRequest';

    if ($acceptsJson || $isXhr) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Internal server error'], JSON_THROW_ON_ERROR);
    } else {
        echo '<!DOCTYPE html><html><head><title>500</title></head>';
        echo '<body style="font-family:sans-serif;text-align:center;padding:60px">';
        echo '<h1>500 — Internal Server Error</h1>';
        echo '<p>Something went wrong. Please try again later.</p>';
        echo '<p><a href="/">Go to Home</a></p>';
        echo '</body></html>';
    }
    exit;
}
