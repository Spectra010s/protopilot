# Privacy and hardware safety

## Data flow

Draft projects and chat messages are stored in the user's browser with IndexedDB. The current message, recent text history, and current project are sent to ProtoPilot's server route when the assistant is used. The server sends that context to the configured Gemma model through the Google provider. Consequently, AI requests are **not** processed only in the browser. Do not include private credentials or personal data in a prompt or project.

`GEMINI_API_KEY` belongs on the server in `.env.local` or the deployment's secret environment variables. It must never be exposed through a `NEXT_PUBLIC_` variable, committed, or included in logs and issue reports. Browser storage is local to that browser profile; clearing site data removes local drafts. There is no account or cloud backup in the current app.

## Electrical limits

AI-generated wiring and firmware are drafts. Exact part numbers, voltage and current ratings, polarity, pin capabilities, and datasheets must be checked before powering hardware. Unknown ratings remain marked as unknown. The deterministic checks catch selected patterns, including direct GPIO-to-load wiring, but do not perform circuit simulation or guarantee a safe build.

For a motor or pump, verify the driver, separate load supply, flyback protection, shared ground where required, and physical isolation from water or exposed conductors. Contributors should preserve these warnings when changing prompts, validation, or presentation.
