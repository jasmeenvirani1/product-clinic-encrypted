"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Divider, Spin } from "antd";
import { Plus } from "lucide-react";
import {
  whatsappQrService,
  type WhatsAppSessionInfo,
} from "@/services/aiSetting.service";
import { WhatsAppQrConnect } from "./WhatsAppQrConnect";

type Props = {
  /** Where to send the user once a number connects (the conversations module). */
  conversationsPath: string;
};

/**
 * Manage MULTIPLE WhatsApp numbers for one clinic. Each linked number is a
 * "slot"; this renders one WhatsAppQrConnect widget per slot plus an
 * "Add another number" action (up to the backend's maxSlots).
 *
 * Inbound messages from every linked number land in the same Conversations
 * inbox; replies automatically go back out the number the patient messaged.
 */
export function WhatsAppMultiConnect({ conversationsPath }: Props) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<WhatsAppSessionInfo[]>([]);
  const [maxSlots, setMaxSlots] = useState(5);
  // Slots to SHOW widgets for. Always includes every persisted slot; the "Add"
  // button reveals the next empty slot so the user can scan a new number.
  const [visibleSlots, setVisibleSlots] = useState<number[]>([1]);

  const load = useCallback(async () => {
    try {
      const res = await whatsappQrService.sessions();
      const rows = res.sessions ?? [];
      setSessions(rows);
      setMaxSlots(res.maxSlots ?? 5);
      const persisted = rows.map((r) => r.slot);
      // Show all persisted slots, and slot 1 at minimum.
      setVisibleSlots((prev) => {
        const merged = Array.from(new Set([1, ...persisted, ...prev])).sort((a, b) => a - b);
        return merged;
      });
    } catch {
      /* transient */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const labelFor = (slot: number) => {
    const s = sessions.find((x) => x.slot === slot);
    const suffix = s?.label ? ` · ${s.label}` : "";
    return `Number ${slot}${suffix}`;
  };

  const highestSlot = Math.max(...visibleSlots, ...sessions.map((s) => s.slot), 1);
  const canAddMore = highestSlot < maxSlots;

  const addNumber = () => {
    const next = highestSlot + 1;
    setVisibleSlots((prev) => Array.from(new Set([...prev, next])).sort((a, b) => a - b));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 p-8">
        <Spin />
        <p className="text-xs text-slate-500">Loading WhatsApp numbers…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {visibleSlots.map((slot, idx) => (
        <div key={slot}>
          {idx > 0 && <Divider className="!my-2" />}
          <WhatsAppQrConnect
            slot={slot}
            title={labelFor(slot)}
            conversationsPath={conversationsPath}
            // Only the first number auto-redirects to the inbox; adding a 2nd
            // number shouldn't yank the user away from this settings screen.
            autoRedirect={slot === 1}
            onChanged={() => void load()}
            totalSlotCount={visibleSlots.length}
            onRemoved={(removedSlot) =>
              setVisibleSlots((prev) => prev.filter((s) => s !== removedSlot))
            }
          />
        </div>
      ))}

      {canAddMore && (
        <>
          <Divider className="!my-2" />
          <Button
            type="dashed"
            icon={<Plus size={14} />}
            onClick={addNumber}
            block
          >
            Add another WhatsApp number
          </Button>
        </>
      )}
    </div>
  );
}

export default WhatsAppMultiConnect;
