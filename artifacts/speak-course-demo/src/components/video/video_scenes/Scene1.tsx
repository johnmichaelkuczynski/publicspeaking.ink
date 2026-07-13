import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="text-center px-12 relative flex flex-col items-center">
        <motion.div
          className="w-16 h-16 rounded-full border-2 border-[#E5B824] mb-8"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: phase >= 1 ? 1 : 0, opacity: phase >= 1 ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <div className="w-full h-full rounded-full bg-[#9E1B1B]/10 animate-ping" />
        </motion.div>

        <motion.h1 
          className="text-[6vw] font-black tracking-tight text-[#1A1A1A] leading-tight font-display"
        >
          {"Podium".split('').map((char, i) => (
            <motion.span 
              key={i} 
              style={{ display: 'inline-block' }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 + i * 0.05 }}
            >
              {char}
            </motion.span>
          ))}
        </motion.h1>
        
        <motion.div
          className="h-[2px] bg-[#9E1B1B] mt-4 mb-6 mx-auto"
          initial={{ width: 0 }}
          animate={{ width: phase >= 2 ? '100%' : 0 }}
          transition={{ duration: 0.8, ease: "circOut" }}
          style={{ maxWidth: '400px' }}
        />

        <motion.p 
          className="text-[2vw] text-[#4A4A4A] uppercase tracking-[0.2em]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 10 }}
          transition={{ duration: 0.8 }}
        >
          Public Speaking Studio
        </motion.p>
      </div>
    </motion.div>
  );
}
