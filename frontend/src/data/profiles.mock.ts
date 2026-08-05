/**
 * TEMPORARY MOCK DATA — public "Profiles" (Instagram-style) feature.
 *
 * This is UI/design-only fixture data. There is no backend model or API for
 * this feature yet — profile creation/admin CRUD is a separate, later ticket
 * (see GitHub Issue #21). When that backend lands, replace the two lookup
 * functions below with real API calls; keep the `PublicProfile` /
 * `PublicProfileVideo` shapes stable so the listing/detail pages don't need
 * to change.
 */

export interface PublicProfileVideo {
  id: string;
  /** CSS gradient used as a placeholder thumbnail (no external image hosts). */
  thumbnailGradient: string;
  views: number;
  likes: number;
  caption: string;
}

export interface PublicProfile {
  slug: string;
  name: string;
  category: string;
  /** CSS gradient used as a placeholder avatar (no external image hosts). */
  avatarGradient: string;
  bio: string;
  location: string;
  handle: string;
  website: string;
  verified: boolean;
  joinedDate: string;
  videos: PublicProfileVideo[];
  /** Public handle-style username, distinct from `handle` (kept for backward compat). */
  username: string;
  experience: string;
  education: string;
}

const gradients = [
  "linear-gradient(135deg,#f97316,#ec4899)",
  "linear-gradient(135deg,#8b5cf6,#3b82f6)",
  "linear-gradient(135deg,#10b981,#0ea5e9)",
  "linear-gradient(135deg,#f43f5e,#f59e0b)",
  "linear-gradient(135deg,#6366f1,#a855f7)",
  "linear-gradient(135deg,#14b8a6,#22c55e)",
  "linear-gradient(135deg,#ef4444,#eab308)",
  "linear-gradient(135deg,#06b6d4,#6366f1)",
  "linear-gradient(135deg,#d946ef,#f97316)",
];

const videoGradients = [
  "linear-gradient(160deg,#1e293b,#0ea5e9)",
  "linear-gradient(160deg,#312e81,#a855f7)",
  "linear-gradient(160deg,#7c2d12,#f97316)",
  "linear-gradient(160deg,#052e16,#22c55e)",
  "linear-gradient(160deg,#450a0a,#ef4444)",
  "linear-gradient(160deg,#164e63,#06b6d4)",
];

