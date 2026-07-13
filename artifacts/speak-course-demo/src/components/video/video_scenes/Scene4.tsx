import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import microphoneImg from '@/assets/images/microphone.png';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10 bg-[#1A1A1A]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.img 
        src={microphoneImg}
        className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 10, ease: "linear" }}
      />
      
      <div className="relative z-20 flex flex-col items-center text-center">
        <motion.div
          className="w-24 h-24 rounded-full bg-[#9E1B1B] flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(158,27,27,0.5)]"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: phase >= 1 ? 1 : 0, opacity: phase >= 1 ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <motion.div 
            className="w-8 h-8 rounded-sm bg-white"
            animate={{ scale: phase >= 2 ? [1, 0.8, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        </motion.div>

        <motion.h2 
          className="text-[4vw] font-display font-bold text-white leading-tight mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 20 }}
        >
          Spoken Assignments
        </motion.h2>

        <motion.p
          className="text-[1.8vw] text-white/70 max-w-[60vw]"
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ opacity: phase >= 3 ? 1 : 0, filter: phase >= 3 ? "blur(0px)" : "blur(10px)" }}
        >
          Record yourself speaking. The AI transcribes your speech and evaluates both content and delivery.
        </motion.p>
        
        {/* Recording waveform simulation */}
        <div className="flex items-center gap-1 mt-12 h-16">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-2 bg-[#E5B824] rounded-full"
              initial={{ height: 4 }}
              animate={phase >= 2 ? {
                height: [4, Math.random() * 40 + 10, 4],
              } : { height: 4 }}
              transition={{
                repeat: Infinity,
                duration: Math.random() * 0.5 + 0.5,
                delay: i * 0.05,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
