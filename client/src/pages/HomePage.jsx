import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useScroll, useTransform } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Bike,
  Brain,
  Car,
  Cpu,
  Footprints,
  Gauge,
  MapPin,
  Navigation2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import './HomePage.css';

const VIDEO_SOURCE =
  'https://video-previews.elements.envatousercontent.com/h264-video-previews/90918ed5-23ab-4ab9-8e99-445d91fce27a/7863568.mp4';

const SPLASH_VIDEO_CLIP = { start: 0.8, end: 6.4, rate: 0.94 };
const HERO_STAGE_VIDEO_CLIP = { start: 12.9, end: 18.4, rate: 0.95 };
const CINEMA_HERO_CLIP = { start: 9.0, end: 16.8, rate: 0.88 };
const FINAL_VIDEO_CLIP = { start: 4.8, end: 10.6, rate: 0.9 };

const VIDEO_CLIPS = [
  {
    id: 'traffic-lane',
    title: 'Traffic Dynamics',
    subtitle: 'Realtime flow and density',
    start: 0.8,
    end: 6.4,
    rate: 1.04,
  },
  {
    id: 'city-camera',
    title: 'Camera Transition',
    subtitle: 'Zoom and angle movement',
    start: 8.2,
    end: 13.8,
    rate: 0.92,
  },
  {
    id: 'network-view',
    title: 'Network View',
    subtitle: 'Wide route intelligence',
    start: 15.8,
    end: 21.9,
    rate: 0.98,
  },
];

const FEATURE_CARDS = [
  {
    title: 'Smart Routing',
    text: 'Heuristic AI scoring across time, traffic, and distance for better route decisions.',
    icon: Brain,
  },
  {
    title: 'Traffic Awareness',
    text: 'Live congestion pulse simulation with route sensitivity and dynamic warning signals.',
    icon: Activity,
  },
  {
    title: 'User Preferences',
    text: 'Adaptive behavior for avoid tolls, avoid highways, and fastest-vs-balanced route choices.',
    icon: SlidersHorizontal,
  },
  {
    title: 'Dynamic Updates',
    text: 'Continuous reranking of alternatives while conditions change in real time.',
    icon: Zap,
  },
];

const STATS = [
  { value: 30, suffix: '%', label: 'Faster Routes' },
  { value: 99, suffix: '%', label: 'Real-Time Updates' },
  { value: 94, suffix: '%', label: 'AI Optimized Decisions' },
];

const INITIAL_METRICS = [
  { id: 'Route A', time: 62, traffic: 35, distance: 44 },
  { id: 'Route B', time: 58, traffic: 49, distance: 38 },
  { id: 'Route C', time: 54, traffic: 61, distance: 42 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function SegmentedVideo({ className, start, end, rate = 1, preload = 'metadata' }) {
  const ref = useRef(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;

    const seekStart = () => {
      video.playbackRate = rate;
      if (!Number.isNaN(video.duration) && video.duration > start) {
        video.currentTime = start;
      }
      video.play().catch(() => {});
    };

    const loopSegment = () => {
      if (video.currentTime >= end) {
        video.currentTime = start;
      }
    };

    video.addEventListener('loadedmetadata', seekStart);
    video.addEventListener('timeupdate', loopSegment);
    seekStart();

    return () => {
      video.removeEventListener('loadedmetadata', seekStart);
      video.removeEventListener('timeupdate', loopSegment);
    };
  }, [start, end, rate]);

  return (
    <video ref={ref} className={className} autoPlay muted playsInline preload={preload}>
      <source src={VIDEO_SOURCE} type="video/mp4" />
    </video>
  );
}

function SplashScreen() {
  return (
    <motion.div
      className="splash-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.21, 0.8, 0.25, 1] } }}
    >
      <motion.div
        className="splash-title-wrap"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.74, delay: 0.12 }}
      >
        <p className="splash-kicker">SmartRoute Intelligence Suite</p>
        <h1 className="splash-title">
          AI SMART <span>ROUTING</span>
        </h1>
        <p className="splash-subtitle">Adaptive decisions in motion, built for real roads and real-time traffic.</p>
      </motion.div>

      <motion.div
        className="splash-map"
        initial={{ scale: 1.42, rotate: 0.6, y: 14 }}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        transition={{ duration: 3.2, ease: [0.18, 0.82, 0.2, 1] }}
      >
        <SegmentedVideo
          className="splash-video"
          start={SPLASH_VIDEO_CLIP.start}
          end={SPLASH_VIDEO_CLIP.end}
          rate={SPLASH_VIDEO_CLIP.rate}
          preload="auto"
        />
        <div className="splash-video-overlay" />
        <div className="splash-grid" />
      </motion.div>

      <motion.div
        className="splash-copy"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.35 }}
      >
        <Sparkles size={14} />
        Initializing AI Smart Route Planner
      </motion.div>
    </motion.div>
  );
}

