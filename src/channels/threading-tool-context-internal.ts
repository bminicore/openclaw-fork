import type { ChannelThreadingToolContext } from "./plugins/types.public.js";

/** Host-only turn correlation carried beside the plugin-facing threading contract. */
export type InternalChannelThreadingToolContext = ChannelThreadingToolContext & {
  currentSourceTurnId?: string;
  /** Host-minted delivery owner for one stranded-reply recovery turn. */
  currentDeliveryRunId?: string;
};
