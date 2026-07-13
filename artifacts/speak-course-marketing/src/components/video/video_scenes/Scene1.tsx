import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300), // "Most speaking courses..."
      setTimeout(() => setPhase(2), 2000), // "Podium grades what you SAY."
      setTimeout(() => setPhase(3), 3500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center text-center px-[10vw]"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      <motion.p 
        className="text-[3vw] text-[var(--color-text-secondary)] font-medium mb-[2vh]"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        Most speaking courses grade what you write.
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={phase >= 2 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <h1 className="text-[6vw] font-display font-bold leading-tight">
          Podium grades<br/>what you <span className="text-[var(--color-accent)] italic">SAY.</span>
        </h1>
      </motion.div>
    </motion.div>
  );
}