import React, {
  useState,
  useRef,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, useGLTF, Line, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, X, Check, Play, ChevronDown, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CIRViewer from "@/components/CIRViewer";

function generateId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const useJobQueue = () => {
  const [jobs, setJobs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingJobs, setIsFetchingJobs] = useState(false);

  const DATABASE_URL = "/api/db";

  const submitJob = async (config) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${DATABASE_URL}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!response.ok) throw new Error("Failed to submit job");
      return await response.json();
    } catch (error) {
      console.error("Error submitting job:", error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchJobs = async () => {
    setIsFetchingJobs(true);
    try {
      const response = await fetch(`${DATABASE_URL}/jobs`);
      if (!response.ok) throw new Error("Failed to fetch jobs");
      const fetchedJobs = await response.json();
      setJobs(fetchedJobs);
      return fetchedJobs;
    } catch (error) {
      console.error("Error fetching jobs:", error);
      throw error;
    } finally {
      setIsFetchingJobs(false);
    }
  };

  return { jobs, isSubmitting, isFetchingJobs, submitJob, fetchJobs };
};

const useModels = () => {
  const [models, setModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const DATABASE_URL = "/api/db";

  const fetchModels = async () => {
    setIsLoadingModels(true);
    try {
      const response = await fetch(`${DATABASE_URL}/models`);
      if (!response.ok) throw new Error("Failed to fetch models");
      const fetchedModels = await response.json();
      setModels(fetchedModels);
      return fetchedModels;
    } catch (error) {
      console.error("Error fetching models:", error);
      throw error;
    } finally {
      setIsLoadingModels(false);
    }
  };

  return { models, isLoadingModels, fetchModels };
};

function AccordionSection({ title, isOpen, onToggle, children, badge }) {
  return (
    <div className="border-b border-gray-700/50">
      <button
        className="w-full flex items-center justify-between py-3 px-4 text-sm font-medium text-gray-200 hover:text-white hover:bg-gray-800/50 transition-colors"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge !== undefined && (
            <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function CameraSwitcher({ is3D }) {
  const { camera, gl } = useThree();
  const cameraState2DRef = useRef(null);
  const cameraState3DRef = useRef(null);

  useEffect(() => {
    if (camera.type === "PerspectiveCamera") {
      cameraState2DRef.current = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
      };
    } else if (camera.type === "OrthographicCamera") {
      cameraState3DRef.current = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        zoom: camera.zoom,
      };
    }

    if (is3D) {
      const aspect =
        typeof window !== "undefined" ? window.innerWidth / window.innerHeight : 16 / 9;
      const frustum = 50;
      Object.assign(camera, {
        left: -frustum * aspect,
        right: frustum * aspect,
        top: frustum,
        bottom: -frustum,
        near: 0.1,
        far: 1000,
        type: "OrthographicCamera",
      });
      camera.zoom = 1;
      if (cameraState3DRef.current) {
        camera.position.copy(cameraState3DRef.current.position);
        camera.quaternion.copy(cameraState3DRef.current.quaternion);
        camera.zoom = cameraState3DRef.current.zoom;
      } else {
        camera.position.set(0, 100, 0);
        camera.up.set(0, 0, -1);
        camera.lookAt(0, 0, 0);
      }
    } else {
      camera.type = "PerspectiveCamera";
      camera.fov = 50;
      if (cameraState2DRef.current) {
        camera.position.copy(cameraState2DRef.current.position);
        camera.quaternion.copy(cameraState2DRef.current.quaternion);
      } else {
        camera.position.set(40, 40, 40);
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 0, 0);
      }
    }
    camera.updateProjectionMatrix();
  }, [is3D, camera]);

  useEffect(() => {
    if (!is3D) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 5 : -5;
      camera.position.y = THREE.MathUtils.clamp(camera.position.y + delta, 10, 200);
    };
    gl.domElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => gl.domElement.removeEventListener("wheel", handleWheel);
  }, [is3D, camera, gl.domElement]);

  return null;
}

function MotionPath({ motion, drones, color }) {
  const drone = drones.find((d) => d.id === motion.droneId);
  if (!drone) return null;

  const points = useMemo(() => {
    if (motion.motion_type === "Circle") {
      const numPoints = 32;
      const circlePoints = [];
      const centerX = drone.x + motion.radius;
      const centerY = drone.y;
      const centerZ = drone.z;
      for (let i = 0; i <= numPoints; i++) {
        const angle = Math.PI + (i / numPoints) * Math.PI * 2;
        const x = centerX + motion.radius * Math.cos(angle);
        const z = centerZ;
        const y = centerY + motion.radius * Math.sin(angle);
        circlePoints.push([x, z, y]);
      }
      return circlePoints;
    } else {
      return [
        [drone.x, drone.z, drone.y],
        [motion.endX, motion.endZ, motion.endY],
      ];
    }
  }, [motion, drone]);

  return (
    <Line
      points={points}
      color={color || "#ffffff"}
      lineWidth={3}
      dashed
      dashSize={0.8}
      dashScale={1}
      dashOffset={0}
      gapSize={0.4}
      transparent
      opacity={0.8}
    />
  );
}

function Model3D({ modelPath, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) {
  const fullModelPath = modelPath.startsWith("/3d_models")
    ? `/api/db${modelPath}`
    : modelPath;

  const { scene } = useGLTF(fullModelPath);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
}

function LoadingOverlay({ isModelSelected, onModelLoaded }) {
  const { progress } = useProgress();
  if (!isModelSelected && (progress === 0 || progress === 100)) return null;
  if (progress === 100) {
    setTimeout(() => onModelLoaded(), 100);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80 text-center">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          <div className="text-lg font-medium text-white">Loading 3D model...</div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-400">{Math.round(progress)}%</div>
        </div>
      </div>
    </div>
  );
}

function DroneBody({ color }) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.15, 32, 32]} />
        <meshStandardMaterial
          color={color}
          metalness={0.3}
          roughness={0.4}
          emissive={color}
          emissiveIntensity={0.1}
        />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.03, 0.03]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.8, 0.03, 0.03]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      {[
        [-0.4, 0.08, 0],
        [0.4, 0.08, 0],
        [0, 0.08, -0.4],
        [0, 0.08, 0.4],
      ].map((pos, idx) => (
        <group key={idx} position={pos}>
          <mesh castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.05]} />
            <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.04, 0]} rotation={[0, (idx * Math.PI) / 4, 0]}>
            <boxGeometry args={[0.2, 0.005, 0.02]} />
            <meshStandardMaterial color="#222222" metalness={0.4} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DroneMesh({ drone, is3D, onDrag }) {
  const { size, camera } = useThree();
  const meshRef = useRef();
  const colors = { rx: "#3b82f6", tx: "#ef4444", both: "#10b981" };

  const handleMove = useCallback(
    (e) => {
      const [xNDC, yNDC] = [
        (e.clientX / size.width) * 2 - 1,
        -(e.clientY / size.height) * 2 + 1,
      ];
      const vec = new THREE.Vector3(xNDC, yNDC, 0.5).unproject(camera);
      const dir = vec.sub(camera.position).normalize();
      const dist = -camera.position.y / dir.y;
      const pos = camera.position.clone().add(dir.multiplyScalar(dist));
      onDrag(drone.id, pos.x, pos.z);
    },
    [camera, drone.id, onDrag, size.width, size.height]
  );

  const stopDrag = () => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", stopDrag);
  };

  const startDrag = (e) => {
    if (!is3D) return;
    e.stopPropagation();
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopDrag);
  };

  return (
    <group
      ref={meshRef}
      position={[drone.x, drone.z, drone.y]}
      onPointerDown={startDrag}
      cursor={is3D ? "grab" : "default"}
      onPointerEnter={(e) => {
        if (is3D) e.object.scale.setScalar(1.1);
      }}
      onPointerLeave={(e) => {
        if (is3D) e.object.scale.setScalar(1);
      }}
    >
      <DroneBody color={colors[drone.role]} />
    </group>
  );
}

