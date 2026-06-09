import { motion } from "framer-motion";

export const Greeting = () => {
  return (
    <div className="flex flex-col items-center px-4 gap-2" key="overview">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center size-14 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg mb-1"
        initial={{ opacity: 0, scale: 0.8 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M14 3L17.5 10.5L25 14L17.5 17.5L14 25L10.5 17.5L3 14L10.5 10.5L14 3Z" fill="white" fillOpacity="0.95"/>
        </svg>
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center font-semibold text-2xl tracking-tight text-foreground md:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        Hello, how can I help?
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-1 text-center text-muted-foreground/70 text-sm"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        Ask a question, write code, or explore ideas with Lavel AI.
      </motion.div>
    </div>
  );
};
