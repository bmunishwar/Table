<?php

declare(strict_types=1);

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
    $requestUri = substr($requestUri, strlen($basePath));
}

// Remove query string and trim slashes
$url = parse_url($requestUri, PHP_URL_PATH);
$url = trim($url ?: '/', '/');

// Route dispatch
match ($url) {
    '', 'users'            => (new UserController())->index(),
    'users/data'           => (new UserController())->data(),
    'users/demo-merged'    => (new UserController())->demoMerged(),
    default                => handleNotFound(),
};

function handleNotFound(): void
{
    http_response_code(404);

    // If it looks like an AJAX/API request, return JSON
    $acceptsJson = str_contains(($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');
    $isXhr       = ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'XMLHttpRequest';

    if ($acceptsJson || $isXhr) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Route not found']);
    } else {
        echo '<!DOCTYPE html><html><head><title>404</title></head>';
        echo '<body style="font-family:sans-serif;text-align:center;padding:60px">';
        echo '<h1>404 — Page Not Found</h1>';
        echo '<p><a href="/">Go to Home</a></p>';
        echo '</body></html>';
    }
    exit;
}
