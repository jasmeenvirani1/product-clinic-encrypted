"use client";

import { SuperAdminConversationsView } from "../_ConversationsView";

export default function SuperAdminConversationByIdPage({ params }: { params: { id: string } }) {
  return <SuperAdminConversationsView initialId={params.id} />;
}