function HeroVideoPanel() {
  return (
    <div className="hero-video-stage">
      <SegmentedVideo
        className="hero-stage-video"
        start={HERO_STAGE_VIDEO_CLIP.start}
        end={HERO_STAGE_VIDEO_CLIP.end}
        rate={HERO_STAGE_VIDEO_CLIP.rate}
        preload="auto"
      />
      <div className="hero-stage-overlay" />
      <div className="hero-stage-grid" />
      <div className="hero-stage-chip hero-stage-chip-top">Live camera route</div>
      <div className="hero-stage-chip hero-stage-chip-bottom">Point to point zoom view</div>
    </div>
  );
}

function VideoClipCard({ clip, index }) {
  return (
    <motion.article
      className="video-card"
      initial={{ opacity: 0, x: index % 2 === 0 ? -28 : 28, y: 18 }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: false, amount: 0.34 }}
      transition={{ duration: 0.64, delay: index * 0.08 }}
      whileHover={{ y: -4, scale: 1.01 }}
    >
      <SegmentedVideo className="video-card-media" start={clip.start} end={clip.end} rate={clip.rate} />
      <div className="video-card-overlay" />
      <div className="video-card-meta">
        <h4>{clip.title}</h4>
        <p>{clip.subtitle}</p>
      </div>
    </motion.article>
  );
}

function HeroClipPreview({ clip }) {
  return (
    <article className="hero-clip-preview">
      <SegmentedVideo className="hero-clip-video" start={clip.start} end={clip.end} rate={clip.rate} />
      <div className="hero-clip-overlay" />
      <div className="hero-clip-meta">
        <h4>{clip.title}</h4>
        <p>{clip.subtitle}</p>
      </div>
    </article>
  );
}

