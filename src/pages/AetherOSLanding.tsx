import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';

function NeuralBackground() {
  return (
    <>
      <ambientLight intensity={0.2} color="#112233" />
      <pointLight position={[10, 20, 10]} intensity={0.8} color="#ffcc88" />

      <Stars
        radius={400}
        depth={60}
        count={1200}
        factor={3}
        saturation={0}
        fade
        speed={0.4}
      />

      <mesh position={[0, 0, -100]}>
        <sphereGeometry args={[14, 64, 64]} />
        <meshStandardMaterial
          color="#001122"
          emissive="#00ccff"
          emissiveIntensity={0.7}
          metalness={0.95}
          roughness={0.15}
        />
      </mesh>

      <EffectComposer>
        <Bloom
          kernelSize={KernelSize.LARGE}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.6}
          intensity={1.4}
        />
      </EffectComposer>
    </>
  );
}

export function AetherOSLanding() {
  return (
    <div className="bg-black text-white overflow-hidden relative min-h-screen">
      {/* 3D Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Canvas
          camera={{ position: [0, 0, 140], fov: 42 }}
          gl={{ alpha: true, antialias: true }}
        >
          <Suspense fallback={null}>
            <NeuralBackground />
          </Suspense>
        </Canvas>
      </div>

      {/* HERO SECTION */}
      <section className="relative h-screen flex items-center justify-center z-10">
        {/* Placeholder Hero Image - Gradient */}
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-6xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
            className="text-6xl md:text-[7rem] font-bold tracking-[-0.08em] mb-6 bg-gradient-to-r from-amber-300 via-white to-cyan-300 bg-clip-text text-transparent"
          >
            RealSync Dynamics AI
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-2xl md:text-3xl max-w-4xl mx-auto text-white/90 font-light"
          >
            Sichere Navigation in die Zukunft der Künstlichen Intelligenz
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-6 text-xl text-white/70"
          >
            AetherOS — Das KI-Betriebssystem für digitale Souveränität
          </motion.p>

          <div className="mt-20 flex flex-col sm:flex-row gap-6 justify-center">
            <motion.a
              href="#aetheros"
              whileHover={{ scale: 1.08, y: -4 }}
              whileTap={{ scale: 0.96 }}
              className="px-14 py-6 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold text-xl rounded-2xl shadow-xl shadow-amber-500/40 hover:shadow-2xl transition-all cursor-pointer"
            >
              AetherOS entdecken
            </motion.a>

            <motion.a
              href="#mission"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="px-14 py-6 border-2 border-white/60 hover:bg-white/10 rounded-2xl text-xl transition-all cursor-pointer"
            >
              Unsere Mission
            </motion.a>
          </div>
        </div>

        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-4xl text-white/40"
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          ↓
        </motion.div>
      </section>

      {/* MISSION SECTION */}
      <section id="mission" className="py-32 relative z-10 bg-zinc-950/80">
        <div className="max-w-5xl mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-bold text-center mb-16 bg-gradient-to-r from-amber-400 to-cyan-400 bg-clip-text text-transparent"
          >
            Harmonie zwischen Natur und Technologie
          </motion.h2>

          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="space-y-8 text-lg"
            >
              <p className="text-2xl leading-relaxed">
                Wie ein modernes Schiff sicher durch unbekannte Gewässer navigiert, verbinden wir die Schönheit der Natur mit der Macht verantwortungsvoller Technologie.
              </p>
              <p className="text-white/80">
                Wir schaffen Systeme, die nicht nur regulatorisch sicher sind, sondern eine positive, vertrauensvolle und souveräne Zukunft ermöglichen.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              className="aspect-video bg-zinc-900 rounded-3xl flex items-center justify-center text-[180px] opacity-30"
            >
              🧭
            </motion.div>
          </div>
        </div>
      </section>

      {/* AETHEROS SECTION */}
      <section id="aetheros" className="py-32 relative z-10">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-6xl font-bold mb-6">AetherOS</h2>
          <p className="text-2xl text-white/70 mb-20">Das KI-Betriebssystem für DSGVO, EU AI Act und echte Souveränität</p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              ["Kontinuierliche Governance", "Echtzeit-Audits & unveränderlicher Evidence Vault"],
              ["Runtime-native Souveränität", "EU-Residency, lokale Modelle und volle Kontrolle"],
              ["Transparente Compliance", "Metered Billing mit klarer Wertschöpfung"]
            ].map(([title, desc], i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 80 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -15 }}
                className="bg-zinc-900/70 border border-white/10 p-10 rounded-3xl hover:border-amber-400/50 transition-all"
              >
                <h3 className="text-2xl font-semibold mb-4 text-amber-400">{title}</h3>
                <p className="text-white/70">{desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.a
            href="https://realsyncdynamicsai.de"
            whileHover={{ scale: 1.1 }}
            className="mt-20 inline-block px-16 py-7 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold text-2xl rounded-2xl cursor-pointer"
          >
            Jetzt AetherOS starten →
          </motion.a>
        </div>
      </section>
    </div>
  );
}
