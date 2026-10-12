# Mimus

Translate meaning, not just words.

Mimus rewrites text between recognizable writing styles: plain English into
LinkedIn speak, corporate phrasing back into ordinary language, and more.
The goal is to change the expression without inventing facts or losing the point.

## Intended experience

Choose a source and target style, adjust the intensity, and generate a rewrite in
a two-panel interface. The initial styles are **Human, LinkedIn, Corporate,
Startup Founder, and Academic**, with Human to LinkedIn as the default.

The interface provides streaming output, reverse/swap, copy, regenerate, and
stop controls. No account or conversation setup is required. Optional history
stays in the browser and is off by default.

## Status

Mimus has not been released. The first release is planned as **v1.0.0**, and no
release or release tag exists yet.

- **Production** at [https://mimus-rewrite.vercel.app](https://mimus-rewrite.vercel.app) runs in examples-only demo
mode. Live inference is not enabled there, so no model is called.
- The translator supports all five styles and their directions at three
intensities in demo and live modes, with a /privacy page, opt-in local
history, and local preferences.
- Milestone 3 browser checks (layout, reduced motion, target sizes, contrast)
are recorded in [docs/decisions.md](docs/decisions.md), including what remains
unverified.
- The release-candidate configuration (`gemini-3.5-flash-lite`, prompt v4, high
thinking) was evaluated and reviewed. The Milestone 4 evaluation was run before
the rename and has not been re-run; the model configuration and prompt are
unchanged. See [evals/results/summary.md](evals/results/summary.md) for scores,
revised targets, and documented limitations.
- The WAF rate-limit rule and demo-mode 503 behavior were verified on the former
production host, `parlance-tan.vercel.app`, on 2026-10-07. That host has been
removed. These behaviors have not been re-verified on the current production
URL. Deployed live streaming, abort, and region checks remain pending. See
[docs/deployment.md](docs/deployment.md).



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
the server settings described in `[.env.example](.env.example)`.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`.

## Documentation

The [product specification](docs/product-spec.md) defines behavior, architecture,
privacy boundaries, evaluation, and release acceptance.
[Repository instructions](AGENTS.md) cover development conventions.

## License

[MIT](LICENSE). Mimus is an independent project, not affiliated with or endorsed
by LinkedIn. Third-party services have their own terms.