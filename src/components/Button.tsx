import { motion, type HTMLMotionProps } from "motion/react";
import clsx from "clsx";

type Variant = "primary" | "dark" | "ghost" | "ok" | "bad";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink shadow-[0_4px_0_0_rgb(0_0_0/0.18)]",
  dark: "bg-fg text-bg shadow-[0_4px_0_0_rgb(0_0_0/0.25)]",
  ghost: "bg-surface text-fg border-2 border-line",
  ok: "bg-ok text-white shadow-[0_4px_0_0_rgb(0_0_0/0.2)]",
  bad: "bg-bad text-white shadow-[0_4px_0_0_rgb(0_0_0/0.2)]",
};

/** Chunky, tactile button: presses down on tap like a physical key. */
export function Button({
  variant = "primary",
  className,
  disabled,
  ...rest
}: HTMLMotionProps<"button"> & { variant?: Variant }) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { y: 3, boxShadow: "0 1px 0 0 rgb(0 0 0 / 0.18)" }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      disabled={disabled}
      className={clsx(
        "inline-flex select-none items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-display text-[17px] font-bold tracking-tight",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}
