/**
 * Shared between server (autoEscalation) and client (widget page).
 * Must stay free of server-only imports so the widget can use it.
 */
export const AUTO_ESCALATION_SYSTEM_PROMPT =
    "Looks like I'm having trouble finding a good answer. Drop your email below and I'll connect you with a human.";

export const AUTO_ESCALATION_THANKS_PROMPT =
    "Thanks — an agent will join shortly.";
