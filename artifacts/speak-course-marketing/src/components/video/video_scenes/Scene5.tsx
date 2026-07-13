import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-dark)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.div 
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 2 }}
        style={{ background: 'radial-gradient(circle at center, rgba(0, 240, 255, 0.1) 0%, transparent 60%)' }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
      >
        <h1 className="text-[8vw] font-display font-black tracking-tighter text-white">
          PODIUM
        </h1>
        <motion.div 
          className="h-[2px] bg-[var(--color-accent)] mt-[1vh] mb-[3vh]"
          initial={{ width: 0 }}
          animate={phase >= 2 ? { width: '100%' } : { width: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
        <motion.p 
          className="text-[2.2vw] text-[var(--color-text-secondary)] font-body tracking-wider uppercase"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Public Speaking Studio
        </motion.p>
      </motion.div>
    </motion.div>
  );
}