import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 2500),
      setTimeout(() => setPhase(5), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-[80vw] h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-100 flex overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-1/3 bg-gray-50 border-r border-gray-200 p-8 flex flex-col">
          <motion.div 
            className="flex items-center gap-2 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 1 ? 1 : 0 }}
          >
            <div className="w-3 h-3 rounded-full bg-[#9E1B1B]" />
            <span className="font-bold text-[#1A1A1A] uppercase tracking-wider text-sm">Adaptive Lecture</span>
          </motion.div>

          <motion.h3 
            className="text-[2.5vw] font-display font-bold leading-tight text-[#1A1A1A] mb-8"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: phase >= 1 ? 1 : 0, x: phase >= 1 ? 0 : -20 }}
            transition={{ duration: 0.5 }}
          >
            Read at<br/>your own pace.
          </motion.h3>

          <motion.div 
            className="flex bg-gray-200 rounded-lg p-1 mt-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 20 }}
          >
            <div className="flex-1 text-center py-2 rounded-md text-gray-500 font-medium text-sm">Short</div>
            <motion.div 
              className="flex-1 text-center py-2 bg-white shadow-sm rounded-md text-[#9E1B1B] font-bold text-sm"
              initial={{ scale: 0.95 }}
              animate={{ scale: phase >= 2 ? 1 : 0.95 }}
            >
              Medium
            </motion.div>
            <div className="flex-1 text-center py-2 rounded-md text-gray-500 font-medium text-sm">Long</div>
          </motion.div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-12 relative flex flex-col justify-center">
          
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 3 ? 1 : 0 }}
          >
            <div className="h-4 bg-gray-200 rounded-full w-3/4" />
            <div className="h-4 bg-gray-200 rounded-full w-full" />
            <div className="h-4 bg-gray-200 rounded-full w-5/6" />
            <div className="h-4 bg-gray-200 rounded-full w-full" />
            <div className="h-4 bg-gray-200 rounded-full w-2/3" />
          </motion.div>

          {/* AI Tutor Popup */}
          <motion.div 
            className="absolute bottom-12 right-12 w-80 bg-white rounded-xl shadow-xl border border-[#E5B824]/30 p-6"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: phase >= 4 ? 1 : 0, y: phase >= 4 ? 0 : 50, scale: phase >= 4 ? 1 : 0.9 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#E5B824]/20 flex items-center justify-center">
                <span className="text-[#E5B824]">✨</span>
              </div>
              <span className="font-bold text-[#1A1A1A]">AI Tutor</span>
            </div>
            <div className="space-y-3">
              <div className="h-3 bg-[#E5B824]/10 rounded-full w-full" />
              <div className="h-3 bg-[#E5B824]/10 rounded-full w-5/6" />
              <div className="h-3 bg-[#E5B824]/10 rounded-full w-4/6" />
            </div>
          </motion.div>
        </div>

      </div>
    </motion.div>
  );
}
