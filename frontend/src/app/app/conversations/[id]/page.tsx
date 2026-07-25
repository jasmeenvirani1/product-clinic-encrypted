"use client";

import { ConversationsView } from "../_ConversationsView";

export default function ConversationByIdPage({ params }: { params: { id: string } }) {
  return <ConversationsView initialId={params.id} />;
}
