import { getInitial, resolveProfileImageUrl } from "@/utils/profileImage";

interface ProfileAvatarProps {
  imagePath?: string | null;
  label?: string | null;
  fallbackText?: string | null;
  size?: number;
}

export function ProfileAvatar({ imagePath, label, fallbackText, size = 34 }: ProfileAvatarProps) {
  const src = resolveProfileImageUrl(imagePath);
  const initial = getInitial(fallbackText || label);

  if (src) {
    return (
      <img
        src={src}
        alt={label ?? "Profile"}
        width={size}
        height={size}
        className="rounded-full border border-slate-200 object-cover"
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-sky-100 font-semibold text-sky-700"
      style={{ width: size, height: size }}
      aria-label={label ?? "Avatar"}
    >
      {initial}
    </div>
  );
}
