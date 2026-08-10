"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

type Phase = {
  name: string;
  shortName: string;
  progress: number;
  illumination: number;
  age: number;
  moonrise: string;
  moonset: string;
  distance: string;
  next: string;
};

const phases: Phase[] = [
  {
    name: "New Moon",
    shortName: "New",
    progress: 0,
    illumination: 0.4,
    age: 0.2,
    moonrise: "06:12",
    moonset: "18:37",
    distance: "386,120 km",
    next: "First Quarter · 7 days",
  },
  {
    name: "Waxing Crescent",
    shortName: "Waxing Crescent",
    progress: 0.125,
    illumination: 15.1,
    age: 3.8,
    moonrise: "09:18",
    moonset: "21:42",
    distance: "383,760 km",
    next: "First Quarter · 3 days",
  },
  {
    name: "First Quarter",
    shortName: "First Quarter",
    progress: 0.25,
    illumination: 50.0,
    age: 7.4,
    moonrise: "12:31",
    moonset: "00:46",
    distance: "381,920 km",
    next: "Full Moon · 7 days",
  },
  {
    name: "Waxing Gibbous",
    shortName: "Waxing Gibbous",
    progress: 0.375,
    illumination: 84.6,
    age: 11.1,
    moonrise: "15:48",
    moonset: "03:28",
    distance: "382,540 km",
    next: "Full Moon · 3 days",
  },
  {
    name: "Full Moon",
    shortName: "Full",
    progress: 0.5,
    illumination: 98.3,
    age: 14.2,
    moonrise: "19:04",
    moonset: "05:48",
    distance: "384,400 km",
    next: "Waning Gibbous · 2 days",
  },
  {
    name: "Waning Gibbous",
    shortName: "Waning Gibbous",
    progress: 0.625,
    illumination: 82.2,
    age: 18.5,
    moonrise: "22:17",
    moonset: "09:22",
    distance: "388,140 km",
    next: "Last Quarter · 3 days",
  },
  {
    name: "Last Quarter",
    shortName: "Last Quarter",
    progress: 0.75,
    illumination: 50.0,
    age: 22.1,
    moonrise: "00:36",
    moonset: "12:19",
    distance: "390,060 km",
    next: "New Moon · 7 days",
  },
  {
    name: "Waning Crescent",
    shortName: "Waning Crescent",
    progress: 0.875,
    illumination: 13.8,
    age: 25.8,
    moonrise: "03:42",
    moonset: "15:27",
    distance: "388,720 km",
    next: "New Moon · 3 days",
  },
];

function nearestPhaseIndex(progress: number) {
  return Math.round(progress * 8) % 8;
}

