// A throttled stat prediction must be rejected explicitly, never left unacknowledged.
// This only advances the operation receipt; it grants no points or allocations.
export function rejectRateLimitedStatOp(state, msg) {
  if (!state?.persist || msg?.t !== 'op' || !['alloc', 'alloc_batch', 'reset'].includes(msg.op)
      || !Number.isSafeInteger(msg.n) || msg.n <= state.ack) return false;
  state.ack = msg.n;
  return true;
}
