# Contributing Guide

Thank you for considering contributing to **Notes Between Us**!

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/Note-Between-Us.git
   cd Note-Between-Us
   ```
3. **Create a new branch** for your contribution:
   ```bash
   git checkout -b my-feature-branch
   ```
4. **Install dependencies**:
   ```bash
   npm ci
   ```
5. **Run the test suite** to ensure everything passes:
   ```bash
   npm test
   ```
6. Make your changes, **add** and **commit** them with clear messages.
7. **Push** the branch to your fork and open a Pull Request against the `main` branch of the upstream repository.

## Code Style

- Use the existing code style (Prettier/ESLint if configured).
- Prefer `async/await` over callbacks.
- Keep imports grouped and alphabetized.
- Write or update tests for new functionality.

## Pull Request Checklist

- [ ] Code builds (`npm run build`).
- [ ] All tests pass (`npm test`).
- [ ] Lint passes (`npm run lint`).
- [ ] No sensitive data is added (check `.gitignore`).
- [ ] Documentation is updated if needed.

## Secrets & Credentials

Never commit real secrets. Use `.env.example` for placeholders and ensure actual `.env` is listed in `.gitignore`.

---
*For more detailed guidelines, see the `README.md` and the CI workflow.*