// Single place to bump when Meta deprecates a Graph API version — was
// previously hardcoded as a literal string in ~10 different call sites.
// Bumped v21.0 -> v25.0: the Send API on v21.0 had started rejecting valid
// message sends with a generic OAuthException code 1 ("An unknown error has
// occurred"). The identical payload/token succeeds on v25.0 (verified in
// Graph API Explorer), so the older pinned version was the cause.
export const META_GRAPH_VERSION = 'v25.0'
export const THREADS_GRAPH_VERSION = 'v1.0'
