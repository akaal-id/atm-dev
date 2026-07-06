export type HubSocialIcon = "instagram" | "linkedin" | "github" | "website" | "email";

export interface HubLeader {
  name: string;
  role: string;
  roleTitle: string;
  email: string;
  whatsapp: string;
  phoneDisplay: string;
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
    logoLightSrc: "/icon/mono-akaal-white.png",
    websiteUrl: "https://akaal.id",
  },
  leaders: [
    {
      name: "Asad Muhammad",
      role: "CEO",
      roleTitle: "Chief Executive Officer",
      email: "asad@akaal.id",
      whatsapp: "6281213957471",
      phoneDisplay: "+62 81213 95 7471",
    },
    {
      name: "Afif Abdurrahman",
      role: "CTO",
      roleTitle: "Chief Technology Officer",
      email: "afif@akaal.id",
      whatsapp: "6281287567548",
      phoneDisplay: "+62 812 8756 7548",
    },
  ] satisfies HubLeader[],
  socials: [
    { label: "Instagram", href: "https://www.instagram.com/akaal_id/", icon: "instagram" },
    { label: "LinkedIn", href: "https://www.linkedin.com/company/akaalcreative/posts/?feedView=all", icon: "linkedin" },
  ] as HubSocial[],
};

export function whatsappUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
