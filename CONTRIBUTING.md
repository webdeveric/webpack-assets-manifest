# Contributing

## Setup

```bash
git clone https://github.com/webdeveric/webpack-assets-manifest.git
cd webpack-assets-manifest
corepack enable
pnpm install --frozen-lockfile
```

## Testing

Run tests

```bash
pnpm test
```

Run tests and generate a coverage report. Please keep the code coverage at 100%.

```bash
pnpm coverage
```

## Commit messages

Commit messages should follow [conventional commits](https://www.conventionalcommits.org/).

Releases are created automatically and the version bump is determined from the commit messages.

## Pull requests

Pull requests are welcome. If you want to add a large feature or breaking change, please open an issue first so it can be discussed.
