
"use client";

import React from 'react';
import { Spin } from 'antd';
import { APP_NAME, COPYRIGHT_YEAR } from './constants/brand';
import { useThemeColors } from '@/providers/ThemeProvider';
import { LogoMark } from './components/LogoMark';
import type { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import {
  MessageSquare,
  Bot,
  CalendarCheck,
  BellRing,
  Users,
  Receipt,
  BarChart3,
  Check,
  Menu,
  X,
  Play,
  ArrowRight,
  Plug,
  SlidersHorizontal,
  Rocket,
  Clock,
  Sparkles,
  Star,
  Stethoscope,
  Scissors,
  HeartPulse,
  FlaskConical,
  Activity,
  Sparkle,
  Eye,
  Brain,
  ChevronDown,
  ShieldCheck,
  Phone,
  MoreVertical,
  CalendarDays,
  MapPin,
  Paperclip,
  Mic,
  CheckCheck,
  ArrowLeft,
  Camera,
  Smile,
  User,
  Building2,
  Microscope,
  ClipboardList,
  Heart,
  Bone,
  UserRound,
  Dumbbell,
  Droplet,
  FileText,
  BadgePlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { HeroSlider, DEFAULT_HERO_CONTENT } from '@/components/hero/HeroSlider';
import type { HeroContent } from '@/services/hero.service';
import { specialityService, type Speciality } from '@/services/speciality.service';

// ─── Design tokens (driven by Theme Management) ─────────────────────────────────
// These read the live CSS custom properties written by ThemeProvider
// (src/providers/ThemeProvider.tsx) from the configured brand palette, so the
// landing page tracks whatever primary/secondary colours the super-admin sets in
// Theme Settings. CSS vars work in inline styles at any scope (no hook needed),
// which keeps the module-level <Eyebrow> component working unchanged.
const NAVY = 'var(--color-primary)';                                   // primary accent
const NAVY_SOFT = 'var(--color-primary-hover)';                        // lighter primary for gradients / hover surfaces
const TINT = 'var(--color-secondary)';                                 // secondary — raw brand secondary colour
const PILL = 'color-mix(in srgb, var(--color-primary) 8%, #fff)';      // eyebrow pill background
// Eyebrow pill background on a primary band. The band itself is already primary,
// so a light chip would wash out the bright ACCENT label sitting on it. Darkening
// the chip instead keeps the pill distinct from the band and lets ACCENT stay
// legible — without touching the label colour or the section background.
const PILL_ON_PRIMARY = 'color-mix(in srgb, #000 22%, var(--color-primary))';
const HEADING = 'var(--color-brand-heading)';                          // heading text
const BODY = 'var(--color-text-body)';                                 // body / muted text
const CARD_BG = 'color-mix(in srgb, var(--color-secondary) 35%, #fff)'; // theme-tinted card surface
const SURFACE = 'var(--color-brand-card)';                             // card/panel surface — themed "white"
const ACCENT = 'var(--color-secondary-accent)';                        // secondary accent — pill text on primary bands
// Body copy sitting on a primary-coloured band: a translucent wash of the card
// surface, so it tracks the theme instead of being hardcoded 70% white.
const ON_PRIMARY_MUTED = 'color-mix(in srgb, var(--color-brand-card) 70%, transparent)';
// Unfilled track / hairline on a primary band — faint wash of the card surface.
const ON_PRIMARY_TRACK = 'color-mix(in srgb, var(--color-brand-card) 25%, transparent)';
// Integration diagram connectors: pale tints of primary, so the wires match the
// primary-coloured pulse dot that travels them instead of being fixed indigo.
const WIRE = 'color-mix(in srgb, var(--color-primary) 28%, #fff)';      // wire stroke
const WIRE_NODE = 'color-mix(in srgb, var(--color-primary) 38%, #fff)'; // node ring — slightly stronger

// Primary with alpha, for shadows/glows — uses the rgb var ThemeProvider exposes.
const navyAlpha = (a: number) => `rgba(var(--color-primary-rgb), ${a})`;

// ─── Featured pricing card ("most popular") ────────────────────────────────────
// The highlighted tier is inverted against the two plain white cards: filled with
// the theme primary (NAVY), so it tracks whatever palette the super-admin
// configures. Its feature checks sit in soft translucent chips and its type steps
// down from near-white to muted, mirroring the light cards' hierarchy.
const PLAN_DARK_CHIP = 'color-mix(in srgb, #fff 10%, transparent)';   // check-icon chip / badge fill
const PLAN_DARK_TEXT = '#f1f5f9';                                      // primary type on the featured card
const PLAN_DARK_MUTED = 'color-mix(in srgb, #fff 62%, transparent)';   // secondary type on the featured card

interface PlanFeatureFlags {
  whatsapp_multi_connection?: boolean;
  dedicated_clinic_page?: 'none' | 'video_upload_only' | 'full_access';
  chapter_instagram_integration?: boolean;
  instagram_realtime_fetch?: boolean;
  chapter_creation?: boolean;
  video_like?: boolean;
  automatic_website_generation?: boolean;
}

interface PlanData {
  id: number;
  plan_name: string;
  price: number;
  monthly_price: number;
  yearly_price: number;
  period: 'monthly' | 'yearly';
  features: string[];
  feature_flags?: PlanFeatureFlags;
}


interface FooterPageLink {
  id: number;
  title: string;
  slug: string;
  footer_label: string | null;
}

// ─── Copy ───────────────────────────────────────────────────────────────────────
const t = {
    // Nav
    nav: [
      { label: 'Home', href: '#home' },
      { label: 'Features', href: '#solution' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Integration', href: '#integration' },
      { label: 'Profiles', href: '/profiles', type: 'route' as const },
      { label: 'FAQ', href: '#faq' },
      { label: 'Contact', href: '#cta' },
    ],
    navCta: 'Book Demo',

    // Hero
    heroBadge1: 'Built for healthcare operations',
    heroBadge2: 'HIPAA-ready infrastructure',
    heroTitle1: 'Your Clinic Never',
    heroTitle2: 'Misses Another Patient',
    heroTitle3: 'Again.',
    heroSubtitle:
      'ClinicFlow is the AI front desk that answers, books, and follows up with every patient — on WhatsApp, call, or web — 24/7, without adding staff.',
    heroCta1: 'Get Started Free',
    heroCta2: 'Watch Demo',

    // Phone chat mockup (WhatsApp appointment booking)
    chatName: `${APP_NAME} AI Receptionist`,
    chatSub: 'Business Account',
    chatToday: 'Today',
    chatWelcome: 'Hi Sarah 👋\nWelcome to GreenCare Clinic. How can I help you today?',
    chatWelcomeTime: '10:30 AM',
    chatUser1: "I'd like to book an appointment with Dr. Wilson tomorrow.",
    chatUser1Time: '10:31 AM',
    chatSlotsIntro: "Absolutely. I'd be happy to help you book an appointment with Dr. Wilson. Here are the available slots for tomorrow:",
    chatSlotsTime: '10:31 AM',
    chatSlots: ['10:20 AM', '12:15 PM', '03:45 PM'],
    chatSlotsMore: 'View more slots',
    chatUser2: '12:15 PM works for me.',
    chatUser2Time: '10:32 AM',
    chatConfirmTitle: 'Appointment Confirmed!',
    chatConfirmBody: "Your appointment with Dr. Wilson is scheduled for tomorrow at 12:15 PM. You'll receive a reminder before your appointment.",
    chatConfirmTime: '10:37 AM',
    chatDetailsTitle: 'Appointment Details',
    chatDetails: [
      { label: 'Doctor', value: 'Dr. Wilson' },
      { label: 'Date', value: 'Tomorrow' },
      { label: 'Time', value: '12:15 PM' },
      { label: 'Location', value: 'GreenCare Clinic' },
    ],
    chatDetailsTime: '10:37 AM',
    chatInput: 'Type a message',

    // Stat bar
    stats: [
      { val: '80%', label: 'less manual work' },
      { val: '15+ hrs', label: 'saved weekly' },
      { val: '24/7', label: 'AI receptionist' },
    ],

    // Video band
    videoTag: 'See it in action',
    videoTitle: 'Watch how ClinicFlow handles a real patient conversation.',

    // Problem
    problemBadge: 'The Problem',
    problemTitle: "Your Front Desk Can't Be Everywhere at Once",
    problemSubtitle:
      'Front desks are buried in calls, spreadsheets and follow-ups — while patients wait, and revenue quietly leaks away.',
    problemItems: [
      { t: 'No-shows go untracked', d: 'Without automated reminders, clinics lose 15—20% of booked slots to silent no-shows.' },
      { t: 'Follow-ups fall through', d: 'Post-visit check-ins, review requests, and re-booking reminders get forgotten — and with them, repeat revenue.' },
      { t: 'Front desk overwhelmed', d: 'One or two staff members juggle calls, WhatsApp, walk-ins and billing questions at once — so patients wait, and quality drops.' },
      { t: 'Records live everywhere', d: 'Patient details are scattered across registers, spreadsheets and WhatsApp chats — nothing is synced, nothing is searchable.' },
      { t: "Invoices don't add up", d: 'Manual billing means delayed invoices, missed insurance follow-ups, and disputes that eat into staff time.' },
      { t: 'Teams are stretched thin', d: "Hiring more front-desk staff doesn't scale with patient volume — and burnout leads to mistakes and turnover." },
    ],

    // Solution
    solutionBadge: 'The Solution',
    solutionTitle: 'One AI Receptionist, Fully Connected Across Every Patient Touchpoint - From First Contact to Follow-Up.',
    solutionSubtitle:
      'ClinicFlow unifies every channel into a single intelligent workforce that talks to patients, books them in, and keeps your calendar full — automatically.',
    solutionCards: [
      { icon: 'bot', t: 'AI Chatbot & Virtual Receptionist', d: 'Answers patient questions instantly across WhatsApp, Instagram, and your website in any language.' },
      { icon: 'calendar', t: 'Smart Appointment Booking', d: 'Checks availability and books qualified patients straight into your calendar — no back-and-forth.' },
      { icon: 'bell', t: 'Automated Reminders & Follow-ups', d: 'Cuts no-shows with timely reminders and re-engages patients who went quiet.' },
      { icon: 'users', t: 'Lead Capture & CRM Sync', d: 'Every conversation becomes a structured lead, synced to your CRM in real time.' },
      { icon: 'receipt', t: 'Billing & Insurance Query Handling', d: 'Answers common billing and insurance questions so staff focus on care, not admin.' },
      { icon: 'chart', t: 'Real-Time Analytics Dashboard', d: 'See bookings, response times, and revenue impact live from a single dashboard.' },
    ],

    // How it works
    howBadge: 'How It Works',
    howTitle: 'Set Up in 3 Simple Steps',
    howSteps: [
      { icon: 'plug', t: 'Connect', d: 'We integrate with your website, WhatsApp, and calendar — no technical work needed on your end.' },
      { icon: 'sliders', t: 'Customize', d: "We train the AI on your hospital's services, doctors, timings, and FAQs — fully branded to you." },
      { icon: 'rocket', t: 'Go Live', d: 'Your AI receptionist starts working immediately — booking appointments and answering patients 24/7.' },
    ],

    // Results
    resultsBadge: 'Results',
    resultsTitle: 'The Numbers Speak for Themselves',
    resultsSubtitle: "See exactly how much revenue you're leaving on the table and how many hours ClinicFlow will save your team each month.",
    resultsPoints: [
      '40% reduction in no-shows',
      '24/7 patient response — even at 2 AM',
      '3x faster appointment booking',
      '60% less manual front-desk workload',
    ],

    // Integration
    integrationBadge: 'Integration',
    integrationTitle: 'Connects with the tools you already run on.',
    integrationHub: 'AI WORKFORCE',
    integrationHubSubtitle: 'Your Intelligent Automation Layer',
    integrationLeft: ['WhatsApp', 'Google Calendar', 'Gmail', 'Zoom', 'HubSpot'],
    integrationRight: ['Instagram', 'Facebook', 'Slack', 'Salesforce', 'Microsoft Teams'],

    // Industries
    industriesBadge: 'Built for every industries/specialities',
    industriesTitle: 'One platform, tailored to your practice.',
    industries: [
      { icon: 'dental', t: 'Dental', d: 'Appointments, recalls & patient engagement.' },
      { icon: 'hair', t: 'Hair Transplant', d: 'Convert every lead into a booked consultation.' },
      { icon: 'clinic', t: 'Clinic', d: 'AI front desk for modern clinics.' },
      { icon: 'lab', t: 'Diagnostic Lab', d: 'Automated reports, billing & notifications.' },
      { icon: 'physio', t: 'Physiotherapy', d: 'Session reminders & recovery follow-ups.' },
      { icon: 'skin', t: 'Skin Clinic', d: 'Follow-ups that bring patients back.' },
      { icon: 'eye', t: 'Eye Hospital', d: 'Pre & post-treatment patient care.' },
      { icon: 'mind', t: 'Mental Wellness', d: 'Private scheduling with AI assistance.' },
    ],
    industriesCta: 'Explore more',

    // Demo band
    demoBadge: 'Live AI Demo',
    demoTitle1: 'Talk to Your AI Receptionist.',
    demoTitle2: 'Just Like Your Patients Would.',
    demoSubtitle:
      'Skip the sales pitch and experience the product firsthand. Start a live WhatsApp conversation with our AI Receptionist to see how it answers questions, books appointments, sends confirmations, and delivers an exceptional patient experience around the clock.',
    demoCta: 'Start WhatsApp Demo',

    // Testimonials
    testimonialsBadge: 'Testimonials',
    testimonialsTitle: 'Trusted by Healthcare Providers',
    testimonials: [
      { a: 'PS', n: 'Dr. Priya Shah', r: 'Founder, Shah Skin & Wellness Clinic', t: "Our patients now book in Gujarati, Hindi, or English without ever calling in. It's cut our front-desk queue in half during peak hours." },
      { a: 'JT', n: 'James Turner', r: 'COO, Meridian Health Group', t: 'Appointment no-shows dropped 34% in the first quarter alone. The reminder workflows let us automate follow-ups exactly the way we wanted.' },
      { a: 'AO', n: 'Dr. Amara Okoye', r: 'Medical Director, NorthCare Hospital', t: 'Since implementing ClinicFlow, our no-show rate dropped significantly and our front desk finally has breathing room to focus on patients who walk in.' },
    ],

    // Pricing
    pricingTitle: 'Fair Pricing for Every Stage.',
    pricingSub: 'Scalable plans built to grow alongside your clinic — from your first automation to full multi-location intelligence.',
    pricingMostPopular: 'MOST POPULAR',
    // Chip copy for the non-featured tiers. The plans API carries no per-plan
    // eyebrow/description field, so the first and last tier are labelled by
    // position; anything in between falls back to no chip.
    pricingChipFirst: 'FOR GETTING STARTED',
    pricingChipLast: 'FOR SCALING TEAMS',
    // Standalone custom/enterprise band below the three plan cards. Placeholder
    // copy — swap these strings for the real offer wording.
    customPlan: {
      chip: 'TAILORED',
      title: 'Need something built around your clinic?',
      description:
        'If none of the plans above fit, we will shape one around your workflow — custom AI credits, multi-location rollout, bespoke integrations and a migration plan handled by our team.',
      points: [
        'Volume-based pricing',
        'Dedicated onboarding',
        'Custom integrations',
        'Priority SLA support',
      ],
      priceNote: 'Custom pricing',
      priceSub: 'Billed to fit your scale',
      cta: 'Talk to Sales',
    },
    pricingMonthly: '/mo',
    pricingYearly: '/yr',
    pricingCustom: 'Custom',
    pricingCtaStart: 'Get Started',
    pricingCtaBook: 'Book Demo',
    pricingCtaContact: 'Contact Sales',
    pricingLoading: 'Loading plans…',
    pricingFallback: [
      { name: 'Starter', price: '$499', period: '/mo', eyebrow: 'FOR GETTING STARTED', features: [
        { label: '1 AI Employee', on: true },
        { label: '500 Conversations', on: true },
        { label: 'Email & SMS', on: true },
        { label: 'Voice Automation', on: false },
      ], cta: 'Get Started', highlight: false },
      { name: 'Growth', price: '$1,499', period: '/mo', eyebrow: 'Optimized for scaling teams.', features: [
        { label: '5 AI Employees', on: true },
        { label: 'Unlimited Conversations', on: true },
        { label: 'Voice AI Support', on: true },
        { label: 'CRM Advanced Sync', on: true },
      ], cta: 'Book Demo', highlight: true },
      { name: 'Enterprise', price: 'Custom', period: '', eyebrow: 'FOR SCALING TEAMS', features: [
        { label: 'Custom AI Personas', on: true },
        { label: 'Dedicated Success Manager', on: true },
        { label: 'On-prem Deployment', on: true },
        { label: 'SLA Guarantees', on: true },
      ], cta: 'Contact Sales', highlight: false },
    ],
    appointmentFee: 'An additional $30 is charged per appointment booked.',

    // FAQ
    faqBadge: 'FAQ',
    faqTitle1: 'Everything You',
    faqTitle2: 'Need To Know.',
    faqSub: 'Have more questions? Our team is happy to walk you through a live demo.',
    faqCta: 'Book a Demo',
    // FAQ items are managed by super-admin via the Landing FAQ module and fetched
    // from /public/landing-faqs — no longer hardcoded here.

    // Footer
    footerTagline: 'Empowering healthcare teams across India with an AI front desk that never sleeps.',
    footerProductTitle: 'Product',
    footerProduct: ['Features', 'Pricing', 'Integrations', 'AI Assistant', 'Analytics', 'Payments'],
    footerSolutionsTitle: 'Solutions',
    footerSolutions: ['Dental', 'Hair Transplant', 'Clinic', 'Diagnostic Lab', 'Physiotherapy', 'Skin Clinic', 'Eye Hospital', 'Mental Wellness'],
    footerNewsletterTitle: 'Stay in the loop',
    footerNewsletterSub: 'Get the latest on AI automation.',
    footerNewsletterPlaceholder: 'Email address',
    footerNewsletterCta: 'Join',
    footerCopy: `@${COPYRIGHT_YEAR} All Right Reserved.`,
    footerPrivacy: 'Privacy Policy',
    footerTerms: 'Terms of Service',
} as const;


// ─── Animation ────────────────────────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.55, ease: 'easeOut' as const },
};

// ─── Icon maps ──────────────────────────────────────────────────────────────────
const solutionIconCmp: Record<string, LucideIcon> = {
  bot: Bot,
  calendar: CalendarCheck,
  bell: BellRing,
  users: Users,
  receipt: Receipt,
  chart: BarChart3,
};

const howIcon: Record<string, React.ReactNode> = {
  plug: <Plug size={26} />,
  sliders: <SlidersHorizontal size={26} />,
  rocket: <Rocket size={26} />,
};

// Legacy static-fallback keys only — matches the OLD internal key set used by the
// static `t.industries` fallback data (pre-Speciality-feature), NOT real Lucide
// icon names. Kept for backward compatibility; do not remove.
const industryIcon: Record<string, React.ReactNode> = {
  dental: <BadgePlus size={22} />,
  hair: <Sparkles size={22} />,
  clinic: <Building2 size={22} />,
  lab: <Microscope size={22} />,
  physio: <FileText size={22} />,
  skin: <Heart size={22} />,
  eye: <Eye size={22} />,
  mind: <Brain size={22} />,
};

// Fallback for API-sourced `icon` values that don't match any key above (icon is
// freeform text in the admin form, not constrained to this static key set).
const DEFAULT_INDUSTRY_ICON = <Building2 size={22} />;

// Resolves a Speciality's `icon` value to a rendered icon element.
// API-sourced specialities store `icon` as a real Lucide component name string
// (from ICON_OPTIONS, e.g. "Sparkles"), so we try a dynamic Lucide lookup first.
// The old static fallback data (`t.industries`) still uses legacy static keys
// (e.g. "dental"), which aren't real Lucide names, so that resolves via the
// legacy `industryIcon` map instead. Anything unresolvable falls back to the
// default icon.
const resolveIndustryIcon = (iconName: string): React.ReactNode => {
  const ResolvedIcon = (LucideIcons as unknown as Record<string, LucideIcon>)[iconName];
  if (ResolvedIcon) {
    return <ResolvedIcon size={22} />;
  }
  return industryIcon[iconName] ?? DEFAULT_INDUSTRY_ICON;
};

// ─── Industry / speciality card ────────────────────────────────────────────────
// Direct color swap on hover (white → navy, text → white) — a smooth crossfade
// via CSS transition-colors, not an opacity fade. Uses local hover state instead
// of Tailwind group-hover so every color (inline-styled or class-based) reacts
// consistently — inline styles always win over a group-hover utility class.
const IndustryCard = ({
  ind,
  index,
  onCta,
  ctaLabel,
}: {
  ind: { icon: string; t: string; d: string; slug: string | null };
  index: number;
  onCta: () => void;
  ctaLabel: string;
}) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <motion.div
      {...fadeInUp}
      transition={{ duration: 0.5, delay: (index % 4) * 0.06 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl border border-slate-200 p-5 flex flex-col shadow-lg shadow-slate-900/10 transition-colors duration-300 hover:shadow-xl hover:shadow-slate-900/20 hover:border-transparent"
      style={{ background: hovered ? NAVY_SOFT : '#fff' }}
    >
      <span
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300"
        style={{ background: hovered ? 'rgba(255,255,255,0.15)' : TINT, color: hovered ? '#fff' : NAVY }}
      >
        {resolveIndustryIcon(ind.icon)}
      </span>
      <h4 className="font-bold text-[16.5px] mb-2 transition-colors duration-300" style={{ color: hovered ? '#fff' : HEADING }}>{ind.t}</h4>
      <p className="text-[14.5px] leading-relaxed mb-5 flex-1 transition-colors duration-300" style={{ color: hovered ? 'rgba(255,255,255,0.7)' : BODY }}>{ind.d}</p>
      <button
        onClick={onCta}
        className="mt-auto inline-flex items-center justify-center gap-1.5 text-[14.5px] font-semibold text-white px-4 py-2.5 rounded-lg transition-all hover:brightness-110 w-full"
        style={{ background: hovered ? 'rgba(255,255,255,0.15)' : NAVY }}
      >
        {ctaLabel} <ArrowRight size={14} />
      </button>
    </motion.div>
  );
};

// ─── Section eyebrow (pill) ─────────────────────────────────────────────────────
// `onPrimary` — the pill is sitting on a primary-coloured band (Solution / Results
// / Demo), so its text and dot switch to the secondary accent instead of primary,
// which would otherwise be primary-on-primary and barely legible. The background
// also switches to PILL_ON_PRIMARY — a darkened primary — instead of the near-white
// PILL, which would wash out the bright accent label.
const Eyebrow = ({ children, onPrimary = false }: { children: React.ReactNode; onPrimary?: boolean }) => (
  <div
    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12.5px] font-bold uppercase tracking-[0.18em] mb-4"
    style={{ background: onPrimary ? PILL_ON_PRIMARY : PILL, color: onPrimary ? ACCENT : NAVY }}
  >
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: onPrimary ? ACCENT : NAVY }} />
    {children}
  </div>
);

