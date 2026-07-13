import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 2000),
      setTimeout(() => setPhase(5), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const topics = [
    "Nerves & Posture",
    "Audience Analysis",
    "Storytelling",
    "Handling Q&A"
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center px-[10vw]"
      initial={{ opacity: 0, y: '20vh' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '-20vh', filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2 
        className="text-[4vw] font-display font-bold text-center leading-tight mb-[4vh]"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
      >
        A complete 4-week college syllabus.
      </motion.h2>

      <div className="grid grid-cols-2 gap-[2vw] w-full max-w-[70vw]">
        {topics.map((topic, i) => (
          <motion.div
            key={i}
            className="bg-white/5 border border-white/10 rounded-xl p-[2vw] flex items-center"
            initial={{ opacity: 0, scale: 0.8, x: i % 2 === 0 ? -20 : 20 }}
            animate={phase >= (i % 2 === 0 ? 2 : 3) ? { opacity: 1, scale: 1, x: 0 } : { opacity: 0, scale: 0.8, x: i % 2 === 0 ? -20 : 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="w-[3vw] h-[3vw] rounded-full bg-[var(--color-secondary)]/20 text-[var(--color-accent)] flex items-center justify-center font-display font-bold text-[1.5vw] mr-[1.5vw]">
              {i + 1}
            </div>
            <span className="text-[2vw] font-medium">{topic}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-[6vh] text-[1.8vw] text-[var(--color-accent)] font-medium tracking-wide uppercase"
        initial={{ opacity: 0, letterSpacing: '0px' }}
        animate={phase >= 4 ? { opacity: 1, letterSpacing: '4px' } : { opacity: 0, letterSpacing: '0px' }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        Lectures • Practice • Exams
      </motion.div>
    </motion.div>
  );
}