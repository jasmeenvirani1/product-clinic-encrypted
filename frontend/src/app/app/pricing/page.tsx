"use client";

import { Button, Card, Input, List } from "antd";
import { PageSection } from "@/components/PageSection";

const packages = [
  { name: "Essential Package", price: "₺2,300.00", description: "Consultation, hotel guidance, airport pickup." },
  { name: "Premium Package", price: "₺3,850.00", description: "VIP transfer, translator, extended post-op care." },
  { name: "Signature Package", price: "₺5,200.00", description: "Custom surgical planning and concierge support." },
];

export default function PricingPage() {
  return (
    <div className="">
      <PageSection eyebrow="Clinic CRM" title="Pricing" description="Editable package cards for clinic sales teams." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {packages.map((item) => (
            <Card key={item.name} className="crm-card">
              <p className="text-sm text-slate-500">{item.name}</p>
              <h3 className="mt-3 text-3xl font-semibold text-slate-900">{item.price}</h3>
              <p className="mt-3 text-sm text-slate-600">{item.description}</p>
            </Card>
          ))}
        </div>
        <Card className="crm-card crm-form border-0">
          <h3 className="text-lg font-semibold text-slate-900">Edit pricing block</h3>
          <div className="mt-4 space-y-4">
            <Input addonBefore="Package name" defaultValue="Premium Package" />
            <Input addonBefore="Price" defaultValue="₺3,850.00" />
            <Input.TextArea rows={5} defaultValue="VIP transfer, translator, extended post-op care." />
            <Button type="primary">Save pricing update</Button>
          </div>
          <List
            className="mt-6"
            header="Sales notes"
            dataSource={["Keep package copy short in chats.", "Lead with value, then explain optional add-ons.", "Highlight translator and hotel options for travel leads."]}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        </Card>
      </div>
    </div>
  );
}
