---
name: React context + Vite HMR pitfalls
description: Why context hooks should not throw, and why auto-create effects must guard with refs
---

## Context hooks should return a safe fallback, not throw
**Why:** During Vite HMR, a hot-updated component can momentarily render with a stale provider module, so `useContext` returns undefined and a throwing hook crash-loops the whole tree. Stack traces then point at *old* module lines, which is misleading — the browser may be running a stale HMR module graph even after the fix is on disk. Restarting the dev server forces a full client reload and clears it.
**How to apply:** In `useX()` hooks, return a typed DEFAULT_CONTEXT fallback instead of throwing. When browser errors reference code that no longer exists on disk, restart the dev workflow before debugging further.

## Auto-create effects need a ref guard
**Why:** An effect that creates a default record when a list is empty, with mutation state in its deps, re-fires on every mutation state change → created ~500 duplicate rows once.
**How to apply:** Guard one-shot creation with `useRef(false)`, and keep effect deps to the data being observed (e.g. `[items, isLoading]`), never the mutation object.
