import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-row items-center justify-between px-[10vw]"
      initial={{ opacity: 0, x: '10vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '-10vw', filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-1/2">
        <motion.h2 
          className="text-[7vw] font-display font-black leading-[1.1] uppercase tracking-tight"
          initial={{ opacity: 0, x: -50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          Step up
          <br />
          to the
          <br />
          <span className="text-[var(--color-accent)]">Mic.</span>
        </motion.h2>
        
        <motion.p
          className="text-[1.8vw] text-[var(--color-text-secondary)] mt-[3vh] max-w-[80%]"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          A spoken-first approach. Don't type your assignments—perform them out loud, in the browser.
        </motion.p>
      </div>

      <div className="w-1/2 flex justify-center items-center relative">
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/microphone.png`}
          className="w-[30vw] h-auto object-contain drop-shadow-[0_0_40px_rgba(0,240,255,0.3)] relative z-10"
          initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.5, rotate: -10 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        />
        
        <motion.div 
          className="absolute w-[40vw] h-[40vw] rounded-full border border-[var(--color-accent)] opacity-20"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}