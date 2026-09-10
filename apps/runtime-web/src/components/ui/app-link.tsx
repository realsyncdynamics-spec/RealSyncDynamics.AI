import { Link } from "@tanstack/react-router";
import { forwardRef, type ReactNode } from "react";

export const AppLink = forwardRef<
  HTMLAnchorElement,
  {
    to: string;
    className?: string;
    children: ReactNode;
    onClick?: () => void;
  }
>(function AppLink({ to, className, children, onClick }, ref) {
  const [pathname, hash] = to.split("#");
  return (
    <Link
      ref={ref}
      to={(pathname || "/") as never}
      hash={hash}
      className={className}
      onClick={onClick}
    >
      {children}
    </Link>
  );
});
