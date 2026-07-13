import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10 px-24"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2 
        className="text-[3vw] font-display font-bold text-[#1A1A1A] mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : -20 }}
      >
        Instant AI Feedback
      </motion.h2>

      <div className="flex gap-12 w-full max-w-[80vw]">
        
        {/* Score Card */}
        <motion.div 
          className="flex-1 bg-white rounded-2xl shadow-xl p-10 flex flex-col items-center justify-center border border-gray-100 relative overflow-hidden"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, x: phase >= 2 ? 0 : -50 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-[#9E1B1B]" />
          <span className="text-[#4A4A4A] uppercase tracking-wider font-bold mb-4">Overall Score</span>
          <motion.div 
            className="text-[8vw] font-display font-black text-[#9E1B1B] leading-none"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: phase >= 2 ? 1 : 0.5, opacity: phase >= 2 ? 1 : 0 }}
            transition={{ delay: 1.5, type: "spring" }}
          >
            92
          </motion.div>
          <span className="text-[#E5B824] font-bold text-xl mt-4">Excellent Presence</span>
        </motion.div>

        {/* Feedback Cards */}
        <div className="flex-1 flex flex-col gap-6">
          <motion.div 
            className="bg-white rounded-2xl shadow-md p-8 border-l-4 border-green-500"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: phase >= 3 ? 1 : 0, x: phase >= 3 ? 0 : 50 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <h4 className="font-bold text-green-600 mb-2 uppercase text-sm tracking-wider">What Worked</h4>
            <p className="text-[#4A4A4A]">Great vocal variety. Your pacing helped emphasize the key points effectively.</p>
          </motion.div>
          
          <motion.div 
            className="bg-white rounded-2xl shadow-md p-8 border-l-4 border-[#E5B824]"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: phase >= 3 ? 1 : 0, x: phase >= 3 ? 0 : 50 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
          >
            <h4 className="font-bold text-[#E5B824] mb-2 uppercase text-sm tracking-wider">To Improve</h4>
            <p className="text-[#4A4A4A]">Watch out for filler words ("um", "like") during transitions between topics.</p>
          </motion.div>
        </div>

      </div>
    </motion.div>
  );
}
