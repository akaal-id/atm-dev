export type HubSocialIcon = "instagram" | "linkedin" | "github" | "website" | "email";

export interface HubLeader {
  name: string;
  role: string;
  whatsapp: string;
}

export interface HubSocial {
  label: string;
  href: string;
  icon: HubSocialIcon;
}

export const akaalHub = {
  brand: {
    name: "AKAAL",
    tagline: "A collective of strategists, designers, and engineers building digital experiences that move culture forward.",
    logoSrc: "/icon/mono-akaal-white.png",
    websiteUrl: "https://akaal.id",
  },
  leaders: [
    { name: "Asad Muhammad", role: "CEO", whatsapp: "6281213957471" },
    { name: "Afif Abdurrahman", role: "CTO", whatsapp: "6281287567548" },
  ] satisfies HubLeader[],
  socials: [
    { label: "Instagram", href: "https://www.instagram.com/akaal_id/", icon: "instagram" },
    { label: "LinkedIn", href: "https://www.linkedin.com/company/akaalcreative/posts/?feedView=all", icon: "linkedin" },
  ] as HubSocial[],
};

export function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export function leaderInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
