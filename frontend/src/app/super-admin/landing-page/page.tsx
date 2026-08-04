"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Tabs } from "antd";
import { useRouter } from "next/navigation";
import { PageSection } from "@/components/PageSection";
import { HeroSectionPanel } from "@/components/landing-page/HeroSectionPanel";
import { LandingFaqPanel } from "@/components/landing-page/LandingFaqPanel";
import { SpecialitiesPanel } from "@/components/landing-page/SpecialitiesPanel";
import { SeoSettingsPanel } from "@/components/landing-page/SeoSettingsPanel";

type TabKey = "hero" | "faq" | "specialities" | "seo";

interface TabConfig {
  key: TabKey;
  label: string;
  title: string;
  description: string;
  helpMenuSlug: string;
}

const TAB_CONFIG: TabConfig[] = [
  {
    key: "hero",
    label: "Hero Section",
    title: "Hero Section",
    description: "Manage the landing page hero: the chat animation and the automated workflow list.",
    helpMenuSlug: "sa-hero-content",
  },
  {
    key: "faq",
    label: "Landing FAQ",
    title: "Landing FAQ",
    description: "Manage the FAQ section shown on the public landing page. Toggle items on/off and set the order they appear in.",
    helpMenuSlug: "sa-landing-faqs",
  },
  {
    key: "specialities",
    label: "Specialities",
    title: "Specialities",
    description: "Manage the master list of specialities shown across the platform. Toggle items on/off and set the order they appear in.",
    helpMenuSlug: "sa-specialities",
  },
  {
    key: "seo",
    label: "SEO Settings",
    title: "SEO Settings",
    description: "Manage meta tags and Open Graph data used for the public landing page (and future static pages).",
    helpMenuSlug: "sa-seo-settings",
  },
];

const TAB_KEYS = TAB_CONFIG.map((t) => t.key);

function readInitialTab(): TabKey {
  if (typeof window === "undefined") return "hero";
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return (TAB_KEYS as string[]).includes(tab ?? "") ? (tab as TabKey) : "hero";
}

export default function LandingPageShellPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>(() => readInitialTab());
  const [actions, setActions] = useState<ReactNode>(null);

  // Guard against stale onActionsChange calls from inactive (but still-mounted)
  // panels bleeding through into the shell's action slot.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const makeOnActionsChange = (tabKey: TabKey) => (node: ReactNode) => {
    if (activeTabRef.current === tabKey) setActions(node);
  };

  const handleChange = (key: string) => {
    const nextTab = (TAB_KEYS as string[]).includes(key) ? (key as TabKey) : "hero";
    setActiveTab(nextTab);
    setActions(null);
    router.replace(`/super-admin/landing-page?tab=${nextTab}`, { scroll: false });
  };

  const current = useMemo(
    () => TAB_CONFIG.find((t) => t.key === activeTab) ?? TAB_CONFIG[0],
    [activeTab]
  );

  const items = useMemo(
    () =>
      TAB_CONFIG.map((tab) => ({
        key: tab.key,
        label: tab.label,
        children:
          tab.key === "hero" ? (
            <HeroSectionPanel onActionsChange={makeOnActionsChange("hero")} />
          ) : tab.key === "faq" ? (
            <LandingFaqPanel onActionsChange={makeOnActionsChange("faq")} />
          ) : tab.key === "specialities" ? (
            <SpecialitiesPanel onActionsChange={makeOnActionsChange("specialities")} />
          ) : (
            <SeoSettingsPanel onActionsChange={makeOnActionsChange("seo")} />
          ),
      })),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="p-6">
      <PageSection
        title="Website Content"
        description={`${current.title} — ${current.description}`}
        helpMenuSlug={current.helpMenuSlug}
        actions={actions}
      />

      <Tabs type="line" activeKey={activeTab} onChange={handleChange} items={items} />
    </div>
  );
}
