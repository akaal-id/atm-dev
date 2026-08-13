// Non-intercepted fallback inside the @modal slot. Closing the overlay uses
// router.back() (client-side nav), which doesn't automatically clear a slot
// whose active segment no longer matches — this keeps a stray client-side
// nav to /ai-chat from leaving a stale modal on screen.
export default function AiChatModalFallback() {
  return null;
}
