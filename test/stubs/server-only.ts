/**
 * `server-only` throws when imported outside a React Server Component, which is
 * the point of it. Tests still need to exercise the server modules it guards,
 * so vitest aliases the package to this empty module. Nothing here is shipped.
 */
export {};