export default function Simulation() {
  const [mounted, setMounted] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [drones, setDrones] = useState([]);
  const [motions, setMotions] = useState([]);
  const [simulationSteps, setSimulationSteps] = useState(10);
  const [moveTogether, setMoveTogether] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [pathDronesSnapshot, setPathDronesSnapshot] = useState(null);

  const [selectedModel, setSelectedModel] = useState("");
  const [modelScale, setModelScale] = useState(1);
  const [modelPosition, setModelPosition] = useState([0, 0, 0]);
  const [modelRotation, setModelRotation] = useState([0, 0, 0]);
  const [isModelSelected, setIsModelSelected] = useState(false);

  const [radioFrequencyMHz, setRadioFrequencyMHz] = useState("6000");
  const [radioBandwidthMHz, setRadioBandwidthMHz] = useState("500");

  const [antennaNumRows, setAntennaNumRows] = useState(1);
  const [antennaNumCols, setAntennaNumCols] = useState(1);
  const [antennaVerticalSpacing, setAntennaVerticalSpacing] = useState(0);
  const [antennaHorizontalSpacing, setAntennaHorizontalSpacing] = useState(0);
  const [antennaPattern, setAntennaPattern] = useState("iso");
  const [antennaPolarization, setAntennaPolarization] = useState("H");

  const { jobs, isSubmitting, isFetchingJobs, submitJob, fetchJobs } = useJobQueue();
  const { models, isLoadingModels, fetchModels } = useModels();
  const [showJobIdPopup, setShowJobIdPopup] = useState(false);
  const [submittedJobId, setSubmittedJobId] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [cirViewerJobId, setCirViewerJobId] = useState(null);
  const lastFetchTimeRef = useRef(0);
  const [hasFetchedJobs, setHasFetchedJobs] = useState(false);
  const animRef = useRef({ start: 0, raf: 0, targets: [] });

  const [openSections, setOpenSections] = useState({
    drones: false,
    models: true,
    radio: false,
    antenna: false,
    simulation: false,
    jobs: false,
  });
  const [expandedDroneMotion, setExpandedDroneMotion] = useState(null);

  const toggleSection = (key) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => setMounted(true), []);

  const updateDrone = useCallback((id, field, value) => {
    setDrones((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, [field]: ["x", "y", "z"].includes(field) ? parseFloat(value) || 0 : value }
          : d
      )
    );
  }, []);

  const addDrone = useCallback(() => {
    const id = drones.length + 1;
    setDrones((prev) => [...prev, { id, x: 0, y: 0, z: 0, role: "both" }]);
  }, [drones.length]);

  const deleteDrone = useCallback((id) => {
    setDrones((prev) => prev.filter((d) => d.id !== id));
    setMotions((prev) => prev.filter((m) => m.droneId !== id));
    if (expandedDroneMotion === id) setExpandedDroneMotion(null);
  }, [expandedDroneMotion]);

  const handleDrag = useCallback((id, x, y) => {
    setDrones((prev) => prev.map((d) => (d.id === id ? { ...d, x, y } : d)));
  }, []);

  const getOrCreateMotion = useCallback(
    (droneId) => {
      const existing = motions.find((m) => m.droneId === droneId);
      if (existing) return existing;
      const drone = drones.find((d) => d.id === droneId);
      return {
        droneId,
        motion_type: "Straight",
        endX: (drone?.x || 0) + 5,
        endY: drone?.y || 0,
        endZ: drone?.z || 0,
        radius: 5,
      };
    },
    [motions, drones]
  );

  const saveMotion = useCallback((motionData) => {
    setMotions((prev) => {
      const idx = prev.findIndex((m) => m.droneId === motionData.droneId);
      if (idx >= 0) return prev.map((m, i) => (i === idx ? motionData : m));
      return [...prev, motionData];
    });
  }, []);

  const deleteMotion = useCallback((droneId) => {
    setMotions((prev) => prev.filter((m) => m.droneId !== droneId));
    setExpandedDroneMotion(null);
  }, []);

  const updateMotionField = useCallback(
    (droneId, field, value) => {
      const current = getOrCreateMotion(droneId);
      const updated = { ...current, [field]: value };
      saveMotion(updated);
    },
    [getOrCreateMotion, saveMotion]
  );

  const submitJobToQueue = useCallback(async () => {
    if (!selectedModel) return;

    try {
      setSubmitError(null);

      const shortId = generateId();
      const sceneName = selectedModel.split("/").pop().replace(/\.[^/.]+$/, "");

      const dronesConfig = drones.map((drone) => {
        const droneMotion = motions.find((m) => m.droneId === drone.id);
        return {
          location: [drone.x, drone.y, drone.z],
          has_motion: !!droneMotion,
          motion: droneMotion
            ? {
                motion_type: droneMotion.motion_type === "Straight" ? "line" : droneMotion.motion_type.toLowerCase(),
                radius: droneMotion.motion_type === "Circle" ? droneMotion.radius : 0.0,
                end_position: droneMotion.motion_type === "Straight" ? [droneMotion.endX, droneMotion.endY, droneMotion.endZ] : null,
              }
            : null,
        };
      });

      const config = {
        job_id: shortId,
        scene_name: sceneName,
        simulation_steps: simulationSteps,
        move_together: moveTogether,
        drones: dronesConfig,
        antenna_configs: {
          num_rows: antennaNumRows,
          num_cols: antennaNumCols,
          vertical_spacing: antennaVerticalSpacing,
          horizontal_spacing: antennaHorizontalSpacing,
          pattern: antennaPattern,
          polarization: antennaPolarization,
        },
        radio_configs: {
          frequency: (parseFloat(radioFrequencyMHz) || 6000) * 1e6,
          bandwidth: (parseFloat(radioBandwidthMHz) || 500) * 1e6,
        },
      };

      await submitJob(config);
      setSubmittedJobId(shortId);
      setShowJobIdPopup(true);
      setOpenSections((prev) => ({ ...prev, jobs: true }));
      setHasFetchedJobs(false);
      await fetchJobs();
    } catch (error) {
      console.error("Failed to submit job:", error);
      setSubmitError(error.message);
      setTimeout(() => setSubmitError(null), 5000);
    }
  }, [
    drones, motions, simulationSteps, moveTogether, selectedModel, submitJob, fetchJobs,
    antennaNumRows, antennaNumCols, antennaVerticalSpacing, antennaHorizontalSpacing,
    antennaPattern, antennaPolarization, radioFrequencyMHz, radioBandwidthMHz,
  ]);

  const startDroneAnimation = useCallback(() => {
    if (isAnimating) return;
    const SPEED = 2;
    setPathDronesSnapshot(drones.map((d) => ({ ...d })));
    const targets = drones
      .map((d) => {
        const m = motions.find((x) => x.droneId === d.id);
        if (!m) return null;
        if (m.motion_type === "Straight") {
          const s = { x: d.x, y: d.y, z: d.z };
          const e = { x: m.endX, y: m.endY, z: m.endZ };
          const dist = Math.hypot(e.x - s.x, e.y - s.y, e.z - s.z);
          return { id: d.id, type: "line", s, e, duration: dist / SPEED };
        } else {
          const cx = d.x + m.radius;
          return {
            id: d.id,
            type: "circle",
            c: { x: cx, y: d.y, z: d.z },
            r: m.radius,
            duration: (2 * Math.PI * m.radius) / SPEED,
          };
        }
      })
      .filter(Boolean);
    if (!targets.length) return;
    animRef.current.targets = targets;
    animRef.current.start = performance.now();
    setIsAnimating(true);
    const step = (now) => {
      const elapsed = (now - animRef.current.start) / 1000;
      let allDone = true;
      animRef.current.targets.forEach((t) => {
        const p = Math.min(elapsed / t.duration, 1);
        if (t.type === "line") {
          updateDrone(t.id, "x", t.s.x + p * (t.e.x - t.s.x));
          updateDrone(t.id, "y", t.s.y + p * (t.e.y - t.s.y));
          updateDrone(t.id, "z", t.s.z + p * (t.e.z - t.s.z));
        } else {
          const angle = Math.PI + p * 2 * Math.PI;
          updateDrone(t.id, "x", t.c.x + t.r * Math.cos(angle));
          updateDrone(t.id, "y", t.c.y + t.r * Math.sin(angle));
          updateDrone(t.id, "z", t.c.z);
        }
        if (p < 1) allDone = false;
      });
      if (!allDone) {
        animRef.current.raf = requestAnimationFrame(step);
      } else {
        setIsAnimating(false);
        setPathDronesSnapshot(null);
      }
    };
    animRef.current.raf = requestAnimationFrame(step);
  }, [isAnimating, drones, motions, updateDrone]);

  const handleFetchJobs = useCallback(async () => {
    const now = Date.now();
    if (!isFetchingJobs && now - lastFetchTimeRef.current > 2000) {
      try {
        lastFetchTimeRef.current = now;
        await fetchJobs();
        setHasFetchedJobs(true);
      } catch (error) {
        console.error("Error fetching jobs:", error);
      }
    }
  }, [fetchJobs, isFetchingJobs]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "d") {
          e.preventDefault();
          addDrone();
        } else if (e.key === "3") {
          e.preventDefault();
          setIs3D((prev) => !prev);
        }
      }
      if (e.key === "Escape") {
        setExpandedDroneMotion(null);
        setShowJobIdPopup(false);
        setCirViewerJobId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addDrone]);

  useEffect(() => {
    if (openSections.models && models.length === 0) fetchModels();
  }, [openSections.models, models.length, fetchModels]);

  useEffect(() => {
    if (openSections.jobs && !hasFetchedJobs) handleFetchJobs();
  }, [openSections.jobs, hasFetchedJobs, handleFetchJobs]);

  useEffect(() => {
    if (!openSections.jobs) return;
    const interval = setInterval(handleFetchJobs, 30000);
    return () => clearInterval(interval);
  }, [openSections.jobs, handleFetchJobs]);

  useEffect(() => {
    if (!openSections.jobs) setHasFetchedJobs(false);
  }, [openSections.jobs]);

  useEffect(() => {
    return () => {
      if (animRef.current.raf) cancelAnimationFrame(animRef.current.raf);
    };
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          <div className="text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  const droneColors = { rx: "#3b82f6", tx: "#ef4444", both: "#10b981" };

  return (
    <div className="w-full h-screen bg-gray-900 text-white overflow-hidden flex">
      <div className="w-80 h-full bg-gray-900 border-r border-gray-700 flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-gray-700">
          <h1 className="text-base font-semibold">AHDL Drone Sim</h1>
          <p className="text-xs text-gray-500 mt-0.5">Ctrl+D add drone &middot; Ctrl+3 toggle view</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <AccordionSection
            title="3D Models"
            isOpen={openSections.models}
            onToggle={() => toggleSection("models")}
          >
            {isLoadingModels ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              </div>
            ) : models.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {models.map((model) => (
                  <div
                    key={model.name}
                    className={`border rounded p-2 cursor-pointer transition-colors text-xs ${
                      selectedModel === model.path
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-gray-600 hover:border-gray-500"
                    }`}
                    onClick={() => {
                      setSelectedModel(model.path);
                      setModelScale(1);
                      setModelPosition([0, 0, 0]);
                      setModelRotation([0, 0, 0]);
                      setIsModelSelected(true);
                    }}
                  >
                    <div className="font-medium truncate">{model.name}</div>
                    <div className="text-gray-400 truncate">{model.glb_file}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-2">No models found</p>
            )}

            {selectedModel && (
              <div className="space-y-2 pt-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Scale</label>
                  <Input
                    type="number"
                    value={modelScale}
                    onChange={(e) => setModelScale(parseFloat(e.target.value) || 1)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Position [X, Y, Z]</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[0, 1, 2].map((idx) => (
                      <Input
                        key={idx}
                        type="number"
                        value={modelPosition[idx]}
                        onChange={(e) => {
                          const p = [...modelPosition];
                          p[idx] = parseFloat(e.target.value) || 0;
                          setModelPosition(p);
                        }}
                        className="h-8 text-xs"
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </AccordionSection>

          <AccordionSection
            title="Drones"
            badge={drones.length}
            isOpen={openSections.drones}
            onToggle={() => toggleSection("drones")}
          >
            <button
              onClick={addDrone}
              className="w-full py-1.5 text-xs font-medium text-emerald-400 border border-emerald-600/50 rounded hover:bg-emerald-900/30 transition-colors"
            >
              + Add Drone
            </button>

            {drones.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No drones yet</p>
            )}

            {drones.map((d) => {
              const hasMotion = motions.some((m) => m.droneId === d.id);
              const motionExpanded = expandedDroneMotion === d.id;
              const currentMotion = motionExpanded ? getOrCreateMotion(d.id) : null;

              return (
                <div key={d.id} className="border border-gray-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: droneColors[d.role] }}
                      />
                      Drone {d.id}
                    </span>
                    <button
                      onClick={() => deleteDrone(d.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Role</label>
                    <select
                      value={d.role}
                      onChange={(e) => updateDrone(d.id, "role", e.target.value)}
                      className="w-full h-8 px-2 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                    >
                      <option value="rx">rx</option>
                      <option value="tx">tx</option>
                      <option value="both">both</option>
                    </select>
                  </div>

                  {["x", "y", "z"].map((axis) => (
                    <div key={axis}>
                      <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                        <span>{axis.toUpperCase()}</span>
                        <span>{d[axis].toFixed(1)}</span>
                      </div>
                      <Slider
                        value={[d[axis]]}
                        onValueChange={(v) => updateDrone(d.id, axis, v[0])}
                        min={-10}
                        max={10}
                        step={0.1}
                      />
                    </div>
                  ))}

                  <button
                    onClick={() =>
                      setExpandedDroneMotion(motionExpanded ? null : d.id)
                    }
                    className={`w-full text-xs py-1 rounded transition-colors ${
                      hasMotion
                        ? "text-purple-300 border border-purple-600/50 hover:bg-purple-900/20"
                        : "text-gray-400 border border-gray-600/50 hover:bg-gray-800"
                    }`}
                  >
                    {hasMotion ? "Edit Motion" : "Add Motion"}
                  </button>

                  {motionExpanded && currentMotion && (
                    <div className="pl-2 border-l-2 border-purple-500/40 space-y-2 pt-1">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Motion Type</label>
                        <select
                          value={currentMotion.motion_type}
                          onChange={(e) => {
                            const updated = { ...currentMotion, motion_type: e.target.value };
                            saveMotion(updated);
                          }}
                          className="w-full h-8 px-2 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                        >
                          <option value="Straight">Straight</option>
                          <option value="Circle">Circle</option>
                        </select>
                      </div>

                      {currentMotion.motion_type === "Straight" ? (
                        <>
                          {["endX", "endY", "endZ"].map((axis) => (
                            <div key={axis}>
                              <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                                <span>End {axis.slice(-1).toUpperCase()}</span>
                                <span>{Number(currentMotion[axis]).toFixed(1)}</span>
                              </div>
                              <Slider
                                value={[currentMotion[axis]]}
                                onValueChange={(v) => updateMotionField(d.id, axis, v[0])}
                                min={-10}
                                max={10}
                                step={0.05}
                              />
                            </div>
                          ))}
                        </>
                      ) : (
                        <div>
                          <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                            <span>Radius</span>
                            <span>{Number(currentMotion.radius).toFixed(1)}</span>
                          </div>
                          <Slider
                            value={[currentMotion.radius]}
                            onValueChange={(v) => updateMotionField(d.id, "radius", v[0])}
                            min={0.1}
                            max={20}
                            step={0.1}
                          />
                        </div>
                      )}

                      {hasMotion && (
                        <button
                          onClick={() => deleteMotion(d.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove Motion
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </AccordionSection>

          <AccordionSection
            title="Radio Config"
            isOpen={openSections.radio}
            onToggle={() => toggleSection("radio")}
          >
            <div>
              <label className="text-xs text-gray-400 block mb-1">Frequency (MHz)</label>
              <Input
                type="number"
                value={radioFrequencyMHz}
                onChange={(e) => setRadioFrequencyMHz(e.target.value)}
                onBlur={() => { if (!radioFrequencyMHz || isNaN(radioFrequencyMHz)) setRadioFrequencyMHz("6000"); }}
                className="h-8 text-xs"
              />
              <span className="text-xs text-gray-500 mt-1 block">
                {(parseFloat(radioFrequencyMHz) / 1000 || 0).toFixed(2)} GHz
              </span>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Bandwidth (MHz)</label>
              <Input
                type="number"
                value={radioBandwidthMHz}
                onChange={(e) => setRadioBandwidthMHz(e.target.value)}
                onBlur={() => { if (!radioBandwidthMHz || isNaN(radioBandwidthMHz)) setRadioBandwidthMHz("500"); }}
                className="h-8 text-xs"
              />
            </div>
          </AccordionSection>

          <AccordionSection
            title="Antenna Config"
            isOpen={openSections.antenna}
            onToggle={() => toggleSection("antenna")}
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Rows</label>
                <Input
                  type="number"
                  min={1}
                  value={antennaNumRows}
                  onChange={(e) => setAntennaNumRows(parseInt(e.target.value) || 1)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Columns</label>
                <Input
                  type="number"
                  min={1}
                  value={antennaNumCols}
                  onChange={(e) => setAntennaNumCols(parseInt(e.target.value) || 1)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">V Spacing</label>
                <Input
                  type="number"
                  step="0.01"
                  value={antennaVerticalSpacing}
                  onChange={(e) => setAntennaVerticalSpacing(parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">H Spacing</label>
                <Input
                  type="number"
                  step="0.01"
                  value={antennaHorizontalSpacing}
                  onChange={(e) => setAntennaHorizontalSpacing(parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Pattern</label>
              <select
                value={antennaPattern}
                onChange={(e) => setAntennaPattern(e.target.value)}
                className="w-full h-8 px-2 text-xs bg-gray-800 border border-gray-600 rounded text-white"
              >
                <option value="iso">Isotropic (iso)</option>
                <option value="dipole">Dipole</option>
                <option value="hw_dipole">Half-wave Dipole</option>
                <option value="tr38901">3GPP TR 38.901</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Polarization</label>
              <select
                value={antennaPolarization}
                onChange={(e) => setAntennaPolarization(e.target.value)}
                className="w-full h-8 px-2 text-xs bg-gray-800 border border-gray-600 rounded text-white"
              >
                <option value="H">Horizontal (H)</option>
                <option value="V">Vertical (V)</option>
                <option value="cross">Cross</option>
              </select>
            </div>
          </AccordionSection>

          <AccordionSection
            title="Simulation"
            isOpen={openSections.simulation}
            onToggle={() => toggleSection("simulation")}
          >
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Steps</span>
                <span>{simulationSteps}</span>
              </div>
              <Slider
                value={[simulationSteps]}
                onValueChange={(v) => setSimulationSteps(parseInt(v[0]))}
                min={1}
                max={20}
                step={1}
              />
              <p className="text-xs text-gray-500 mt-1">
                Points calculated along each motion path.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-300">Move Together</span>
                <p className="text-xs text-gray-500">
                  {moveTogether ? "All drones move in sync" : "Sequential movement"}
                </p>
              </div>
              <Switch checked={moveTogether} onCheckedChange={setMoveTogether} />
            </div>
          </AccordionSection>

          <AccordionSection
            title="Job Queue"
            badge={jobs.length}
            isOpen={openSections.jobs}
            onToggle={() => toggleSection("jobs")}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{jobs.length} jobs</span>
              <button
                onClick={handleFetchJobs}
                disabled={isFetchingJobs}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
              >
                {isFetchingJobs ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Refresh
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {jobs.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">No jobs in queue</p>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} className="border border-gray-700 rounded p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium truncate">
                        {job.config?.job_id || job.id} - {job.config?.scene_name || "Unknown"}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          job.status === "pending"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : job.status === "processing"
                            ? "bg-blue-500/20 text-blue-400"
                            : job.status === "completed"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(job.created_at).toLocaleString()}
                    </div>
                    {(job.status === "processing" || job.status === "completed") && (
                      <div className="mt-1">
                        <div className="w-full bg-gray-700 rounded-full h-1">
                          <div
                            className="bg-blue-500 h-1 rounded-full"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 text-right mt-0.5">
                          {job.progress}%
                        </div>
                      </div>
                    )}
                    {job.status === "completed" && (
                      <button
                        onClick={() => setCirViewerJobId(job.id)}
                        className="mt-1.5 w-full h-6 text-xs font-medium rounded bg-indigo-600/80 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-1"
                      >
                        <BarChart3 className="w-3 h-3" />
                        View CIR
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </AccordionSection>
        </div>

        <div className="p-3 border-t border-gray-700 space-y-2">
          <button
            onClick={startDroneAnimation}
            disabled={isAnimating || motions.length === 0}
            className="w-full h-9 text-sm font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isAnimating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Animating...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Animate
              </>
            )}
          </button>
          <button
            onClick={submitJobToQueue}
            disabled={isSubmitting || drones.length === 0 || !selectedModel}
            title={
              drones.length === 0
                ? "Add at least one drone first"
                : !selectedModel
                ? "Select a 3D model first"
                : "Submit simulation job"
            }
            className="w-full h-9 text-sm font-medium rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
              </>
            ) : (
              "Submit Job"
            )}
          </button>
          {(drones.length === 0 || !selectedModel) && (
            <p className="text-xs text-yellow-500/80 text-center">
              {drones.length === 0 ? "Add drones" : "Select a 3D model"} to submit
            </p>
          )}
          {submitError && (
            <p className="text-xs text-red-400 text-center">
              Error: {submitError}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        <Canvas
          className="w-full h-full"
          shadows
          camera={{ position: [40, 40, 40], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            stencil: false,
            depth: true,
          }}
          dpr={typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1}
        >
          <CameraSwitcher is3D={is3D} />
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[50, 50, 25]}
            intensity={0.8}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-far={200}
            shadow-camera-left={-50}
            shadow-camera-right={50}
            shadow-camera-top={50}
            shadow-camera-bottom={-50}
          />
          <hemisphereLight skyColor="#87CEEB" groundColor="#362d59" intensity={0.2} />
          <Suspense fallback={null}>
            {drones.map((d) => (
              <DroneMesh key={d.id} drone={d} is3D={is3D} onDrag={handleDrag} />
            ))}
            {motions.map((m, idx) => {
              const drone = (pathDronesSnapshot || drones).find((d) => d.id === m.droneId);
              if (!drone) return null;
              return (
                <MotionPath
                  key={`path-${idx}`}
                  motion={m}
                  drones={pathDronesSnapshot || drones}
                  color={droneColors[drone.role]}
                />
              );
            })}
            {selectedModel && (
              <Model3D
                modelPath={selectedModel}
                position={modelPosition}
                rotation={modelRotation}
                scale={modelScale}
              />
            )}
          </Suspense>
          <Grid
            args={[100, 100]}
            infiniteGrid
            cellColor="#4a5568"
            sectionColor="#718096"
            sectionThickness={1.2}
            cellThickness={0.6}
            fadeDistance={100}
            fadeStrength={1}
          />
          {!is3D && (
            <OrbitControls makeDefault enablePan enableZoom enableRotate />
          )}
        </Canvas>

        <button
          onClick={() => setIs3D(!is3D)}
          className="absolute bottom-4 right-4 z-10 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          {is3D ? "3D" : "2D"} View
        </button>

        <AnimatePresence>
          {cirViewerJobId && (
            <CIRViewer
              jobId={cirViewerJobId}
              onClose={() => setCirViewerJobId(null)}
            />
          )}
        </AnimatePresence>
      </div>

      <LoadingOverlay
        isModelSelected={isModelSelected}
        onModelLoaded={() => setIsModelSelected(false)}
      />

      <AnimatePresence>
        {showJobIdPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => setShowJobIdPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-72"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-semibold">Job Submitted</h3>
                  <p className="text-xs text-gray-400 mt-1">Successfully queued</p>
                </div>
                <div className="w-full bg-gray-800 rounded p-2">
                  <div className="text-xs text-gray-400">Job ID</div>
                  <div className="font-mono text-sm">{submittedJobId}</div>
                </div>
                <button
                  onClick={() => setShowJobIdPopup(false)}
                  className="w-full h-8 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
