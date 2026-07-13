import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 2000),
      setTimeout(() => setPhase(5), 3200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const topics = [
    "Managing Nerves",
    "Breath & Projection",
    "Posture & Presence",
    "Structuring a Message"
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-start pl-[10vw] z-10"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-col gap-8 max-w-[40vw]">
        <motion.h2 
          className="text-[4vw] font-display font-bold text-[#1A1A1A] leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 20 }}
          transition={{ duration: 0.6 }}
        >
          A Four-Week<br/>
          <span className="text-[#9E1B1B]">Journey.</span>
        </motion.h2>

        <div className="flex flex-col gap-4">
          {topics.map((topic, i) => (
            <motion.div 
              key={i}
              className="flex items-center gap-4 bg-white/80 p-4 rounded-xl shadow-sm border border-[#E5B824]/20"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: phase >= 2 + i * 0.5 ? 1 : 0, x: phase >= 2 + i * 0.5 ? 0 : -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: i * 0.1 }}
            >
              <div className="w-8 h-8 rounded-full bg-[#E5B824]/20 flex items-center justify-center text-[#9E1B1B] font-bold">
                {i + 1}
              </div>
              <span className="text-[1.5vw] text-[#4A4A4A] font-medium">{topic}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Floating 29 topics badge */}
      <motion.div
        className="absolute right-[15vw] top-[30vh] w-64 h-64 rounded-full bg-[#9E1B1B] flex flex-col items-center justify-center text-white shadow-2xl"
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: phase >= 3 ? 1 : 0, rotate: phase >= 3 ? 0 : -45 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <span className="text-[5vw] font-display font-bold leading-none">29</span>
        <span className="text-[1.5vw] uppercase tracking-widest mt-2 text-[#E5B824]">Topics</span>
      </motion.div>

    </motion.div>
  );
}
