"use client";

import { motion } from "framer-motion";
import { AuroraBackground } from "@/components/ui/aurora-background";

export function AuroraBackgroundDemo() {
  return (
    <AuroraBackground className="min-h-[520px] h-[70vh]">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
        className="flex flex-col items-center justify-center gap-4 px-4 text-center"
      >
        <h2 className="text-3xl font-bold md:text-7xl dark:text-white">
          Background lights are cool.
        </h2>
        <p className="py-4 text-base font-extralight md:text-4xl dark:text-neutral-200">
          A little motion, a lot of atmosphere.
        </p>
      </motion.div>
    </AuroraBackground>
  );
}