// ─── Integration hub-and-spoke diagram ─────────────────────────────────────────
// Direct port of the standalone ai-workforce-diagram.html prototype: same fixed
// px dimensions (260px card columns, 260x260 hub circle, 320x320 ring), same
// CSS-drawn robot face (antenna + blinking eyes + ears + mouth), same wire-drawing
// math. Node circles are filled with the page background so wires visually
// terminate at the ring edge instead of passing through it, and are appended to
// the SVG before the traveling pulse dot so the pulse stays on top at the ring.
const ROW_ANGLES = [50, 25, 0, -25, -50]; // degrees above/below horizontal, symmetric per row

// Flow count per app, keyed by the display name coming from t.integrationLeft / t.integrationRight.
const INTEGRATION_FLOWS: Record<string, number> = {
  WhatsApp: 12,
  'Google Calendar': 1,
  Gmail: 10,
  Zoom: 9,
  HubSpot: 10,
  Instagram: 9,
  Facebook: 9,
  Slack: 18,
  Salesforce: 9,
  'Microsoft Teams': 9,
};

// Logo file per app (public/), keyed by the same display name. Drop a matching
// PNG into frontend/public/ and it renders automatically — no code change needed.
const INTEGRATION_LOGOS: Record<string, string> = {
  WhatsApp: '/Whatsapp.png',
  'Google Calendar': '/Google calendar.png',
  Gmail: '/Gmail.png',
  Zoom: '/Zoom.png',
  HubSpot: '/Hubspot.png',
  Instagram: '/Instagram.png',
  Facebook: '/Facebook.png',
  Slack: '/Slack.png',
  Salesforce: '/Salesforce.png',
  'Microsoft Teams': '/Teams.png',
};

