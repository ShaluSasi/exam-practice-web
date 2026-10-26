import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import clsx from "clsx";

/** Number that counts up from 0 when it appears. `format` turns the running value into text. */
export function CountUp({
  value,
  className,
  format = (v) => Math.round(v).toLocaleString("en-IN"),
}: {
  value: number;
  className?: string;
  format?: (v: number) => string;
}) {
  const mv = useMotionValue(0);
  const shown = useTransform(mv, format);
  useEffect(() => {
    const c = animate(mv, value, { duration: 1.1, ease: "easeOut" });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span className={clsx("tabular-nums", className)}>{shown}</motion.span>;
}
