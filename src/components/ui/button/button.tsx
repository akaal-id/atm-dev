import { Button as ButtonPrimitive } from "@base-ui/react/button";

import { cn } from "@/lib/utils";

import styles from "./button.module.css";

type ButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "destructiveOutline"
  | "destructiveSolid"
  | "success"
  | "warning"
  | "link";

type ButtonSize = "default" | "xs" | "sm" | "lg" | "xl" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

const variantClass: Record<ButtonVariant, string> = {
  default: styles.default,
  outline: styles.outline,
  secondary: styles.secondary,
  ghost: styles.ghost,
  destructive: styles.destructive,
  destructiveOutline: styles.destructiveOutline,
  destructiveSolid: styles.destructiveSolid,
  success: styles.success,
  warning: styles.warning,
  link: styles.link,
};

const sizeClass: Record<ButtonSize, string> = {
  default: styles.sizeDefault,
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  lg: styles.sizeLg,
  xl: styles.sizeXl,
  icon: styles.sizeIcon,
  "icon-xs": styles.sizeIconXs,
  "icon-sm": styles.sizeIconSm,
  "icon-lg": styles.sizeIconLg,
};

type ButtonVariantsArgs = {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  className?: string;
};

/** Compose button CSS-module classes (replaces former cva helper). */
function buttonVariants({ variant = "default", size = "default", className }: ButtonVariantsArgs = {}) {
  return cn(
    styles.root,
    variantClass[variant ?? "default"],
    sizeClass[size ?? "default"],
    className,
  );
}

type ButtonProps = ButtonPrimitive.Props & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  const resolvedClassName = typeof className === "function" ? undefined : className;
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, className: resolvedClassName })}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonVariant, ButtonSize, ButtonProps };