const IntegrationDiagram = ({
  hubLabel,
  hubSubtitle,
  left,
  right,
}: {
  hubLabel: string;
  hubSubtitle: string;
  left: readonly string[];
  right: readonly string[];
}) => {
  const diagramRef = React.useRef<HTMLDivElement | null>(null);
  const hubRef = React.useRef<HTMLDivElement | null>(null);
  const ringRef = React.useRef<HTMLDivElement | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  React.useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ns = 'http://www.w3.org/2000/svg';

    const drawWires = () => {
      const diagram = diagramRef.current;
      const hub = hubRef.current;
      const ring = ringRef.current;
      const svg = svgRef.current;
      if (!diagram || !hub || !ring || !svg) return;

      const rect = diagram.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
      svg.innerHTML = '';

      const hubRect = hub.getBoundingClientRect();
      const hubCenter = {
        x: hubRect.left - rect.left + hubRect.width / 2,
        y: hubRect.top - rect.top + hubRect.height / 2,
      };
      const ringRect = ring.getBoundingClientRect();
      const hubRadius = ringRect.width / 2;

      const cards = diagram.querySelectorAll<HTMLElement>('[data-integration-card]');

      cards.forEach((card) => {
        const side = card.dataset.side;
        const row = parseInt(card.dataset.row ?? '0', 10);
        const cRect = card.getBoundingClientRect();
        const startX = side === 'left' ? cRect.right - rect.left : cRect.left - rect.left;
        const startY = cRect.top - rect.top + cRect.height / 2;

        const isMiddleRow = row === 2;
        const nodeR = 5;
        const nodeStrokeWidth = 1.5;
        // Push the dot's center out by its own visual radius (r + half the stroke)
        // so the whole dot sits outside the ring, tangent to its border, not straddling it.
        const dotRadius = hubRadius + nodeR + nodeStrokeWidth / 2;

        let endX: number, endY: number, dotX: number, dotY: number;
        if (isMiddleRow) {
          const dir = side === 'left' ? -1 : 1;
          endX = hubCenter.x + hubRadius * dir;
          endY = hubCenter.y;
          dotX = hubCenter.x + dotRadius * dir;
          dotY = hubCenter.y;
        } else {
          const deg = ROW_ANGLES[row];
          const rad = (deg * Math.PI) / 180;
          const dir = side === 'left' ? -1 : 1;
          endX = hubCenter.x + Math.cos(rad) * hubRadius * dir;
          endY = hubCenter.y - Math.sin(rad) * hubRadius;
          dotX = hubCenter.x + Math.cos(rad) * dotRadius * dir;
          dotY = hubCenter.y - Math.sin(rad) * dotRadius;
        }

        const midX = (startX + endX) / 2;

        const path = document.createElementNS(ns, 'path');
        const d = isMiddleRow
          ? `M ${startX} ${startY} L ${dotX} ${dotY}`
          : `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${dotX} ${dotY}`;
        path.setAttribute('d', d);
        path.setAttribute('class', 'integration-wire');
        svg.appendChild(path);

        const nodeStart = document.createElementNS(ns, 'circle');
        nodeStart.setAttribute('class', 'integration-node');
        nodeStart.setAttribute('cx', String(startX));
        nodeStart.setAttribute('cy', String(startY));
        nodeStart.setAttribute('r', String(nodeR));
        svg.appendChild(nodeStart);

        const nodeEnd = document.createElementNS(ns, 'circle');
        nodeEnd.setAttribute('class', 'integration-node');
        nodeEnd.setAttribute('cx', String(dotX));
        nodeEnd.setAttribute('cy', String(dotY));
        nodeEnd.setAttribute('r', String(nodeR));
        svg.appendChild(nodeEnd);

        if (!prefersReducedMotion) {
          const pulse = document.createElementNS(ns, 'circle');
          pulse.setAttribute('class', 'integration-pulse');
          pulse.setAttribute('r', '4.2');
          const anim = document.createElementNS(ns, 'animateMotion');
          anim.setAttribute('dur', `${2.6 + Math.random() * 1.4}s`);
          anim.setAttribute('repeatCount', 'indefinite');
          anim.setAttribute('begin', `${Math.random() * 2}s`);
          anim.setAttribute('path', d);
          pulse.appendChild(anim);
          svg.appendChild(pulse);
        }
      });
    };

    drawWires();
    window.addEventListener('resize', drawWires);
    return () => window.removeEventListener('resize', drawWires);
  }, [left, right]);

  const Card = ({ name, side, row }: { name: string; side: 'left' | 'right'; row: number }) => {
    const flows = INTEGRATION_FLOWS[name] ?? 0;
    const logo = INTEGRATION_LOGOS[name];
    return (
      <div
        data-integration-card
        data-side={side}
        data-row={row}
        className="integration-card relative z-[2] flex items-center rounded-2xl border"
      >
        {logo ? (
          <div className="integration-card-icon shrink-0">
            {/* Plain <img>, not next/image: the file may not exist in public/ yet.
                next/image 404s loudly and needs a restart to pick up a newly
                pasted file, whereas this renders blank now and shows the logo as
                soon as the PNG is dropped in. onError hides the broken-image
                glyph so a missing logo looks intentionally empty. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt={name}
              width={56}
              height={56}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            />
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="integration-card-name">{name}</div>
          <div className="integration-card-status">Connected</div>
          <div className="integration-card-flows">{flows} Active {flows === 1 ? 'Flow' : 'Flows'}</div>
        </div>
      </div>
    );
  };

  return (
    <div ref={diagramRef} className="integration-diagram relative grid items-center min-h-[620px] w-full max-w-[1280px] mx-auto">
      <style>{`
        .integration-diagram { grid-template-columns: 1fr; gap: 18px; }
        @media (min-width: 860px) {
          .integration-diagram { grid-template-columns: 300px 1fr 300px; gap: 0 16px; }
        }
        .integration-col { display: flex; flex-direction: column; gap: 18px; position: relative; z-index: 2; }
        .integration-card {
          gap: 16px; background: #fff; border-color: #e7e9ee; padding: 18px 20px;
          box-shadow: 0 1px 2px rgba(20,22,30,0.04), 0 6px 16px rgba(20,22,30,0.05);
        }
        .integration-card-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .integration-card-icon img { width: 100%; height: 100%; object-fit: contain; }
        .integration-card-name { font-weight: 600; font-size: 1.05rem; line-height: 1.2; color: ${HEADING}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .integration-card-status { display: flex; align-items: center; gap: 5px; font-size: 0.8rem; font-weight: 600; color: #1aa35c; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
        .integration-card-status::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #1aa35c; flex: none; }
        .integration-card-flows { font-size: 0.85rem; color: ${BODY}; margin-top: 3px; font-variant-numeric: tabular-nums; }

        .integration-hub-wrap { position: relative; z-index: 3; display: flex; align-items: center; justify-content: center; height: 100%; }
        .integration-ring { position: absolute; width: 320px; height: 320px; border-radius: 50%; background: rgba(var(--color-primary-rgb),0.07); }
        .integration-ring::after { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgba(var(--color-primary-rgb),0.14); }
        .integration-hub {
          position: relative; width: 260px; height: 260px; border-radius: 50%;
          background: #fff; border: 1px solid #e7e9ee; box-shadow: 0 1px 2px rgba(20,22,30,0.04), 0 6px 16px rgba(20,22,30,0.05);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 12px;
        }
        .integration-bot { position: relative; width: 76px; height: 58px; border-radius: 22px; background: linear-gradient(160deg, #2b2f3a, #14151a); display: flex; align-items: center; justify-content: center; gap: 11px; box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); }
        .integration-bot::before { content: ""; position: absolute; top: -13px; left: 50%; transform: translateX(-50%); width: 2px; height: 10px; background: #4c515f; }
        .integration-bot::after { content: ""; position: absolute; top: -18px; left: 50%; transform: translateX(-50%); width: 6px; height: 6px; border-radius: 50%; background: #4ec1ff; box-shadow: 0 0 6px 1px rgba(78,193,255,0.7); }
        .integration-bot-ear { position: absolute; top: 50%; width: 6px; height: 16px; border-radius: 3px; background: #2b2f3a; transform: translateY(-50%); }
        .integration-bot-ear.left { left: -4px; }
        .integration-bot-ear.right { right: -4px; }
        .integration-bot-eyes { display: flex; gap: 11px; }
        .integration-bot-eyes span { width: 11px; height: 11px; border-radius: 50%; background: #4ec1ff; box-shadow: 0 0 9px 1.5px rgba(78,193,255,0.7); animation: integration-bot-blink 2.2s ease-in-out infinite; }
        .integration-bot-eyes span:nth-child(2) { animation-delay: 0.08s; }
        .integration-bot-mouth { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); width: 28px; height: 3px; border-radius: 2px; background: #323744; }
        @keyframes integration-bot-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.15); } }
        .integration-hub-title { font-size: 1.3rem; font-weight: 800; letter-spacing: 0.02em; color: ${HEADING}; }
        .integration-hub-subtitle { font-size: 0.86rem; color: ${BODY}; line-height: 1.35; max-width: 160px; }

        .integration-wire { fill: none; stroke: ${WIRE}; stroke-width: 2.4; }
        .integration-node { fill: ${SURFACE}; stroke: ${WIRE_NODE}; stroke-width: 1.5; }
        .integration-pulse { fill: var(--color-primary); filter: drop-shadow(0 0 3px var(--color-primary)); }

        @media (prefers-reduced-motion: reduce) {
          .integration-bot-eyes span, .integration-pulse { animation: none !important; }
        }
        @media (max-width: 859px) {
          .integration-wires { display: none; }
          .integration-hub-wrap { order: -1; margin-bottom: 16px; }
          .integration-ring { width: 200px; height: 200px; }
          .integration-hub { width: 168px; height: 168px; padding: 10px; gap: 8px; }
          .integration-bot { width: 56px; height: 44px; border-radius: 16px; gap: 8px; }
          .integration-bot::before { top: -10px; height: 8px; }
          .integration-bot::after { top: -14px; width: 5px; height: 5px; }
          .integration-bot-ear { width: 5px; height: 12px; }
          .integration-bot-eyes { gap: 8px; }
          .integration-bot-eyes span { width: 8px; height: 8px; }
          .integration-bot-mouth { width: 20px; bottom: 7px; }
          .integration-hub-title { font-size: 1rem; }
          .integration-hub-subtitle { font-size: 0.75rem; max-width: 130px; }
          .integration-card { padding: 14px 16px; gap: 12px; }
          .integration-card-icon { width: 44px; height: 44px; border-radius: 12px; }
          .integration-card-name { font-size: 0.95rem; }
          .integration-card-status { font-size: 0.72rem; }
          .integration-card-flows { font-size: 0.76rem; }
        }
      `}</style>

      <svg ref={svgRef} className="integration-wires absolute inset-0 w-full h-full pointer-events-none z-[1] overflow-visible" />

      <div className="integration-col">
        {left.map((name, i) => (
          <Card key={name} name={name} side="left" row={i} />
        ))}
      </div>

      <div className="integration-hub-wrap">
        <div ref={ringRef} className="integration-ring" />
        <div ref={hubRef} className="integration-hub">
          <div className="integration-bot">
            <div className="integration-bot-ear left" />
            <div className="integration-bot-eyes"><span /><span /></div>
            <div className="integration-bot-mouth" />
            <div className="integration-bot-ear right" />
          </div>
          <div className="integration-hub-title">{hubLabel}</div>
          <div className="integration-hub-subtitle">{hubSubtitle}</div>
        </div>
      </div>

      <div className="integration-col">
        {right.map((name, i) => (
          <Card key={name} name={name} side="right" row={i} />
        ))}
      </div>
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────────
const ClinicFlowLanding = (_props: { variant?: string }) => {
  const router = useRouter();
  const { platformName, platformShortName } = useThemeColors();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [plans, setPlans] = React.useState<PlanData[]>([]);
  const [plansLoading, setPlansLoading] = React.useState(true);
  const [footerPages, setFooterPages] = React.useState<FooterPageLink[]>([]);
  const [heroContent, setHeroContent] = React.useState<HeroContent>(DEFAULT_HERO_CONTENT);
  const [landingVideo, setLandingVideo] = React.useState<{ file_path: string; title?: string } | null>(null);
  const [landingFaqs, setLandingFaqs] = React.useState<{ q: string; a: string }[]>([]);
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);
  const [specialities, setSpecialities] = React.useState<
    Pick<Speciality, 'slug' | 'icon' | 'name' | 'short_description'>[]
  >([]);

  // Pinned scroll story: section fills the screen and pins; scroll progress steps items 1..N, then releases.
  // STEP_VH = scroll runway per item (in vh). Lower = snappier / less empty scrolling before release.
  const PROBLEM_COUNT = 6;
  const STEP_VH = 100;
  // Continuous scroll-scrubbed progress across items: 0 → PROBLEM_COUNT-1 (fractional).
  // e.g. 2.35 means card 2 is 35% of the way to fully covering card 1 — no snapping, no fixed-duration transition.
  const [problemProgress, setProblemProgress] = React.useState(0);
  const activeProblem = Math.min(PROBLEM_COUNT - 1, Math.round(problemProgress));
  const [isDesktop, setIsDesktop] = React.useState(false);
  const problemWrapRef = React.useRef<HTMLDivElement | null>(null);

  // Track lg+ so the pinned scroll-jack only runs on desktop; mobile gets a normal stacked list.
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  React.useEffect(() => {
    if (!isDesktop) return; // no scroll-jack on mobile/tablet
    let ticking = false;
    const compute = () => {
      ticking = false;
      const el = problemWrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight; // scroll distance while pinned
      if (total <= 0) return;
      const progress = Math.min(Math.max(-rect.top / total, 0), 1); // 0→1 across the pinned range
      setProblemProgress(progress * (PROBLEM_COUNT - 1)); // continuous — every scroll pixel updates card position directly
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(compute); // throttle to one update per frame
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    compute();
    return () => window.removeEventListener('scroll', onScroll);
  }, [isDesktop]);

  // Solution section: same pinned scroll-jack pattern as Problem, driving a 3-column conveyor.
  const SOLUTION_COUNT = 6;
  const SOLUTION_STEP_VH = 60;
  const [activeSolution, setActiveSolution] = React.useState(0);
  const solutionWrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isDesktop) return;
    let ticking = false;
    let last = -1;
    const compute = () => {
      ticking = false;
      const el = solutionWrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const progress = Math.min(Math.max(-rect.top / total, 0), 1);
      const idx = Math.min(SOLUTION_COUNT - 1, Math.round(progress * (SOLUTION_COUNT - 1)));
      if (idx !== last) {
        last = idx;
        setActiveSolution(idx);
      }
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(compute);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    compute();
    return () => window.removeEventListener('scroll', onScroll);
  }, [isDesktop]);

  React.useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
    fetch(`${baseUrl}/public/plans`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setPlans(
            json.data.map((p: PlanData) => ({
              ...p,
              price: Number(p.price ?? 0),
              monthly_price: Number(p.monthly_price ?? 0),
              yearly_price: Number(p.yearly_price ?? 0),
              features: Array.isArray(p.features) ? p.features : [],
            })),
          );
        }
      })
      .catch(() => {})
      .finally(() => setPlansLoading(false));

    fetch(`${baseUrl}/public/pages/footer`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) setFooterPages(json.data);
      })
      .catch(() => setFooterPages([]));

    fetch(`${baseUrl}/public/hero-content`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) setHeroContent(json.data);
      })
      .catch(() => {});

    fetch(`${baseUrl}/public/landing-video`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) setLandingVideo(json.data);
      })
      .catch(() => {});

    // Super-admin-managed FAQs (the only source — set via the Landing FAQ module).
    // Map to the {q, a} shape the section renders. If none exist, the FAQ section
    // is hidden entirely.
    fetch(`${baseUrl}/public/landing-faqs`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setLandingFaqs(
            json.data.map((f: { question: string; answer: string }) => ({ q: f.question, a: f.answer })),
          );
        }
      })
      .catch(() => {});

    // Super-admin-managed specialities (the public master list). Falls back to the
    // static t.industries copy below if this is empty or the fetch fails, so the
    // industries section never breaks.
    specialityService
      .getPublic()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setSpecialities(data);
      })
      .catch(() => {});
  }, []);

  const goLogin = () => router.push('/login');

  // Map API plans onto the 3-tier layout; fall back to static copy if none.
  const pricingTiers = React.useMemo(() => {
    if (plans.length === 0) {
      return t.pricingFallback.map((p) => ({
        name: p.name,
        priceLabel: p.price,
        period: p.period,
        eyebrow: p.eyebrow,
        features: p.features.map((f) => ({ label: f.label, on: f.on })),
        cta: p.cta,
        highlight: p.highlight,
      }));
    }
    const midIndex = Math.floor((plans.length - 1) / 2);
    return plans.map((plan, i) => {
      const displayPrice = plan.period === 'yearly' ? plan.yearly_price : plan.monthly_price || plan.price;
      const period = plan.period === 'yearly' ? t.pricingYearly : t.pricingMonthly;
      return {
        name: plan.plan_name,
        priceLabel: displayPrice > 0 ? `$${displayPrice.toLocaleString()}` : t.pricingCustom,
        period: displayPrice > 0 ? period : '',
        // No eyebrow field on PlanData, so label the outer two tiers by position.
        eyebrow: i === 0 ? t.pricingChipFirst : i === plans.length - 1 ? t.pricingChipLast : '',
        // Only the plan's own `features` array is listed point-wise. Labels derived
        // from feature_flags / other plan variables are deliberately not shown, so a
        // plan with no features renders no list at all rather than inventing rows.
        features: (plan.features ?? []).map((f) => ({ label: f, on: true })),
        cta: i === midIndex ? t.pricingCtaBook : displayPrice > 0 ? t.pricingCtaStart : t.pricingCtaContact,
        highlight: i === midIndex,
      };
    });
  }, [plans]);

  // Map API specialities onto the industries section; fall back to static copy
  // (with the goLogin CTA) if the API list is empty or the fetch failed.
  const industryItems = React.useMemo(() => {
    if (specialities.length === 0) {
      return t.industries.map((ind) => ({ ...ind, slug: null as string | null }));
    }
    return specialities.map((s) => ({
      icon: s.icon ?? '',
      t: s.name,
      d: s.short_description ?? '',
      slug: s.slug,
    }));
  }, [specialities]);

  const privacyPage = footerPages.find((p) => p.slug === 'privacy-policy');
  const termsPage = footerPages.find((p) => p.slug === 'terms-and-conditions');

  // FAQs shown in the section come solely from the super-admin Landing FAQ module.
  const faqList = landingFaqs;

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-[var(--color-primary)] selection:text-white overflow-x-clip" style={{ color: BODY }}>
      {/* ══════════════ NAV ══════════════ */}
      <nav className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center pt-3 px-3 sm:px-4 lg:px-6">
        <div className="w-full max-w-6xl xl:max-w-[78rem] bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-lg shadow-slate-900/5 rounded-full pl-5 pr-3.5 h-16 flex items-center justify-between gap-3">
          <a href="#home" className="flex items-center gap-2.5 no-underline shrink-0">
            <LogoMark size="md" shortName={platformShortName} />
            <span className="font-heading text-xl font-bold tracking-tight text-slate-900">
              {platformName}
            </span>
          </a>

          <div className="hidden lg:flex items-center gap-1">
            {t.nav.map((link) =>
              'type' in link && link.type === 'route' ? (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => router.push(link.href)}
                  className="px-4 py-2 rounded-full text-base font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  {link.label}
                </button>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-4 py-2 rounded-full text-base font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  {link.label}
                </a>
              ),
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={goLogin}
              className="hidden sm:inline-flex items-center gap-1.5 h-11 px-5 rounded-full text-base font-semibold text-white transition-all hover:brightness-110 shadow-md"
              style={{ background: NAVY, boxShadow: `0 6px 16px ${navyAlpha(0.2)}` }}
            >
              {t.navCta} <ArrowRight size={16} />
            </button>

            <button
              className="lg:hidden flex items-center justify-center w-11 h-11 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileMenuOpen((p) => !p)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="w-full max-w-6xl mt-2 bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-lg rounded-3xl px-4 py-4 flex flex-col gap-1 lg:hidden">
            {t.nav.map((link) =>
              'type' in link && link.type === 'route' ? (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => { router.push(link.href); setMobileMenuOpen(false); }}
                  className="text-left px-4 py-2.5 rounded-xl text-base font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  {link.label}
                </button>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-base font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  {link.label}
                </a>
              ),
            )}
            <div className="mt-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => { goLogin(); setMobileMenuOpen(false); }}
                className="w-full h-11 rounded-xl text-base font-semibold text-white"
                style={{ background: NAVY }}
              >
                {t.navCta}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* PAGE CONTENT */}
      <div>
        {/* ══════════════ HERO ══════════════ */}
        <section id="home" className="scroll-mt-24 relative pt-20 lg:pt-24 pb-6 overflow-hidden bg-white">
          <div
            className="absolute -top-40 -right-32 w-[560px] h-[560px] rounded-full blur-3xl pointer-events-none"
            style={{ background: navyAlpha(0.05) }}
          />
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative z-10">
            <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13.5px] font-semibold"
                  style={{ background: TINT, color: NAVY }}
                >
                  <Sparkles size={15} /> {t.heroBadge1}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13.5px] font-semibold"
                  style={{ background: TINT, color: NAVY }}
                >
                  <ShieldCheck size={15} /> {t.heroBadge2}
                </span>
              </div>
              <h1 className="font-heading text-[1.9rem] sm:text-5xl lg:text-[3.1rem] 2xl:text-[3.6rem] font-semibold tracking-tight mb-5" style={{ color: NAVY, lineHeight: 1.3 }}>
                <span className="block whitespace-nowrap">{t.heroTitle1}</span>
                <span className="block whitespace-nowrap">{t.heroTitle2}</span>
                <span className="block whitespace-nowrap">{t.heroTitle3}</span>
              </h1>
              <p className="text-[16.5px] leading-relaxed mb-7 max-w-sm" style={{ color: BODY }}>{t.heroSubtitle}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={goLogin}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-[15.5px] font-semibold transition-all hover:brightness-110 shadow-lg"
                  style={{ background: NAVY, boxShadow: `0 10px 24px ${navyAlpha(0.2)}` }}
                >
                  {t.heroCta1}
                </button>
                <a
                  href="#solution"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[15.5px] font-semibold border transition-colors"
                  style={{ color: HEADING, borderColor: '#d5dde6', background: '#fff' }}
                >
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: NAVY }}>
                    <Play size={11} fill="white" className="ml-0.5" />
                  </span>
                  {t.heroCta2}
                </a>
              </div>

              {/* inline stats */}
              <div className="mt-10 pt-7 border-t border-slate-200 flex flex-wrap gap-x-8 gap-y-4 sm:gap-x-14">
                {t.stats.map((s) => (
                  <div key={s.label}>
                    <div className="font-heading text-2xl sm:text-[1.9rem] font-extrabold" style={{ color: NAVY }}>{s.val}</div>
                    <div className="text-[13.5px] mt-1" style={{ color: BODY }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Dynamic hero visual: chat animation + automated workflow slider */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="relative"
            >
              <HeroSlider content={heroContent} />
            </motion.div>

          </div>
        </section>

        {/* ══════════════ FEATURE VIDEO / IMAGE BAND ══════════════ */}
        <section className="pt-2 pb-6">
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8">
            <motion.div {...fadeInUp} className="relative rounded-3xl overflow-hidden shadow-xl shadow-slate-900/10">
              {landingVideo ? (
                <video
                  src={`${(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(/\/api$/, '')}/uploads/videos/${landingVideo.file_path}`}
                  className="w-full h-auto block"
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={landingVideo.title || 'ClinicFlow in action'}
                />
              ) : (
                <Image
                  src="/section-2.png"
                  alt="ClinicFlow in action"
                  width={1200}
                  height={600}
                  className="w-full h-auto"
                />
              )}
            </motion.div>
          </div>
        </section>

        {/* ══════════════ PROBLEM (pinned scroll story) ══════════════ */}
        {/* Tall wrapper = scroll runway; inner pins to one screen and steps through items, then releases. */}
        <div
          ref={problemWrapRef}
          className="relative bg-white"
          style={isDesktop ? { height: `${PROBLEM_COUNT * STEP_VH}vh` } : undefined}
        >
          <div className="lg:sticky lg:top-16 overflow-hidden pt-10 sm:pt-12 lg:pt-0 pb-10 lg:pb-0 lg:h-[calc(100dvh-4rem)] lg:flex lg:flex-col lg:justify-center">
            <div className="max-w-6xl 2xl:max-w-7xl mx-auto w-full px-5 sm:px-8">
              <div className="text-center max-w-2xl mx-auto mb-8 lg:mb-5">
                <div className="flex justify-center"><Eyebrow>{t.problemBadge}</Eyebrow></div>
                <h2 className="font-heading text-3xl sm:text-4xl lg:text-[2.05rem] xl:text-5xl font-semibold tracking-tight mb-2" style={{ color: NAVY }}>{t.problemTitle}</h2>
                <p className="text-base sm:text-[16.5px] leading-relaxed" style={{ color: BODY }}>{t.problemSubtitle}</p>
              </div>

              {/* Single card: description (left) + image (right) travel together, one problem visible at a time. */}
              <div className="relative mx-auto w-full max-w-6xl lg:h-[min(24rem,55vh)] lg:overflow-hidden">
                {isDesktop ? (
                  t.problemItems.map((item, i) => {
                    // Continuous scrub: card i slides from 110% (below, hidden) to 0% (in place, covering earlier cards)
                    // as problemProgress moves through [i-1, i]. Stopping mid-scroll leaves it visibly half-covered.
                    const localProgress = Math.min(Math.max(problemProgress - (i - 1), 0), 1);
                    const translateY = i === 0 ? 0 : (1 - localProgress) * 110;
                    const isTopmost = i === activeProblem;
                    return (
                      <div
                        key={item.t}
                        className="absolute inset-0 grid grid-cols-2 items-center gap-6 rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/10 overflow-hidden px-6 py-6 sm:px-8 sm:py-8"
                        style={{
                          background: CARD_BG,
                          transform: `translateY(${translateY}%)`,
                          pointerEvents: isTopmost ? 'auto' : 'none',
                          zIndex: i,
                        }}
                      >
                        <div>
                          <h4 className="font-bold text-xl sm:text-2xl" style={{ color: HEADING }}>{item.t}</h4>
                          <p className="text-base sm:text-[16.5px] leading-relaxed mt-1.5" style={{ color: BODY }}>{item.d}</p>
                        </div>
                        <div className="relative h-full min-h-[12rem] rounded-xl overflow-hidden">
                          <Image src={`/problem-${i + 1}.png`} alt={item.t} fill className="object-contain" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col gap-4">
                    {t.problemItems.map((item, i) => (
                      <div key={item.t} className="rounded-2xl border border-slate-200 shadow-lg shadow-slate-900/10 overflow-hidden" style={{ background: CARD_BG }}>
                        <div className="px-5 pt-5">
                          <h4 className="font-bold text-lg mt-1" style={{ color: HEADING }}>{item.t}</h4>
                          <p className="text-[14.5px] leading-relaxed mt-1.5" style={{ color: BODY }}>{item.d}</p>
                        </div>
                        <div className="relative aspect-[3/2] mt-3 mx-4 mb-4 rounded-xl overflow-hidden">
                          <Image src={`/problem-${i + 1}.png`} alt={item.t} fill className="object-contain" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ══════════════ SOLUTION (pinned scroll conveyor) ══════════════ */}
        {/* Tall wrapper = scroll runway; inner pins to one screen and steps through solutions, then releases. */}
        <div
          ref={solutionWrapRef}
          id="solution"
          className="relative scroll-mt-24"
          style={{
            background: NAVY,
            ...(isDesktop ? { height: `${SOLUTION_COUNT * SOLUTION_STEP_VH}vh` } : {}),
          }}
        >
          <div className="lg:sticky lg:top-16 overflow-hidden pt-10 sm:pt-12 lg:pt-0 pb-10 lg:pb-0 lg:h-[calc(100dvh-4rem)] lg:flex lg:flex-col lg:justify-center">
            <div className="max-w-6xl 2xl:max-w-7xl mx-auto w-full px-5 sm:px-8">
              <div className="text-center max-w-4xl mx-auto mb-5 lg:mb-4">
                <div className="flex justify-center mb-2"><Eyebrow onPrimary>{t.solutionBadge}</Eyebrow></div>
                <h2 className="font-heading text-3xl sm:text-4xl lg:text-[2.05rem] xl:text-4xl font-semibold tracking-tight leading-tight" style={{ color: TINT }}>{t.solutionTitle}</h2>
              </div>

              {isDesktop ? (
                <div className="grid grid-cols-[1fr_2.5fr] gap-8 items-center h-[min(34rem,60vh)]">
                  {/* Left: active solution's title + description */}
                  <div className="relative h-40">
                    {t.solutionCards.map((c, i) => (
                      <div
                        key={c.t}
                        className="absolute inset-0 transition-[opacity,transform] duration-500 ease-out"
                        style={{
                          opacity: i === activeSolution ? 1 : 0,
                          transform: `translateY(${i === activeSolution ? 0 : 16}px)`,
                          pointerEvents: i === activeSolution ? 'auto' : 'none',
                        }}
                      >
                        <h4 className="font-bold text-2xl" style={{ color: ACCENT }}>{c.t}</h4>
                        <p className="text-base leading-relaxed mt-2" style={{ color: ON_PRIMARY_MUTED }}>{c.d}</p>
                      </div>
                    ))}
                  </div>

                  {/* Middle + Right: image track — active image swipes left out; next preview swipes left into focus & zooms in. */}
                  <div className="relative h-full overflow-hidden">
                    {t.solutionCards.map((_c, i) => {
                      const offset = i - activeSolution; // 0 = middle/focused, 1 = right preview, -1 = swiped out left
                      if (offset < -1 || offset > 1) return null;
                      const isActive = offset === 0;
                      const isPreview = offset === 1;
                      return (
                        <div
                          key={i}
                          className="absolute top-0 h-full rounded-2xl overflow-hidden transition-[transform,opacity] duration-500 ease-out"
                          style={{
                            left: 0,
                            width: '62%',
                            border: `1px solid ${ON_PRIMARY_TRACK}`,
                            transform: isActive
                              ? 'translateX(0%) scale(1)'
                              : isPreview
                              ? 'translateX(128%) scale(0.8)'
                              : 'translateX(-60%) scale(0.9)',
                            opacity: isActive ? 1 : isPreview ? 0.55 : 0,
                            zIndex: isActive ? 2 : 1,
                            boxShadow: isActive ? '0 25px 50px -12px rgba(15,23,42,0.25)' : 'none',
                          }}
                        >
                          {/* The solution PNGs are opaque (no alpha) with white baked in, so a card
                              background can't show behind them. Instead the secondary colour is laid
                              over the image and multiplied: white pixels take the secondary colour,
                              darker UI pixels stay put. `isolation` keeps the blend inside this card. */}
                          <div className="absolute inset-0" style={{ isolation: 'isolate' }}>
                            <Image src={`/solution-${i + 1}.png`} alt={t.solutionCards[i].t} fill className="object-contain" />
                            <div
                              aria-hidden
                              className="absolute inset-0 pointer-events-none"
                              style={{ background: TINT, mixBlendMode: 'multiply' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {t.solutionCards.map((c, i) => (
                    <div key={c.t} className="rounded-2xl shadow-lg shadow-slate-900/10 overflow-hidden" style={{ background: SURFACE, border: `1px solid ${ON_PRIMARY_TRACK}` }}>
                      <div className="relative aspect-[3/2]" style={{ isolation: 'isolate' }}>
                        <Image src={`/solution-${i + 1}.png`} alt={c.t} fill className="object-contain" />
                        <div
                          aria-hidden
                          className="absolute inset-0 pointer-events-none"
                          style={{ background: TINT, mixBlendMode: 'multiply' }}
                        />
                      </div>
                      <div className="px-5 py-4">
                        <h4 className="font-bold text-[16.5px]" style={{ color: ACCENT }}>{c.t}</h4>
                        <p className="text-[14.5px] leading-relaxed mt-1" style={{ color: BODY }}>{c.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════ HOW IT WORKS ══════════════ */}
        <section className="py-6 sm:py-8 bg-white">
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8">
            <motion.div {...fadeInUp} className="text-center mb-12">
              <Eyebrow>{t.howBadge}</Eyebrow>
              <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight" style={{ color: NAVY }}>{t.howTitle}</h2>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {t.howSteps.map((step, i) => (
                <motion.div
                  {...fadeInUp}
                  transition={{ duration: 0.5, delay: i * 0.12 }}
                  key={step.t}
                  className="bg-white rounded-2xl border border-slate-200 p-3 hover:shadow-lg transition-all"
                >
                  <div className="relative mb-4 h-64 sm:h-80 lg:h-96 overflow-hidden rounded-xl">
                    <Image
                      src={`/works-${i + 1}.png`}
                      alt={step.t}
                      fill
                      className="object-contain"
                      style={i === 1 ? { objectPosition: 'left top', padding: '0 0 0 4px' } : undefined}
                    />
                  </div>
                  <div className="px-2 pb-3">
                    <h4 className="font-bold text-xl mb-2" style={{ color: NAVY }}>{step.t}</h4>
                    <p className="text-[14.5px] leading-relaxed" style={{ color: BODY }}>{step.d}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ RESULTS ══════════════ */}
        <section className="py-6 sm:py-8" style={{ background: NAVY }}>
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: heading + subtitle + points with progress bars */}
            <motion.div {...fadeInUp}>
              <Eyebrow onPrimary>{t.resultsBadge}</Eyebrow>
              <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight mb-4" style={{ color: TINT }}>{t.resultsTitle}</h2>
              <p className="leading-relaxed mb-10 max-w-md" style={{ color: ON_PRIMARY_MUTED }}>{t.resultsSubtitle}</p>
              <div className="space-y-7">
                {t.resultsPoints.map((p, i) => (
                  <div key={p}>
                    <div className="text-[16.5px] font-medium mb-2.5" style={{ color: SURFACE }}>{p}</div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: ON_PRIMARY_TRACK }}>
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: '100%' }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, delay: i * 0.1, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: ACCENT }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: results chart image */}
            <motion.div {...fadeInUp} className="relative">
              <div className="rounded-3xl overflow-hidden shadow-xl shadow-slate-900/10" style={{ background: SURFACE, border: `1px solid ${ON_PRIMARY_TRACK}` }}>
                <Image
                  src="/results.png"
                  alt="Monthly no-show rate — before vs. after ClinicFlow"
                  width={900}
                  height={720}
                  className="w-full h-auto"
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ══════════════ INTEGRATION ══════════════ */}
        <section id="integration" className="scroll-mt-24 py-6 sm:py-8 bg-white overflow-hidden">
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8">
            <motion.div {...fadeInUp} className="text-center mb-10">
              <Eyebrow>{t.integrationBadge}</Eyebrow>
              <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight" style={{ color: NAVY }}>{t.integrationTitle}</h2>
            </motion.div>

            <motion.div {...fadeInUp} className="w-full">
              <IntegrationDiagram
                hubLabel={t.integrationHub}
                hubSubtitle={t.integrationHubSubtitle}
                left={t.integrationLeft}
                right={t.integrationRight}
              />
            </motion.div>
          </div>
        </section>

        {/* ══════════════ INDUSTRIES ══════════════ */}
        <section className="py-6 sm:py-8 bg-white">
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8">
            <motion.div {...fadeInUp} className="text-center max-w-2xl mx-auto mb-12">
              <div className="flex justify-center"><Eyebrow>{t.industriesBadge}</Eyebrow></div>
              <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight leading-tight" style={{ color: NAVY }}>{t.industriesTitle}</h2>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
              {industryItems.map((ind, i) => (
                <IndustryCard
                  key={ind.slug ?? ind.t}
                  ind={ind}
                  index={i}
                  onCta={ind.slug ? () => router.push(`/specialities/${ind.slug}`) : goLogin}
                  ctaLabel={t.industriesCta}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ DEMO BAND ══════════════ */}
        <section id="cta" className="scroll-mt-24" style={{ background: NAVY }}>
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              {/* Left: copy */}
              <div className="py-10 lg:py-12 text-white">
                {/* Uses the shared <Eyebrow> so this pill tracks the same on-primary
                    treatment as the Solution / Results badges. The extra bottom margin
                    this section wants lives on the wrapper. */}
                <div className="mb-3">
                  <Eyebrow onPrimary>{t.demoBadge}</Eyebrow>
                </div>
                <h2 className="font-heading text-3xl sm:text-[2.25rem] font-semibold leading-[1.18] mb-6" style={{ color: ACCENT }}>
                  {t.demoTitle1}<br />{t.demoTitle2}
                </h2>
                <p className="leading-relaxed mb-9 max-w-lg text-[16.5px]" style={{ color: ON_PRIMARY_MUTED }}>{t.demoSubtitle}</p>
                <button
                  onClick={goLogin}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-[16.5px] font-bold transition-all hover:brightness-95 shadow-lg"
                  style={{ background: SURFACE, color: NAVY }}
                >
                  {t.demoCta}
                </button>
              </div>

              {/* Right: phone image */}
              <div className="flex justify-center lg:justify-end py-4 lg:py-5">
                <Image
                  src="/demo.png"
                  alt="Live WhatsApp AI receptionist demo"
                  width={420}
                  height={720}
                  className="h-auto w-full max-w-[330px] drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ TESTIMONIALS (hidden) ══════════════ */}
        {false && (
        <section className="py-6 sm:py-8 bg-white">
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8">
            <motion.div {...fadeInUp} className="text-center mb-12">
              <Eyebrow>{t.testimonialsBadge}</Eyebrow>
              <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight" style={{ color: NAVY }}>{t.testimonialsTitle}</h2>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {t.testimonials.map((testi, i) => (
                <motion.div
                  {...fadeInUp}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  key={testi.n}
                  className="rounded-2xl border border-slate-100 bg-white p-6 transition-all flex flex-col"
                  style={{ boxShadow: '0 10px 40px rgba(22,40,58,0.10)' }}
                >
                  <div className="flex gap-0.5 mb-4 text-amber-400">
                    {[...Array(5)].map((_, s) => <Star key={s} size={16} fill="currentColor" />)}
                  </div>
                  <p className="text-[16.5px] leading-relaxed mb-6 flex-1" style={{ color: HEADING }}>&ldquo;{testi.t}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <div className="h-10 w-10 rounded-full text-white text-base font-bold flex items-center justify-center shrink-0" style={{ background: NAVY }}>
                      {testi.a}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-bold leading-tight" style={{ color: HEADING }}>{testi.n}</div>
                      <div className="text-sm leading-tight mt-0.5" style={{ color: BODY }}>{testi.r}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        )}

        {/* ══════════════ PRICING ══════════════ */}
        <section id="pricing" className="scroll-mt-24 py-6 sm:py-8 bg-white">
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8">
            <motion.div {...fadeInUp} className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight mb-3" style={{ color: NAVY }}>{t.pricingTitle}</h2>
              <p style={{ color: BODY }}>{t.pricingSub}</p>
            </motion.div>

            {plansLoading ? (
              <div className="flex justify-center py-16"><Spin size="large" /></div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6 items-stretch">
                {pricingTiers.map((tier, i) => (
                  <motion.div
                    {...fadeInUp}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    key={`${tier.name}-${i}`}
                    className="relative rounded-3xl p-7 flex flex-col"
                    style={{
                      // The "most popular" tier is inverted: a near-black surface with
                      // light type, so it reads as the featured plan against the two
                      // plain white ones either side of it.
                      background: tier.highlight ? NAVY : '#fff',
                      border: `1px solid ${tier.highlight ? NAVY : '#e2e8f0'}`,
                      boxShadow: tier.highlight ? `0 24px 60px ${navyAlpha(0.25)}` : '0 8px 30px rgba(22,40,58,0.05)',
                    }}
                  >
                    {/* Every tier gets a chip in the same slot: "MOST POPULAR" on the
                        featured card, the tier's own eyebrow copy on the others, so the
                        three cards line up instead of only the middle one being tagged. */}
                    {(tier.highlight || tier.eyebrow) && (
                      <span
                        className="inline-flex self-start items-center text-[11.5px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full mb-5"
                        style={
                          tier.highlight
                            ? { background: PLAN_DARK_CHIP, color: ACCENT }
                            : { background: PILL, color: NAVY, border: '1px solid #e2e8f0' }
                        }
                      >
                        {tier.highlight ? t.pricingMostPopular : tier.eyebrow}
                      </span>
                    )}
                    <h3 className="font-heading text-3xl font-semibold mb-1.5" style={{ color: tier.highlight ? PLAN_DARK_TEXT : NAVY }}>{tier.name}</h3>
                    <div className="mb-7">
                      <span className="font-heading text-5xl font-extrabold" style={{ color: tier.highlight ? PLAN_DARK_TEXT : HEADING }}>{tier.priceLabel}</span>
                      {tier.period && <span className="text-base ml-1" style={{ color: tier.highlight ? PLAN_DARK_MUTED : BODY }}>{tier.period}</span>}
                    </div>
                    {/* No features on the plan → no list at all. The spacer keeps the
                        CTA pinned to the card bottom so buttons stay aligned across tiers. */}
                    {tier.features.length === 0 ? (
                      <div className="flex-1" />
                    ) : (
                    <ul className="space-y-3.5 mb-8 flex-1">
                      {tier.features.map((f) => (
                        <li key={f.label} className="flex items-center gap-2.5">
                          {/* Check/X sits in a soft round chip rather than bare on the card. */}
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{
                              background: tier.highlight
                                ? PLAN_DARK_CHIP
                                : f.on ? 'rgba(14,163,113,0.12)' : 'rgba(148,163,184,0.15)',
                            }}
                          >
                            {f.on ? (
                              <Check size={12} strokeWidth={3.5} style={{ color: tier.highlight ? ACCENT : '#0ea371' }} />
                            ) : (
                              <X size={12} strokeWidth={3.5} style={{ color: tier.highlight ? PLAN_DARK_MUTED : '#94a3b8' }} />
                            )}
                          </span>
                          <span className="text-[15.5px]" style={{ color: tier.highlight ? (f.on ? PLAN_DARK_TEXT : PLAN_DARK_MUTED) : (f.on ? HEADING : '#a3adba') }}>{f.label}</span>
                        </li>
                      ))}
                    </ul>
                    )}
                    <button
                      onClick={goLogin}
                      className="w-full h-12 rounded-xl font-semibold text-[16.5px] transition-all"
                      style={
                        tier.highlight
                          ? { background: ACCENT, color: NAVY }
                          : { background: '#fff', color: NAVY, border: `1.5px solid #d9e2ec` }
                      }
                    >
                      {tier.cta}
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* ── Custom plan band ────────────────────────────────────────────
                Deliberately outside the 3-card grid and laid out horizontally, so it
                reads as a separate offer rather than a fourth tier. Three rails:
                a filled price panel leading on the left, copy + points in the middle,
                CTA last on the right. Static copy (t.customPlan) — not API-driven. */}
            <motion.div
              {...fadeInUp}
              className="mt-6 rounded-3xl overflow-hidden flex flex-col lg:flex-row lg:items-stretch"
              style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(22,40,58,0.05)' }}
            >
              {/* Left rail: the price leads. Filled with primary so it anchors the
                  band and separates it from the white tier cards above. */}
              <div
                className="p-7 sm:p-9 lg:w-64 lg:shrink-0 flex flex-col justify-center"
                style={{ background: NAVY }}
              >
                <span
                  className="inline-flex self-start items-center text-[11.5px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full mb-4"
                  style={{ background: PLAN_DARK_CHIP, color: ACCENT }}
                >
                  {t.customPlan.chip}
                </span>
                <p className="font-heading text-3xl font-bold leading-tight mb-1" style={{ color: PLAN_DARK_TEXT }}>
                  {t.customPlan.priceNote}
                </p>
                <p className="text-[13.5px]" style={{ color: PLAN_DARK_MUTED }}>{t.customPlan.priceSub}</p>
              </div>

              {/* Middle rail: title, description and the points list. */}
              <div className="p-7 sm:p-9 flex-1 lg:border-l lg:border-slate-200">
                <h3 className="font-heading text-2xl sm:text-[1.7rem] font-semibold mb-2.5" style={{ color: NAVY }}>
                  {t.customPlan.title}
                </h3>
                <p className="text-[15.5px] leading-relaxed mb-6 max-w-2xl" style={{ color: BODY }}>
                  {t.customPlan.description}
                </p>
                <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                  {t.customPlan.points.map((p) => (
                    <li key={p} className="flex items-center gap-2.5">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(14,163,113,0.12)' }}
                      >
                        <Check size={12} strokeWidth={3.5} style={{ color: '#0ea371' }} />
                      </span>
                      <span className="text-[15.5px]" style={{ color: HEADING }}>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right rail: CTA stays last, as before. */}
              <div className="px-7 pb-7 sm:px-9 sm:pb-9 lg:p-9 lg:w-60 lg:shrink-0 flex items-center">
                <button
                  onClick={goLogin}
                  className="w-full h-12 rounded-xl font-semibold text-[16.5px] text-white transition-all hover:brightness-110"
                  style={{ background: NAVY, boxShadow: `0 12px 28px ${navyAlpha(0.2)}` }}
                >
                  {t.customPlan.cta}
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ══════════════ FAQ ══════════════ */}
        {faqList.length > 0 && (
        <section id="faq" className="scroll-mt-24 py-6 sm:py-8 bg-white">
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-start">
            {/* Left: heading + CTA */}
            <motion.div {...fadeInUp}>
              <Eyebrow>{t.faqBadge}</Eyebrow>
              <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight leading-tight mb-5" style={{ color: NAVY }}>
                {t.faqTitle1}<br />{t.faqTitle2}
              </h2>
              <p className="leading-relaxed mb-8 max-w-xs text-[16.5px]" style={{ color: BODY }}>{t.faqSub}</p>
              <button
                onClick={goLogin}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-white text-[16.5px] font-semibold transition-all hover:brightness-110 shadow-lg"
                style={{ background: NAVY, boxShadow: `0 12px 28px ${navyAlpha(0.2)}` }}
              >
                {t.faqCta} <ArrowRight size={16} />
              </button>
            </motion.div>

            {/* Right: bordered-row accordion */}
            <motion.div {...fadeInUp}>
              {faqList.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={item.q} className="border-b border-slate-200">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-4 py-5 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="text-[16.5px] font-medium" style={{ color: HEADING }}>{item.q}</span>
                      <span
                        className="w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-all"
                        style={{
                          borderColor: isOpen ? NAVY : '#cbd5e1',
                          background: isOpen ? NAVY : 'transparent',
                          color: isOpen ? '#fff' : '#64748b',
                          transform: isOpen ? 'rotate(180deg)' : 'none',
                        }}
                      >
                        <ChevronDown size={16} />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="pb-5 -mt-1 text-[15.5px] leading-relaxed max-w-xl" style={{ color: BODY }}>{item.a}</div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          </div>
        </section>
        )}

        {/* ══════════════ FOOTER ══════════════ */}
        <footer style={{ background: NAVY }} className="text-white">
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-12 grid grid-cols-2 md:grid-cols-[1.4fr_0.8fr_0.9fr_1.5fr] gap-x-6 gap-y-8">
            {/* Brand + tagline */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-5">
                <LogoMark size="sm" shortName={platformShortName} />
                <span className="font-heading text-xl font-bold tracking-tight text-white">
                  {platformName}
                </span>
              </div>
              <p className="text-base text-white/55 leading-relaxed max-w-[15rem]">{t.footerTagline}</p>
            </div>

            {/* Product */}
            <div>
              <p className="text-[16.5px] font-semibold text-white mb-5">{t.footerProductTitle}</p>
              <ul className="space-y-3.5">
                {t.footerProduct.map((item, i) => (
                  <li key={item}>
                    <a
                      href={i === 1 ? '#pricing' : i === 2 ? '#integration' : '#solution'}
                      className="text-base text-white transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <p className="text-[16.5px] font-semibold text-white mb-5">{t.footerSolutionsTitle}</p>
              <ul className="space-y-3.5">
                {t.footerSolutions.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-base text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter */}
            <div className="col-span-2 md:col-span-1">
              <p className="text-[16.5px] font-semibold text-white mb-2">{t.footerNewsletterTitle}</p>
              <p className="text-sm text-white/50 mb-4">{t.footerNewsletterSub}</p>
              <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-1.5">
                <input
                  type="email"
                  placeholder={t.footerNewsletterPlaceholder}
                  className="flex-1 min-w-0 h-11 rounded-lg bg-white px-3.5 text-base text-slate-700 placeholder:text-slate-400 outline-none"
                />
                <button
                  type="submit"
                  className="h-11 px-5 rounded-lg text-base font-semibold shrink-0 transition-all hover:brightness-105"
                  style={{ background: ACCENT, color: NAVY }}
                >
                  {t.footerNewsletterCta}
                </button>
              </form>
            </div>
          </div>

          <div className="border-t border-white/10">
            <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-base text-white/50">{t.footerCopy}</p>
              <div className="flex items-center gap-8">
                <a href={`/pages/${privacyPage?.slug || 'privacy-policy'}`} className="text-base text-white transition-colors">
                  {t.footerPrivacy}
                </a>
                <a href={`/pages/${termsPage?.slug || 'terms-and-conditions'}`} className="text-base text-white transition-colors">
                  {t.footerTerms}
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ClinicFlowLanding;
