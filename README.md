# Parlance

**Same thought. Different voice.**

Parlance rewrites text between recognizable writing styles: plain English into
LinkedIn speak, corporate phrasing back into ordinary language, and more.
The goal is to change the expression without inventing facts or losing the point.

## Intended experience

Choose a source and target style, adjust the intensity, and generate a rewrite in
a two-panel interface. The initial styles are **Human, LinkedIn, Corporate,
Startup Founder, and Academic**, with Human to LinkedIn as the default.

The planned release includes real streaming, reverse/swap, copy, regenerate, and
stop controls. No account or conversation setup is required. Optional history
stays in the browser and is off by default.

## Status

The first release targets **v1.0.0**. The application is in early development:
the current UI exposes Human to LinkedIn at Balanced intensity, while the initial
server path supports Human to LinkedIn and LinkedIn to Human. Evaluation results
have not been published and no release has been made.

## Technical direction

Next.js, TypeScript, and Tailwind CSS, with one server-side Gemini integration.
No application database, cloud text history, or analytics service is planned.
Model selection and generation settings are versioned in code; credentials stay
in server environment configuration.

Live generation sends text to the configured provider. The product specification
defines the required disclosure, data handling, and launch restrictions. A
credential-free example mode is available for development and preview deployments.
Generated text must be reviewed rather than treated as guaranteed faithful to the
original.

## Run locally

Requires Node.js 24 (see `.nvmrc`).

```bash
npm ci
npm run dev
```

Without any environment configuration the app runs in demo mode: examples are
shown, no model is called, and no API key is needed. Live generation requires
the server settings described in [`.env.example`](.env.example).

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Documentation

The [product specification](docs/product-spec.md) defines behavior, architecture,
privacy boundaries, evaluation, and release acceptance.
[Repository instructions](AGENTS.md) cover development conventions.

## License

[MIT](LICENSE). Parlance is an independent project, not affiliated with or endorsed
by LinkedIn. Third-party services have their own terms.
