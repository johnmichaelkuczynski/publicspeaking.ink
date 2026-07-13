import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  intro: 4000,
  mic: 4500,
  metrics: 5000,
  curriculum: 4000,
  outro: 4500,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: Scene1,
  mic: Scene2,
  metrics: Scene3,
  curriculum: Scene4,
  outro: Scene5,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
    // `muted` is intentionally excluded: mute is declarative via the <audio> prop
    // and must not re-trigger a scene reseek.
  }, [currentSceneKey, baseSceneKey]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[var(--color-bg-dark)] font-body text-white">
      {/* Persistent Background Layer */}
      <div className="absolute inset-0">
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
          src={`${import.meta.env.BASE_URL}videos/bg-waves.mp4`}
          autoPlay muted loop playsInline
        />

        {/* Animated Gradient Overlay */}
        <motion.div
          className="absolute inset-0 opacity-50"
          style={{ background: 'radial-gradient(circle at center, var(--color-bg-light) 0%, transparent 70%)' }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Dynamic accent color blob */}
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[100px] pointer-events-none mix-blend-screen"
          style={{ backgroundColor: 'var(--color-secondary)', opacity: 0.15 }}
          animate={{
            x: ['-20%', '20%', '-10%', '0%'][sceneIndex % 4],
            y: ['-20%', '10%', '30%', '0%'][sceneIndex % 4],
            scale: [1, 1.5, 0.8, 1.2][sceneIndex % 4],
            backgroundColor: [
              'var(--color-secondary)',
              'var(--color-accent)',
              'var(--color-secondary)',
              'var(--color-accent)'
            ][sceneIndex % 4]
          }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />
      </div>

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
