# Cybership Carrier Integration

This repository contains a TypeScript implementation of a UPS carrier integration service, designed for extensibility and production readiness.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

```bash
npm install
```

### Running Tests

The project includes a comprehensive integration test suite that mocks UPS API responses using Nock.

```bash
npm test
```

### Code Quality

Run format to clean and standardize code style:

```bash
npm run format
```

Run lint to check for warnings and errors:

```bash
npm run lint
```

Run type check:

```bash
npm run typecheck
```

## Project Structure

```
ups-test/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── tsconfig.json
├── src/
│   ├── carriers/
│   │   ├── ups/
│   │   │   ├── index.ts
│   │   │   ├── UpsAuthClient.ts
│   │   │   └── UpsRateClient.ts
│   │   └── types.ts
│   ├── config/
│   │   └── index.ts
│   ├── domain/
│   │   └── models.ts
│   ├── errors/
│   │   └── CarrierError.ts
│   ├── transport/
│   │   └── HttpClient.ts
│   ├── dev.ts
└── tests/
    ├── fixtures/
    │   ├── upsRate.malformed.txt
    │   ├── upsRate.rateLimited.json
    │   ├── upsRate.success.json
    │   ├── upsRate.unauthorized.json
    │   └── upsToken.success.json
    └── integration/
        └── ups.rateShop.test.ts
```

## Design Decisions

### Architecture

The project follows a hexagonal architecture pattern with clear separation of concerns:

- **Domain (`src/domain`):** Contains the core business logic and models (e.g., `RateRequest`, `RateQuote`). These are pure TypeScript interfaces and Zod schemas, independent of any specific carrier implementation.
- **Carriers (`src/carriers`):** Implementation of specific carrier logic.
  - **`types.ts`**: Defines the `CarrierClient` interface that all carriers must implement, ensuring pluggability.
  - **`ups/`**: The UPS-specific implementation.
    - **`UpsAuthClient`**: Handles OAuth token acquisition, caching, and refresh.
    - **`UpsRateClient`**: Handles mapping domain models to UPS request format and normalizing the response.
- **Transport (`src/transport`):** A thin `HttpClient` wrapper around `fetch` to handle common concerns like timeouts and error normalization.

### Error Handling

A unified `CarrierError` class is used throughout the application. It maps low-level errors (network, HTTP status codes) and carrier-specific error codes to a standardized set of error codes (e.g., `RATE_LIMITED`, `AUTH_FAILED`, `VALIDATION_FAILED`). This allows the consuming application to handle errors consistently regardless of the underlying carrier.

### Extensibility

Adding a new carrier (e.g., FedEx) would involve:

1. Creating a new directory `src/carriers/fedex`.
2. Implementing the `CarrierClient` interface.
3. Adding a factory function similar to `createUpsClient`.

The core domain logic would remain untouched.

## Future Improvements

Given more time, I would:

- **Implement additional operations:** `createLabel`, `track`, `voidLabel` as mostly stubbed in `CarrierClient`.
- **Enhanced Resiliency:** Implement retry logic with exponential backoff for `RATE_LIMITED` and generic network errors within the `HttpClient`.
- **Logging:** Integrate a structured logger (e.g., Pino) for better observability.
- **Metrics:** Add instrumentation to track API latency and error rates.
- **Caching Strategy:** Use a distributed cache (Redis) for token storage to support multiple instances of the service.
