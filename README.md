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

The first release targets **v1.0.0**. This repository currently contains the
product specification and development guidance; the application and evaluation
results have not been released yet.

## Technical direction

Next.js, TypeScript, and Tailwind CSS, with one server-side Gemini integration.
No application database, cloud text history, or analytics service is planned.
Model selection and generation settings are versioned in code; credentials stay
in server environment configuration.

Live generation sends text to the configured provider. The product specification
defines the required disclosure, data handling, and launch restrictions; a
credential-free example mode is also planned. Generated text must be reviewed
rather than treated as guaranteed faithful to the original.

## Documentation

The [product specification](docs/product-spec.md) defines behavior, architecture,
privacy boundaries, evaluation, and release acceptance.
[Repository instructions](AGENTS.md) cover development conventions.

## License

[MIT](LICENSE). Parlance is an independent project, not affiliated with or endorsed
by LinkedIn. Third-party services have their own terms.
