import '../browser-bridge/conversation-url.js';

// Use the same narrowly scoped identity rules in the server and extension.
export const sameConversation = globalThis.mokelConversationUrl.same;
