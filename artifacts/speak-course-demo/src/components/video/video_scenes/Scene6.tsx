import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import soundWavesImg from '@/assets/images/sound-waves.png';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.img 
        src={soundWavesImg}
        className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-multiply"
        initial={{ scale: 1.2, rotate: 5 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 8, ease: "easeOut" }}
      />
      
      <div className="relative z-20 flex flex-col items-center">
        <motion.h2 
          className="text-[5vw] font-black tracking-tight text-[#1A1A1A] leading-tight font-display mb-4"
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 30, filter: phase >= 1 ? "blur(0px)" : "blur(10px)" }}
          transition={{ duration: 1 }}
        >
          Speak with presence.
        </motion.h2>

        <motion.div
          className="h-[1px] bg-[#1A1A1A]/20 w-[40vw] my-8"
          initial={{ width: 0 }}
          animate={{ width: phase >= 2 ? '40vw' : 0 }}
          transition={{ duration: 0.8 }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 20 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <p className="text-[2.5vw] font-bold text-[#9E1B1B] font-display">Podium</p>
          <p className="text-[1.2vw] text-[#4A4A4A] tracking-[0.3em] uppercase mt-2">Public Speaking Studio</p>
        </motion.div>
      </div>
    </motion.div>
  );
}
