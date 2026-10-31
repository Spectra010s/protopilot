# Contributing to ProtoPilot

Thanks for helping build ProtoPilot. The project is still moving quickly for a hackathon, so a small, focused contribution is easiest to review. Open an issue before starting a large feature or architectural change so we can agree on its scope.

## Get started

1. Use Node.js 22.13 or newer and the pnpm version declared in `package.json` (currently 11.8.0).
2. Fork the repository, clone your fork, and create a branch for your change.
3. Install dependencies with `pnpm install --frozen-lockfile`.
4. Copy `.env.example` to `.env.local`. Add a `GEMINI_API_KEY` if you need to exercise AI generation or revision. Never commit the key or put it in a `NEXT_PUBLIC_` variable.
5. Run `pnpm dev` and open the local URL shown in the terminal.

Browser-saved projects live in IndexedDB on your device. They are not shared with other contributors or stored in the repository.

Read the [documentation index](docs/README.md) for the current architecture and data flow. AI coding contributors should follow [AGENTS.md](AGENTS.md).

## Pick a contribution

- Check existing issues before opening a new one. For a bug, include reproduction steps, expected and actual behavior, and the relevant browser and command output. Remove keys and personal data from logs and screenshots.
- For a feature, explain the user problem and the proposed behavior. Please discuss major UI, data model, or provider changes in an issue first.
- Documentation, accessibility, and small bug fixes are welcome. Keep each pull request focused on one concern.
- Report security issues privately; do not post exploit details or secrets in a public issue. Use GitHub's private vulnerability reporting if the repository has it enabled, or contact the maintainer privately.

## Work on the code

- Follow the existing TypeScript, React, and Tailwind patterns. The app uses the Next.js App Router. **Before changing Next.js code**, read the relevant guide in the installed `node_modules/next/dist/docs/`; this repository's Next.js version differs from older conventions.
- Keep the versioned project schema and its derived breadboard, schematic, wiring, firmware, and checks consistent. Changes to a project's meaning should include an appropriate verification path. See [Project model](docs/project-model.md).
- Treat generated circuit details and safety checks as guidance, not as a guarantee that hardware is safe. Do not imply that unverified ratings or wiring are confirmed.
- Add tests when they verify behavior or guard a regression. Avoid tests that only restate the implementation.
- Do not commit `.env.local`, API keys, generated build files, or unrelated changes.

## Check your change

Run the checks relevant to your change before opening a pull request:

```bash
pnpm typecheck
pnpm lint
pnpm test:storage
pnpm build
```

If a check cannot run or fails for an unrelated reason, say so in the pull request. For UI changes, describe the browser and viewport you checked and include screenshots when they help reviewers.

## Open a pull request

Describe what changed, why it changed, how you checked it, and any remaining limitations. Link the related issue if there is one. A maintainer may ask for adjustments as the hackathon project evolves.
