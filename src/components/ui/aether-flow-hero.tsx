import { ArrowRight, Zap } from "lucide-react";

const AetherFlowHero = () => {
  return (
    <section
      className="relative flex min-h-[560px] w-full flex-col items-center justify-center overflow-hidden bg-black md:min-h-[680px]"
      aria-label="EduWallet platform introduction"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(128,90,213,.22), transparent 28%), radial-gradient(circle at 80% 30%, rgba(0,168,132,.16), transparent 30%), radial-gradient(circle at 50% 90%, rgba(37,211,102,.10), transparent 35%)",
        }}
      />
      <div className="relative z-10 max-w-4xl px-6 py-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm">
          <Zap className="h-4 w-4 text-purple-300" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-200">Your smarter study resource hub</span>
        </div>
        <h1 className="mb-6 text-balance bg-gradient-to-b from-white to-gray-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl md:text-8xl">
          Study smarter with EduWallet
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-base leading-7 text-gray-400 sm:text-lg">
          Discover exam-focused notes, practice papers, guides and free resources designed to make your preparation simpler and more organized.
        </p>
        <a
          href="/shop"
          className="mx-auto inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 font-semibold text-black shadow-lg transition-colors duration-200 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Explore Resources
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
};

export default AetherFlowHero;
