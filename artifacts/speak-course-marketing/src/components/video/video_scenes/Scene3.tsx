import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2800),
      setTimeout(() => setPhase(5), 4500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
      transition={{ duration: 0.8 }}
    >
      <motion.div 
        className="absolute inset-0 z-0 opacity-20"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 0.2 } : { opacity: 0 }}
      >
        <img src={`${import.meta.env.BASE_URL}images/waveform.png`} className="w-full h-full object-cover mix-blend-screen" />
      </motion.div>

      <div className="relative z-10 w-full flex flex-col items-center">
        <motion.h2 
          className="text-[4vw] font-display font-bold text-center mb-[6vh]"
          initial={{ opacity: 0, y: -30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -30 }}
          transition={{ type: "spring" }}
        >
          Graded on two dimensions.
        </motion.h2>

        <div className="flex gap-[4vw] justify-center w-[80vw]">
          <motion.div 
            className="w-[30vw] bg-[var(--color-bg-muted)] border border-white/10 rounded-2xl p-[3vw] backdrop-blur-md"
            initial={{ opacity: 0, x: -50, rotateY: 30 }}
            animate={phase >= 2 ? { opacity: 1, x: 0, rotateY: 0 } : { opacity: 0, x: -50, rotateY: 30 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            style={{ perspective: 1000 }}
          >
            <h3 className="text-[2.5vw] font-display font-bold text-[var(--color-secondary)] mb-[1vh]">CONTENT</h3>
            <ul className="text-[1.5vw] text-[var(--color-text-secondary)] space-y-[1vh]">
              <li>Structure & Flow</li>
              <li>Argument Clarity</li>
              <li>Relevance</li>
            </ul>
          </motion.div>

          <motion.div 
            className="w-[30vw] bg-[var(--color-bg-muted)] border border-[var(--color-accent)]/30 rounded-2xl p-[3vw] backdrop-blur-md relative overflow-hidden"
            initial={{ opacity: 0, x: 50, rotateY: -30 }}
            animate={phase >= 3 ? { opacity: 1, x: 0, rotateY: 0 } : { opacity: 0, x: 50, rotateY: -30 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            style={{ perspective: 1000 }}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-accent)]" />
            <h3 className="text-[2.5vw] font-display font-bold text-[var(--color-accent)] mb-[1vh]">DELIVERY</h3>
            <ul className="text-[1.5vw] text-[var(--color-text-secondary)] space-y-[1vh]">
              <li>Pacing (WPM)</li>
              <li>Filler Word Rate</li>
              <li>Pause Analysis</li>
            </ul>
            
            <motion.div 
              className="mt-[3vh] p-[1vh] bg-black/40 rounded flex items-center justify-between"
              initial={{ opacity: 0, height: 0 }}
              animate={phase >= 4 ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
            >
              <span className="text-[1.2vw] text-white/70">Filler Words</span>
              <span className="text-[1.4vw] font-mono text-[var(--color-error)]">12 (High)</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}