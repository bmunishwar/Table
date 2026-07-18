# Contributing to DataTablePro

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a branch** for your feature or fix: `git checkout -b feature/my-change`
4. **Make your changes**
5. **Push** to your fork and open a **Pull Request**

## Local Development Setup

### Requirements

- PHP 8.0+
- PostgreSQL 12+
- A web server (or PHP built-in server)

### Running Locally

```bash
# Clone the project
git clone https://github.com/bmunishwar/table.git
cd table

# Set up environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=your_db
export DB_USER=your_user
export DB_PASS=your_pass

# Start the PHP development server
php -S localhost:8080 -t public
```

Open `http://localhost:8080` in your browser.

## Coding Standards

- **PHP**: PSR-12, `declare(strict_types=1)` in all files
- **JavaScript**: No framework dependencies beyond jQuery 3.7+
- **CSS**: Use CSS custom properties (variables) defined in `:root`
- **Security**: Parameterized queries only, escape all output, no inline event handlers

## What to Contribute

- Bug fixes
- Performance improvements
- New column types (e.g., currency, percentage, image)
- Accessibility improvements
- Documentation and examples
- Translations

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why
- Test your changes locally before submitting
- Update the README if you add new features or config options

## Reporting Issues

- Use GitHub Issues
- Include steps to reproduce
- Include PHP version, PostgreSQL version, and browser info
- Screenshots help for UI issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
