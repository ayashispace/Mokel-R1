// A conservative UI hint, never an authorization or an action generator.
export function requestsPCAction(text){
 const value=String(text).trim();
 if(/^(?:how\b|what\b|why\b|explain\b|show me how\b|teach me\b|give me (?:code|instructions)\b)/i.test(value))return false;
 if(/^(?:(?:please|can you|could you|would you)\s+)*(?:lock|restart|reboot|shut\s?down|shutdown)\s+(?:(?:my|the)\s+)?(?:pc|computer|laptop|workstation)\b/i.test(value))return true;
 return /^(?:(?:please|can you|could you|would you|i (?:want|need) you to)\s+)*(?:create|make|write|edit|update|modify|change|rename|delete|remove|read|list|open|save|add|append|replace)\b/i.test(value)&&/\b(?:file|folder|directory|workspace|desktop|pc|computer)\b|[\w-]+\.(?:txt|md|json|js|py|html|css|csv)\b/i.test(value);
}
