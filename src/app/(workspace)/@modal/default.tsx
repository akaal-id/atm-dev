// Empty slot when no modal route is active. Required in this Next.js version —
// a named parallel-route slot without default.tsx errors on hard nav instead
// of the old 404 fallback.
export default function ModalDefault() {
  return null;
}