function MoonCanvas({ progress }: { progress: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    camera.position.set(0, 0, 6.4);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.78;
    mount.appendChild(renderer.domElement);

    const textureLoader = new THREE.TextureLoader();
    const colorMap = textureLoader.load("/textures/moon-color.jpg");
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const heightMap = textureLoader.load("/textures/moon-height.jpg");

    const moonGroup = new THREE.Group();
    scene.add(moonGroup);

    const geometry = new THREE.SphereGeometry(1.72, 192, 96);
    const material = new THREE.MeshStandardMaterial({
      map: colorMap,
      bumpMap: heightMap,
      bumpScale: 0.075,
      displacementMap: heightMap,
      displacementScale: 0.028,
      displacementBias: -0.01,
      roughness: 0.96,
      metalness: 0,
    });
    const moon = new THREE.Mesh(geometry, material);
    moon.rotation.set(0.06, -1.5, -0.025);
    moonGroup.add(moon);

    const sunlight = new THREE.DirectionalLight(0xf4f7ff, 4.6);
    scene.add(sunlight);
    const earthshine = new THREE.HemisphereLight(0x8da4bd, 0x020305, 0.055);
    scene.add(earthshine);
    const rim = new THREE.DirectionalLight(0x9eb7cf, 0.14);
    rim.position.set(-3, 2.5, -5);
    scene.add(rim);

    function makeStars(count: number, size: number, opacity: number) {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        positions[i * 3] = (Math.random() - 0.5) * 28;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
        positions[i * 3 + 2] = -2 - Math.random() * 28;
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const starMaterial = new THREE.PointsMaterial({
        color: 0xdde9f4,
        size,
        sizeAttenuation: true,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      const points = new THREE.Points(starGeometry, starMaterial);
      scene.add(points);
      return { points, starGeometry, starMaterial };
    }

    const distantStars = makeStars(2300, 0.014, 0.48);
    const nearStars = makeStars(260, 0.032, 0.78);
    const pointer = new THREE.Vector2();
    let currentAngle = progressRef.current * Math.PI * 2;
    let frame = 0;
    let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      reduceMotion = motionQuery.matches;
    };

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      moonGroup.position.x = width < 740 ? 0 : 0.68;
      moonGroup.scale.setScalar(width < 740 ? 0.83 : 1);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    motionQuery.addEventListener("change", onMotionChange);

    const clock = new THREE.Clock();
    const render = () => {
      const elapsed = clock.getElapsedTime();
      const rawTarget = progressRef.current * Math.PI * 2;
      const wrappedDifference = Math.atan2(
        Math.sin(rawTarget - currentAngle),
        Math.cos(rawTarget - currentAngle),
      );
      currentAngle += wrappedDifference * (reduceMotion ? 0.12 : 0.035);

      sunlight.position.set(
        Math.sin(currentAngle) * 7,
        0.4,
        -Math.cos(currentAngle) * 7,
      );

      if (!reduceMotion) {
        moon.rotation.y += 0.00022;
        moonGroup.rotation.y += (pointer.x * 0.035 - moonGroup.rotation.y) * 0.018;
        moonGroup.rotation.x += (-pointer.y * 0.022 - moonGroup.rotation.x) * 0.018;
        moonGroup.position.y = Math.sin(elapsed * 0.32) * 0.035;
        distantStars.points.position.x = pointer.x * -0.045;
        distantStars.points.position.y = pointer.y * 0.03;
        nearStars.points.position.x = pointer.x * -0.09;
        nearStars.points.position.y = pointer.y * 0.06;
        nearStars.starMaterial.opacity = 0.7 + Math.sin(elapsed * 0.7) * 0.08;
      }

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      motionQuery.removeEventListener("change", onMotionChange);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      colorMap.dispose();
      heightMap.dispose();
      distantStars.starGeometry.dispose();
      distantStars.starMaterial.dispose();
      nearStars.starGeometry.dispose();
      nearStars.starMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="moon-canvas" ref={mountRef} aria-hidden="true" />;
}

function MiniMoon({ phase, large = false }: { phase: number; large?: boolean }) {
  const index = nearestPhaseIndex(phase);
  return (
    <span
      className={`mini-moon phase-${index}${large ? " mini-moon-large" : ""}`}
      aria-hidden="true"
    />
  );
}

function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="data-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PhaseRail({
  progress,
  onChange,
}: {
  progress: number;
  onChange: (phase: number) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const activeIndex = nearestPhaseIndex(progress);

  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (!rail) return;
    const bounds = rail.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    onChange((x / bounds.width) * 0.875);
  };

  return (
    <div
      className="phase-rail-wrap"
      ref={railRef}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (dragging.current) updateFromPointer(event);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <div className="phase-orbit-line" aria-hidden="true" />
      <div className="phase-list" role="list" aria-label="Lunar phases">
        {phases.map((phase, index) => (
          <button
            type="button"
            className={`phase-option${activeIndex === index ? " active" : ""}`}
            key={phase.name}
            onClick={() => onChange(phase.progress)}
            aria-pressed={activeIndex === index}
          >
            <MiniMoon phase={phase.progress} />
            <span>{phase.shortName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MoonExperience() {
  const [progress, setProgress] = useState(0.5);
  const activePhase = phases[nearestPhaseIndex(progress)];
  const calculatedIllumination = Math.max(
    0.4,
    ((1 - Math.cos(progress * Math.PI * 2)) / 2) * 100,
  );
  const isExactPhase = Math.abs(progress - activePhase.progress) < 0.003;
  const illumination = isExactPhase
    ? activePhase.illumination
    : calculatedIllumination;
  const lunarAge = progress * 29.53;

  const calendarDays = useMemo(() => {
    return Array.from({ length: 28 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 7, 12 + index));
      const dayProgress = (0.28 + index / 29.53) % 1;
      const majorPhase = [
        { p: 0, name: "New Moon" },
        { p: 0.25, name: "First Quarter" },
        { p: 0.5, name: "Full Moon" },
        { p: 0.75, name: "Last Quarter" },
      ].find(({ p }) => {
        const difference = Math.abs(dayProgress - p);
        return Math.min(difference, 1 - difference) < 0.021;
      });
      return {
        date,
        progress: dayProgress,
        major: majorPhase?.name,
      };
    });
  }, []);

  return (
    <main>
      <section className="hero" id="cycle">
        <div className="cosmic-haze" aria-hidden="true" />
        <MoonCanvas progress={progress} />

        <nav className="nav-shell" aria-label="Primary navigation">
          <a className="wordmark" href="#cycle" aria-label="SELENE home">
            <span className="wordmark-mark" aria-hidden="true" />
            SELENE
          </a>
          <div className="nav-links">
            <a href="#cycle">Cycle</a>
            <a href="#tonight">Tonight</a>
            <a href="#calendar">Calendar</a>
            <a href="#about">About</a>
          </div>
          <span className="live-mark"><i /> Live ephemeris</span>
        </nav>

        <div className="hero-copy">
          <p className="eyebrow">Lunar observatory · 11 Aug 2026</p>
          <h1>{activePhase.name}</h1>
          <div className="hero-measures" aria-live="polite">
            <span>{illumination.toFixed(1)}% illuminated</span>
            <i />
            <span>{lunarAge.toFixed(1)} days</span>
          </div>
        </div>

        <div className="annotation annotation-left">
          <span>Illumination</span>
          <strong>{illumination.toFixed(1)}%</strong>
        </div>
        <div className="annotation annotation-right-top">
          <span>Distance</span>
          <strong>{activePhase.distance}</strong>
        </div>
        <div className="annotation annotation-right-bottom">
          <span>Next phase</span>
          <strong>{activePhase.next}</strong>
        </div>
        <div className="annotation annotation-bottom">
          <span>Rise / Set</span>
          <strong>{activePhase.moonrise} / {activePhase.moonset}</strong>
        </div>

        <div className="hero-index" aria-hidden="true">
          <span>34° 12′ 08″ N</span>
          <i />
          <span>OBS—01</span>
        </div>
        <a className="scroll-cue" href="#lunar-cycle">
          <span /> Explore the cycle
        </a>
      </section>

      <section className="cycle-section" id="lunar-cycle">
        <div className="section-heading split-heading">
          <div>
            <p className="section-index">01 — Lunar cycle</p>
            <h2>Twenty-nine days,<br /><em>one continuous motion.</em></h2>
          </div>
          <p>
            Drag across the orbit to observe how sunlight travels over the lunar
            surface. The Moon does not change—only our view of its illuminated half.
          </p>
        </div>

        <PhaseRail progress={progress} onChange={setProgress} />

        <div className="cycle-readout">
          <div className="phase-number">{String(nearestPhaseIndex(progress) + 1).padStart(2, "0")}</div>
          <div>
            <span>Selected phase</span>
            <strong>{activePhase.name}</strong>
          </div>
          <div>
            <span>Lunar age</span>
            <strong>{lunarAge.toFixed(1)} days</strong>
          </div>
          <div>
            <span>Illumination</span>
            <strong>{illumination.toFixed(1)}%</strong>
          </div>
          <div>
            <span>Distance</span>
            <strong>{activePhase.distance}</strong>
          </div>
        </div>
      </section>

      <section className="tonight-section" id="tonight">
        <div className="tonight-visual">
          <div className="tonight-orbits" aria-hidden="true">
            <span className="orbit orbit-a" />
            <span className="orbit orbit-b" />
          </div>
          <MiniMoon phase={progress} large />
          <div className="visual-coordinate">ALT +28.6°</div>
        </div>

        <div className="tonight-content">
          <p className="section-index">02 — Tonight’s Moon</p>
          <h2>Above the southern<br /><em>horizon tonight.</em></h2>
          <p className="tonight-intro">
            Best observed after nautical twilight, when the Moon crosses the
            meridian and atmospheric distortion is at its lowest.
          </p>
          <div className="tonight-data">
            <DataItem label="Altitude" value="28.6°" />
            <DataItem label="Azimuth" value="142° SE" />
            <DataItem label="Constellation" value="Aquarius" />
            <DataItem label="Apparent diameter" value="31′ 05″" />
            <DataItem label="Visibility" value="Excellent" />
            <DataItem label="Next full moon" value="28 Aug · 09:18" />
          </div>
        </div>
      </section>

      <section className="orbit-section">
        <div className="section-heading split-heading orbit-heading">
          <div>
            <p className="section-index">03 — Orbital geometry</p>
            <h2>A matter of<br /><em>perspective.</em></h2>
          </div>
          <p>
            The Sun always illuminates half the Moon. Its phase describes how much
            of that sunlit hemisphere is visible from Earth.
          </p>
        </div>

        <div className="orbit-stage">
          <div className="sun-source">
            <span>Sunlight</span>
            <i />
          </div>
          <div className="earth-wrap">
            <div className="earth" aria-label="Earth" />
            <span className="earth-label">Earth</span>
            <div className="moon-orbit-path" aria-hidden="true">
              <div className="orbiting-moon"><span /></div>
            </div>
          </div>
          <div className="orbit-note orbit-note-a"><span>384,400 km</span> Mean distance</div>
          <div className="orbit-note orbit-note-b"><span>27.3 days</span> Sidereal orbit</div>
          <div className="orbit-note orbit-note-c"><span>5.1°</span> Orbital inclination</div>
        </div>
      </section>

      <section className="why-section">
        <div className="why-copy">
          <p className="section-index">04 — Why does this phase happen?</p>
          <h2>{activePhase.name}</h2>
          <p>
            From Earth, we are seeing {illumination.toFixed(0)}% of the Moon’s
            sunlit hemisphere. The curved terminator marks the boundary between
            lunar day and night.
          </p>
        </div>
        <div className="geometry-diagram" aria-label="Sun, Earth and Moon phase geometry">
          <div className="diagram-sun"><span>Sun</span></div>
          <div className="light-rays"><i /><i /><i /></div>
          <div className="diagram-earth"><span>Earth</span></div>
          <div className="sight-line" />
          <div className="diagram-moon"><MiniMoon phase={progress} /><span>Moon</span></div>
        </div>
      </section>

      <section className="calendar-section" id="calendar">
        <div className="section-heading calendar-heading">
          <div>
            <p className="section-index">05 — Lunar calendar</p>
            <h2>August — September <em>2026</em></h2>
          </div>
          <p>Select a date to approximate its lunar phase.</p>
        </div>

        <div className="calendar-strip" role="list" aria-label="Upcoming lunar calendar">
          {calendarDays.map(({ date, progress: dayProgress, major }) => {
            const selected = Math.abs(dayProgress - progress) < 0.012;
            return (
              <button
                type="button"
                role="listitem"
                className={`calendar-day${selected ? " selected" : ""}${major ? " major" : ""}`}
                key={date.toISOString()}
                onClick={() => setProgress(dayProgress)}
                aria-label={`${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}${major ? `, ${major}` : ""}`}
              >
                <span className="calendar-major">{major || "·"}</span>
                <MiniMoon phase={dayProgress} />
                <strong>{date.getUTCDate()}</strong>
                <span>{date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>
              </button>
            );
          })}
        </div>
      </section>

      <footer id="about">
        <div className="footer-mark">
          <span className="wordmark-mark" aria-hidden="true" />
          <strong>SELENE</strong>
        </div>
        <p>A living observatory of the lunar cycle.</p>
        <div className="footer-meta">
          <span>Surface data · NASA LRO / LOLA</span>
          <span>Observation model · illustrative</span>
          <span>© 2026 Selene Observatory</span>
        </div>
      </footer>
    </main>
  );
}
