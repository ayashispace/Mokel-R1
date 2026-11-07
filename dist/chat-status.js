// Track completion as an unread notification, rather than permanent idle state.
export function chatStatus(chat, isOpen = false) {
  const running = !!(chat.pending || chat.initializing || chat.initializationPending || chat.nativeRunning || chat.agent?.connection?.busy);
  if (running) {
    chat.statusWasRunning = true;
    chat.completedUnread = false;
    return 'running';
  }
  if (chat.statusWasRunning) {
    chat.statusWasRunning = false;
    chat.completedUnread = !isOpen;
  }
  if (isOpen) chat.completedUnread = false;
  return chat.completedUnread ? 'done' : '';
}
