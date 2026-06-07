# Entry Server API Probe

Use this reference when save, copy, duplicate, or load must interact with PlayEntry servers.

## Safe Default

Never request credentials. Start with non-mutating observation:

```powershell
node .\scripts\entry_server_probe.js --mode block --out .\server-probe.json
```

The probe records:

- likely login state
- cookie names only, never cookie values
- localStorage/sessionStorage keys
- relevant network resource URLs
- Entry global names containing save/load/copy/project/workspace
- UI text hints for save, copy, login, and project list flows

## Mutating Trace

Only use this when an authenticated browser session is already present and the user requested server persistence:

```powershell
node .\scripts\entry_server_probe.js --mode block --trace-save --out .\server-save-trace.json
```

`--trace-save` dispatches the workspace save event and captures new network resources. Treat the result as a map, not as proof of durable persistence. Verify by loading the project list or re-opening the saved project.

## Server Boundaries

Use local JSON export as the source of truth. Use server save/copy/load as a convenience layer because it depends on account state, CSRF/session policy, and PlayEntry UI changes.

