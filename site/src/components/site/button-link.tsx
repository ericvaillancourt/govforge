import Link from "next/link";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type Variants = VariantProps<typeof buttonVariants>;

interface ButtonLinkProps extends Variants {
  href: string;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}

const isExternalLike = (href: string) =>
  href.startsWith("http://") ||
  href.startsWith("https://") ||
  href.startsWith("mailto:") ||
  href.startsWith("tel:") ||
  href.startsWith("#") ||
  href.includes("/#");

export function ButtonLink({
  href,
  external,
  className,
  variant,
  size,
  children,
  ariaLabel,
}: ButtonLinkProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  const isExt = external ?? isExternalLike(href);

  if (isExt) {
    const isHttp = href.startsWith("http");
    return (
      <a
        href={href}
        className={classes}
        aria-label={ariaLabel}
        {...(isHttp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
