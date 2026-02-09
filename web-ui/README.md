# 10.000 (Farkle) Game

A web-based implementation of the dice game **10.000** (Farkle), built with React, Vite, and TailwindCSS.

## Features

- **Single Player vs AI**: Play against a "Greedy" bot or the "Gemini" AI agent.
- **Rule Set**: Strict 10.000 rules with "Hot Hand" and "Doubling" mechanics.
- **Modular Rules**: Rules are defined in `src/FarkleRules.md`.

## Getting Started

1.  **Install dependencies**:

    ```bash
    pnpm install
    ```

2.  **Setup Environment Variables**:
    - Create a `.env.local` file in the `web-ui` directory.
    - Add your Gemini API Key:
      ```env
      VITE_GEMINI_API_KEY=your_api_key_here
      ```
      _(Note: A `.env` with a demo key has been created or you)_

3.  **Run Development Server**:
    ```bash
    pnpm run dev
    ```

## AI Agents

- **Greedy**: A simple heuristic bot that banks immediately after keeping max points.
- **Gemini**: Powered by Google's `gemini-3-pro-preview` model via the `@google/genai` SDK.
- **Custom**: Allows you to connect your own REST API agent. You must provide a URI that adheres to our [OpenAPI 3.1 specification](docs/custom-agent-api.json).

## Custom Agent API

To implement your own agent:

1.  Review the [OpenAPI spec](docs/custom-agent-api.json) for the expected request/response format.
2.  Your server should expose a `POST /move` (or similar, you provide the full URI) endpoint.
3.  The engine will send the full `GameState` and expects an `AgentMove` response.
