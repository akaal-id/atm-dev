import Image from "next/image";

import { initials } from "@/lib/utils";
import styles from "./avatar.module.css";

interface AvatarProps {
  name: string;
  image?: string;
  size?: "sm" | "md" | "lg";
}

const imageSizes = {
  sm: 32,
  md: 40,
  lg: 56,
};

export function Avatar({ name, image, size = "md" }: AvatarProps) {
  return (
    <div className={`${styles.avatar} ${styles[size]}`}>
      {image ? <Image src={image} alt="" width={imageSizes[size]} height={imageSizes[size]} unoptimized className={styles.image} /> : initials(name)}
    </div>
  );
}