function makeVideos(profileSlug: string, count: number): PublicProfileVideo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${profileSlug}-vid-${i + 1}`,
    thumbnailGradient: videoGradients[(i + count) % videoGradients.length],
    views: Math.floor(500 + Math.random() * 250_000),
    likes: Math.floor(50 + Math.random() * 45_000),
    caption: `Clip ${i + 1}`,
  }));
}

export const mockProfiles: PublicProfile[] = [
  {
    slug: "smile-dental-studio",
    name: "Smile Dental Studio",
    category: "Dentistry",
    avatarGradient: gradients[0],
    bio: "Cosmetic & family dentistry — before/afters and patient stories.",
    location: "Austin, TX",
    handle: "@smiledentalstudio",
    website: "smiledentalstudio.com",
    verified: true,
    joinedDate: "2022-03-01",
    videos: makeVideos("smile-dental-studio", 6),
    username: "smiledentalstudio",
    experience: "12 years in cosmetic and family dentistry",
    education: "DDS, University of Texas School of Dentistry",
  },
  {
    slug: "glow-derma-clinic",
    name: "Glow Derma Clinic",
    category: "Dermatology",
    avatarGradient: gradients[1],
    bio: "Skin treatments, laser therapy, and skincare tips.",
    location: "Miami, FL",
    handle: "@glowdermaclinic",
    website: "glowderma.com",
    verified: true,
    joinedDate: "2021-11-15",
    videos: makeVideos("glow-derma-clinic", 5),
    username: "glowdermaclinic",
    experience: "9 years in dermatology and laser therapy",
    education: "MD Dermatology, University of Miami",
  },
  {
    slug: "vital-cardio-center",
    name: "Vital Cardio Center",
    category: "Cardiology",
    avatarGradient: gradients[2],
    bio: "Heart health education and patient recovery journeys.",
    location: "Chicago, IL",
    handle: "@vitalcardiocenter",
    website: "vitalcardio.com",
    verified: false,
    joinedDate: "2023-01-20",
    videos: makeVideos("vital-cardio-center", 7),
    username: "vitalcardiocenter",
    experience: "15 years in interventional cardiology",
    education: "MD, Northwestern University Feinberg School of Medicine",
  },
  {
    slug: "bloom-womens-health",
    name: "Bloom Women's Health",
    category: "Gynecology",
    avatarGradient: gradients[3],
    bio: "Compassionate women's health care, at every stage of life.",
    location: "Denver, CO",
    handle: "@bloomwomenshealth",
    website: "bloomwomenshealth.com",
    verified: true,
    joinedDate: "2022-07-08",
    videos: makeVideos("bloom-womens-health", 4),
    username: "bloomwomenshealth",
    experience: "10 years in obstetrics and gynecology",
    education: "MD, University of Colorado School of Medicine",
  },
  {
    slug: "flex-physio-lab",
    name: "Flex Physio Lab",
    category: "Physiotherapy",
    avatarGradient: gradients[4],
    bio: "Sports injury recovery and mobility training.",
    location: "Seattle, WA",
    handle: "@flexphysiolab",
    website: "flexphysiolab.com",
    verified: false,
    joinedDate: "2023-05-30",
    videos: makeVideos("flex-physio-lab", 5),
    username: "flexphysiolab",
    experience: "7 years in sports rehabilitation and physiotherapy",
    education: "DPT, University of Washington",
  },
  {
    slug: "clearview-eye-care",
    name: "ClearView Eye Care",
    category: "Ophthalmology",
    avatarGradient: gradients[5],
    bio: "LASIK, cataract surgery, and everyday eye care.",
    location: "Boston, MA",
    handle: "@clearvieweyecare",
    website: "clearvieweyecare.com",
    verified: true,
    joinedDate: "2021-09-12",
    videos: makeVideos("clearview-eye-care", 4),
    username: "clearvieweyecare",
    experience: "14 years in ophthalmic surgery",
    education: "MD, Harvard Medical School",
  },
  {
    slug: "little-steps-pediatrics",
    name: "Little Steps Pediatrics",
    category: "Pediatrics",
    avatarGradient: gradients[6],
    bio: "Friendly, kid-first pediatric care.",
    location: "Portland, OR",
    handle: "@littlestepspeds",
    website: "littlestepspeds.com",
    verified: false,
    joinedDate: "2023-02-14",
    videos: makeVideos("little-steps-pediatrics", 6),
    username: "littlestepspeds",
    experience: "6 years in pediatric care",
    education: "MD, Oregon Health & Science University",
  },
  {
    slug: "mindful-therapy-collective",
    name: "Mindful Therapy Collective",
    category: "Mental Health",
    avatarGradient: gradients[7],
    bio: "Therapy, mindfulness, and mental wellness resources.",
    location: "San Francisco, CA",
    handle: "@mindfultherapyco",
    website: "mindfultherapycollective.com",
    verified: true,
    joinedDate: "2022-10-05",
    videos: makeVideos("mindful-therapy-collective", 5),
    username: "mindfultherapyco",
    experience: "11 years in clinical psychology and mindfulness-based therapy",
    education: "PsyD, University of California, Berkeley",
  },
  {
    slug: "peak-ortho-sports-med",
    name: "Peak Ortho & Sports Med",
    category: "Orthopedics",
    avatarGradient: gradients[8],
    bio: "Joint care, sports medicine, and rehab success stories.",
    location: "Salt Lake City, UT",
    handle: "@peakorthosports",
    website: "peakorthosportsmed.com",
    verified: false,
    joinedDate: "2023-08-19",
    videos: makeVideos("peak-ortho-sports-med", 4),
    username: "peakorthosports",
    experience: "13 years in orthopedic and sports medicine surgery",
    education: "MD, University of Utah School of Medicine",
  },
];

export function getAllProfiles(): PublicProfile[] {
  return mockProfiles;
}

export function getProfileBySlug(slug: string): PublicProfile | null {
  return mockProfiles.find((p) => p.slug === slug) ?? null;
}

/** Instagram-style compact count formatting, e.g. 1.2K, 45.3K, 1.1M. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  const v = n / 1_000_000;
  return `${v.toFixed(1).replace(/\.0$/, "")}M`;
}

/** Instagram-style "Joined" date formatting, e.g. "Joined March 2022". */
export function formatJoinedDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return `Joined ${parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}