function AnimatedStat({ item }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.4 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) {
      setCount(0);
      return undefined;
    }

    const start = performance.now();
    const duration = 1300;
    let raf = 0;

    const animate = (now) => {
      const progress = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(item.value * eased));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [inView, item.value]);

  return (
    <div ref={ref} className="stat-card">
      <div className="stat-value">
        {count}
        {item.suffix}
      </div>
      <div className="stat-label">{item.label}</div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);
  const [showSplash, setShowSplash] = useState(true);
  const [source, setSource] = useState('Vijayawada');
  const [destination, setDestination] = useState('Guntur');
  const [vehicle, setVehicle] = useState('car');
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5 });
  const [metrics, setMetrics] = useState(INITIAL_METRICS);

  const { scrollYProgress } = useScroll({ container: scrollContainerRef });
  const backgroundY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -42]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onMove = (event) => {
      setPointer({
        x: clamp(event.clientX / window.innerWidth, 0, 1),
        y: clamp(event.clientY / window.innerHeight, 0, 1),
      });
    };

    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setMetrics((prev) =>
        prev.map((route) => ({
          ...route,
          time: clamp(route.time + (Math.random() - 0.5) * 7.6, 30, 92),
          traffic: clamp(route.traffic + (Math.random() - 0.5) * 10.8, 8, 95),
          distance: clamp(route.distance + (Math.random() - 0.5) * 8.8, 12, 90),
        }))
      );
    }, 1300);

    return () => clearInterval(timer);
  }, []);

  const scoredRoutes = useMemo(
    () =>
      metrics
        .map((route) => ({
          ...route,
          score: route.time * 0.5 + route.traffic * 0.3 + route.distance * 0.2,
        }))
        .sort((a, b) => a.score - b.score),
    [metrics]
  );

  const bestRoute = scoredRoutes[0]?.id;
  const px = (pointer.x - 0.5) * 24;
  const py = (pointer.y - 0.5) * 14;

  return (
    <div ref={scrollContainerRef} className={`route-home${showSplash ? ' splash-active' : ''}`}>
      <AnimatePresence>{showSplash && <SplashScreen />}</AnimatePresence>

      <motion.div className="route-background" style={{ y: backgroundY }}>
        <div className="gradient-wave gradient-wave-a" />
        <div className="gradient-wave gradient-wave-b" />
        <div className="grid-layer" />
      </motion.div>

      <motion.main className="route-main" style={{ y: contentY }}>
        <header className="top-bar">
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="open-planner-btn" onClick={() => navigate('/planner')}>
              Get Started
            </button>
            <button type="button" className="login-btn" onClick={() => navigate('/login')}>
              Login
            </button>
          </div>
          <div className="brand-pill">
            <Sparkles size={14} />
            AI Smart Route Planner
          </div>
        </header>

        <section className="hero-layout">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: showSplash ? 0.2 : 0 }}
            style={{ transform: `translate3d(${px * 0.42}px, ${py * 0.42}px, 0)` }}
          >
            <p className="hero-eyebrow">Production Routing Platform</p>
            <h1>Design Better Routes for Every Trip.</h1>
            <p>
              Real-time routing powered by traffic, distance, and behavior patterns. Made for teams that
              care about speed, reliability, and route confidence.
            </p>

            <div className="input-panel">
              <label className="input-row">
                <MapPin size={16} />
                <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source location" />
              </label>
              <label className="input-row">
                <Navigation2 size={16} />
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Destination location"
                />
              </label>
              <button type="button" className="find-route-btn" onClick={() => navigate('/planner')}>
                Find Smart Route
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="hero-tags">
              <span>
                <Zap size={13} />
                Live route draw
              </span>
              <span>
                <Activity size={13} />
                Traffic pulse
              </span>
              <span>
                <ShieldCheck size={13} />
                AI confidence 98%
              </span>
            </div>

            <div className="hero-clip-strip">
              {VIDEO_CLIPS.slice(0, 2).map((clip) => (
                <HeroClipPreview key={`hero-${clip.id}`} clip={clip} />
              ))}
            </div>
          </motion.div>

          <motion.div
            className="hero-map"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: showSplash ? 0.3 : 0.1 }}
            style={{ transform: `translate3d(${px * -0.48}px, ${py * -0.48}px, 0)` }}
          >
            <HeroVideoPanel />
          </motion.div>
        </section>

        <motion.section
          className="section cinematic-section"
          initial={{ opacity: 0, y: 34 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.24 }}
          transition={{ duration: 0.72 }}
        >
          <div className="section-head">
            <h2>Cinematic Route Experience</h2>
            <p>Realtime video sequence layers with zoom transitions, lane movement, and camera travel.</p>
          </div>

          <motion.div
            className="cinema-hero"
            initial={{ opacity: 0, scale: 0.94, y: 22 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: false, amount: 0.34 }}
            transition={{ duration: 0.72 }}
          >
            <SegmentedVideo
              className="cinema-hero-video"
              start={CINEMA_HERO_CLIP.start}
              end={CINEMA_HERO_CLIP.end}
              rate={CINEMA_HERO_CLIP.rate}
              preload="auto"
            />
            <div className="cinema-hero-overlay" />
            <div className="cinema-hero-tag">Zoom + camera angle transitions</div>
          </motion.div>

          <div className="video-card-grid">
            {VIDEO_CLIPS.map((clip, index) => (
              <VideoClipCard key={clip.id} clip={clip} index={index} />
            ))}
          </div>
        </motion.section>

        <motion.section
          className="section"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.26 }}
          transition={{ duration: 0.65 }}
        >
          <div className="section-head">
            <h2>Core Intelligence Modules</h2>
            <p>Smart decision engine modules that stay responsive while conditions evolve.</p>
          </div>
          <div className="feature-grid">
            {FEATURE_CARDS.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  key={feature.title}
                  className="feature-card"
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.55, delay: index * 0.08 }}
                >
                  <div className="feature-icon">
                    <Icon size={18} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </motion.article>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          className="section section-ai"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.26 }}
          transition={{ duration: 0.68 }}
        >
          <div className="section-head">
            <h2>Routes to AI Brain to Best Route</h2>
            <p>Weighted scoring model: 0.5 time + 0.3 traffic + 0.2 distance.</p>
          </div>

          <div className="ai-layout">
            <div className="flow-panel">
              <div className="flow-lineup">
                <div className="flow-node">
                  <MapPin size={17} />
                  Routes
                </div>
                <div className="flow-connector" />
                <div className="flow-node flow-brain">
                  <Brain size={17} />
                  AI Brain
                </div>
                <div className="flow-connector" />
                <div className="flow-node flow-best">
                  <Cpu size={17} />
                  Best Route
                </div>
              </div>

              <div className="ai-radar-card">
                <div className="ai-radar">
                  <div className="ai-radar-ring ai-radar-ring-a" />
                  <div className="ai-radar-ring ai-radar-ring-b" />
                  <div className="ai-radar-ring ai-radar-ring-c" />
                  <div className="ai-radar-core">
                    <Brain size={18} />
                    {bestRoute}
                  </div>
                </div>
                <p>Live confidence pulse updates while travel-time and traffic values shift every second.</p>
              </div>
            </div>

            <div className="score-board">
              {scoredRoutes.map((route) => {
                const width = clamp(100 - route.score, 8, 94);
                const isBest = route.id === bestRoute;
                return (
                  <div key={route.id} className={`score-row ${isBest ? 'is-best' : ''}`}>
                    <div className="score-label">{route.id}</div>
                    <div className="score-track">
                      <motion.div
                        className="score-fill"
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.6, ease: [0.2, 0.82, 0.2, 1] }}
                      />
                    </div>
                    <div className="score-value">{route.score.toFixed(1)}</div>
                  </div>
                );
              })}

              <div className="score-meta">
                <span>
                  <Gauge size={13} />
                  Time
                </span>
                <span>
                  <Activity size={13} />
                  Traffic
                </span>
                <span>
                  <SlidersHorizontal size={13} />
                  Distance
                </span>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          className="section"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.28 }}
          transition={{ duration: 0.72 }}
        >
          <div className="section-head">
            <h2>Platform Impact</h2>
            <p>Measured outcomes from route intelligence and dynamic updates.</p>
          </div>

          <div className="impact-layout">
            <div className="stats-grid">
              {STATS.map((item) => (
                <AnimatedStat key={item.label} item={item} />
              ))}
            </div>

            <aside className="impact-snapshot">
              <div className="impact-snapshot-head">
                <h3>Live Decision Snapshot</h3>
                <span>{bestRoute} leading</span>
              </div>
              <p>Weights rebalance continuously based on time, traffic pulse, and distance quality.</p>

              <div className="snapshot-bars">
                {scoredRoutes.map((route) => {
                  const confidence = clamp(112 - route.score, 20, 96);
                  return (
                    <div key={`snapshot-${route.id}`} className="snapshot-row">
                      <strong>{route.id}</strong>
                      <div className="snapshot-track">
                        <motion.div
                          className="snapshot-fill"
                          animate={{ width: `${confidence}%` }}
                          transition={{ duration: 0.6, ease: [0.2, 0.82, 0.2, 1] }}
                        />
                      </div>
                      <span>{confidence.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>

              <div className="vehicle-switch">
                <button
                  type="button"
                  className={`vehicle-btn ${vehicle === 'car' ? 'active' : ''}`}
                  onClick={() => setVehicle('car')}
                >
                  <Car size={16} />
                  Car
                </button>
                <button
                  type="button"
                  className={`vehicle-btn ${vehicle === 'bike' ? 'active' : ''}`}
                  onClick={() => setVehicle('bike')}
                >
                  <Bike size={16} />
                  Bike
                </button>
                <button
                  type="button"
                  className={`vehicle-btn ${vehicle === 'walk' ? 'active' : ''}`}
                  onClick={() => setVehicle('walk')}
                >
                  <Footprints size={16} />
                  Walk
                </button>
              </div>
            </aside>
          </div>
        </motion.section>

        <motion.section
          className="section final-callout"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.32 }}
          transition={{ duration: 0.64 }}
        >
          <div className="final-callout-copy">
            <p className="final-kicker">Start A Better Session</p>
            <h2>Ship your next route plan with clarity and confidence.</h2>
            <p>
              Live signals, route scoring, and clean UX in one place. Get started and run your next
              navigation decision flow in seconds.
            </p>
            <button type="button" className="final-callout-btn" onClick={() => navigate('/planner')}>
              Get Started
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="final-callout-media">
            <SegmentedVideo
              className="final-callout-video"
              start={FINAL_VIDEO_CLIP.start}
              end={FINAL_VIDEO_CLIP.end}
              rate={FINAL_VIDEO_CLIP.rate}
              preload="auto"
            />
            <div className="final-callout-overlay" />
            <div className="final-callout-chip">Realtime camera lane + map context</div>
          </div>
        </motion.section>
      </motion.main>
    </div>
  );
}
