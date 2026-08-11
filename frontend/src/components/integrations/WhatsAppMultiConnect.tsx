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
  // `null` = unlimited plan (Enterprise/Custom). Only fall back to 5 when
  // `maxSlots` is truly absent from a malformed response (undefined), never
  // when the backend deliberately sends `null` to mean "unlimited".
  const [maxSlots, setMaxSlots] = useState<number | null>(5);
  const [used, setUsed] = useState(0);
  // Slots to SHOW widgets for. Always includes every persisted slot; the "Add"
  // button reveals the next empty slot so the user can scan a new number.
  const [visibleSlots, setVisibleSlots] = useState<number[]>([1]);

  const load = useCallback(async () => {
    try {
      const res = await whatsappQrService.sessions();
      const rows = res.sessions ?? [];
      setSessions(rows);
      setMaxSlots(res.maxSlots === undefined ? 5 : res.maxSlots);
      setUsed(res.used ?? rows.length);
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
  // maxSlots === null means an unlimited plan — always allow adding more.
  const canAddMore = maxSlots === null || highestSlot < maxSlots;

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
            // Dropping the removed slot's card is normally correct (it frees
            // that slot number so "Add another number" can re-offer it), but
            // slot 1 must always stay visible as the tenant's primary connect
            // entry point — this became reachable once removal of a tenant's
            // *only* remaining slot was allowed (issue #46 fix): a 1-number-
            // plan tenant removing their sole slot 1 would otherwise be left
            // with an empty visibleSlots array and no "Connect WhatsApp" card
            // to click at all.
            onRemoved={(removedSlot) =>
              setVisibleSlots((prev) => {
                const next = prev.filter((s) => s !== removedSlot);
                return next.includes(1) ? next : [1, ...next];
              })
            }
          />
        </div>
      ))}

      <p className="text-xs text-slate-500">
        {maxSlots === null ? `${used} numbers connected` : `${used} of ${maxSlots} numbers used`}
      </p>

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
