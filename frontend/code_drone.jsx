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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings, Upload, Play, Eye, Loader2, RefreshCw, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

  // Job queue state management
  const useJobQueue = () => {
    const [jobs, setJobs] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingJobs, setIsFetchingJobs] = useState(false);
    
    // Use the environment variable or default to the Docker service URL
    const DATABASE_URL = typeof window !== 'undefined' 
      ? (process.env.NEXT_PUBLIC_DATABASE_URL || "http://localhost:8001")
      : "http://database:8000";
    
    const submitJob = async (config) => {
      setIsSubmitting(true);
      try {
        const response = await fetch(`${DATABASE_URL}/jobs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ config }),
        });
        
        if (!response.ok) {
          throw new Error("Failed to submit job");
        }
        
        const job = await response.json();
        return job; // Return the job data including the ID
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
        if (!response.ok) {
          throw new Error("Failed to fetch jobs");
        }
        
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
    
    return {
      jobs,
      isSubmitting,
      isFetchingJobs,
      submitJob,
      fetchJobs,
    };
  };

// 3D Models management
const useModels = () => {
  const [models, setModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  
  // Use the environment variable or default to the Docker service URL
  const DATABASE_URL = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_DATABASE_URL || "http://localhost:8001")
    : "http://database:8000";
  
  const fetchModels = async () => {
    setIsLoadingModels(true);
    try {
      const response = await fetch(`${DATABASE_URL}/models`);
      if (!response.ok) {
        throw new Error("Failed to fetch models");
      }
      
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
  
  return {
    models,
    isLoadingModels,
    fetchModels,
  };
};

/******************** CameraSwitcher ******************************/
function CameraSwitcher({ is3D }) {
  const { camera, gl } = useThree();
  const cameraState2DRef = useRef(null); // For PerspectiveCamera (2D)
  const cameraState3DRef = useRef(null); // For OrthographicCamera (3D)

  useEffect(() => {
    // Save current camera state before switching
    if (camera.type === "PerspectiveCamera") { // Current is 2D
      cameraState2DRef.current = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        // fov: camera.fov, // fov is fairly static for 2D mode
      };
    } else if (camera.type === "OrthographicCamera") { // Current is 3D
      cameraState3DRef.current = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        zoom: camera.zoom,
      };
    }

    if (is3D) { // Switching to 3D (Orthographic)
      // Basic Orthographic setup
      const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16/9;
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
      camera.zoom = 1; // Default zoom

      if (cameraState3DRef.current) {
        camera.position.copy(cameraState3DRef.current.position);
        camera.quaternion.copy(cameraState3DRef.current.quaternion);
        camera.zoom = cameraState3DRef.current.zoom;
      } else {
        // Default 3D position and orientation if no saved state
        camera.position.set(0, 100, 0);
        camera.up.set(0, 0, -1); // Set 'up' before 'lookAt' for orthographic
        camera.lookAt(0, 0, 0);
      }
    } else { // Switching to 2D (Perspective)
      // Basic Perspective setup
      camera.type = "PerspectiveCamera";
      camera.fov = 50;
      // No Object.assign needed like for Orthographic, fov is the main prop here

      if (cameraState2DRef.current) {
        camera.position.copy(cameraState2DRef.current.position);
        camera.quaternion.copy(cameraState2DRef.current.quaternion);
        // camera.fov can be restored if it's meant to be dynamic
        // camera.fov = cameraState2DRef.current.fov || 50;
      } else {
        // Default 2D position and orientation if no saved state
        camera.position.set(40, 40, 40);
        camera.up.set(0,1,0); // Reset up vector for perspective camera
        camera.lookAt(0, 0, 0);
      }
    }
    camera.updateProjectionMatrix();
  }, [is3D, camera]); // gl removed as it's not part of this specific logic flow

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

/******************** Motion Path Visualization ****************************/
function MotionPath({ motion, drones, color }) {
  // Find the drone associated with this motion
  const drone = drones.find(d => d.id === motion.droneId);
  
  // If no drone is found, don't render anything
  if (!drone) return null;
  
  // Create the points for the motion path
  const points = useMemo(() => {
    if (motion.motion_type === "Circle") {
      // For circular motion, create a circle of points that starts and ends at the drone position
      const numPoints = 32; // Number of segments to approximate the circle
      const circlePoints = [];
      
      // Calculate the center of the circle such that the drone is at the edge
      // The drone will be at the leftmost point of the circle (cos(180°) = -1, sin(180°) = 0)
      const centerX = drone.x + motion.radius; // Center is radius units to the right of the drone
      const centerY = drone.y;
      const centerZ = drone.z;
      
      // Draw the circle starting from the drone position (leftmost point)
      for (let i = 0; i <= numPoints; i++) {
        // Start at 180° (π) and go all the way around to 180° again to complete the circle
        const angle = Math.PI + (i / numPoints) * Math.PI * 2;
        const x = centerX + motion.radius * Math.cos(angle);
        const z = centerZ;
        const y = centerY + motion.radius * Math.sin(angle);
        circlePoints.push([x, z, y]);
      }
      
      return circlePoints;
    } else {
      // For straight motion, just connect start and end
      const startPos = [drone.x, drone.z, drone.y];
      const endPos = [motion.endX, motion.endZ, motion.endY];
      return [
        startPos,
        endPos
      ];
    }
  }, [motion, drone]);
  
  return (
    <Line
      points={points}
      color={color || "#ffffff"}
      lineWidth={3}
      dashed={true}
      dashSize={0.8}
      dashScale={1}
      dashOffset={0}
      gapSize={0.4}
      transparent
      opacity={0.8}
    />
  );
}

/******************** 3D Models & Drone visuals ****************************/
function Model3D({ modelPath, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) {
  // For models from our database, we need to construct the full URL
  const DATABASE_URL = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_DATABASE_URL || "http://localhost:8001")
    : "http://database:8000";
    
  const fullModelPath = modelPath.startsWith("/3d_models") 
    ? `${DATABASE_URL}${modelPath}` 
    : modelPath;
    
  const { scene } = useGLTF(fullModelPath);
  
  // Clone the scene to avoid conflicts with multiple instances
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
}

function LoadingOverlay({ isModelSelected, onModelLoaded }) {
  const { progress } = useProgress();
  
  // Show the overlay when a model is selected or when there's active loading progress
  if (!isModelSelected && (progress === 0 || progress === 100)) return null;
  
  // If progress reaches 100, notify that the model has loaded
  if (progress === 100) {
    setTimeout(() => {
      onModelLoaded();
    }, 100); // Small delay to ensure the model is fully rendered
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6 w-80 shadow-2xl text-center">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
          <div className="text-lg font-medium text-white">Please wait</div>
          <div className="text-sm text-gray-300">Loading 3D model into the environment...</div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-400">{Math.round(progress)}% loaded</div>
        </div>
      </div>
    </div>
  );
}

/******************** Drone visuals ******************************/
function DroneBody({ color }) {
  return (
    <group>
      {/* Main body */}
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
      
      {/* Arms */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.03, 0.03]} />
        <meshStandardMaterial 
          color={color} 
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.8, 0.03, 0.03]} />
        <meshStandardMaterial 
          color={color} 
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      
      {/* Propellers */}
      {[[-0.4, 0.08, 0], [0.4, 0.08, 0], [0, 0.08, -0.4], [0, 0.08, 0.4]].map((pos, idx) => (
        <group key={idx} position={pos}>
          <mesh castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.05]} />
            <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.04, 0]} rotation={[0, idx * Math.PI / 4, 0]}>
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

/******************** Main component *****************************/
export default function Simulation() {
  const [mounted, setMounted] = useState(false);
  const [scene, setScene] = useState("Empty Yard");
  const [is3D, setIs3D] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [drones, setDrones] = useState([]);
  const [motions, setMotions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingMotion, setEditingMotion] = useState(null); // For motion popup
  const [simulationSteps, setSimulationSteps] = useState(10); // Number of simulation steps
  const [moveTogether, setMoveTogether] = useState(true); // Move drones together or separately
  
  // 3D model state
  const [selectedModel, setSelectedModel] = useState("");
  const [modelScale, setModelScale] = useState(1);
  const [modelPosition, setModelPosition] = useState([0, 0, 0]);
  const [modelRotation, setModelRotation] = useState([0, 0, 0]);
  const [showModels, setShowModels] = useState(false);
  const [isModelSelected, setIsModelSelected] = useState(false);
  
  // Job queue state
  const { jobs, isSubmitting, isFetchingJobs, submitJob, fetchJobs } = useJobQueue();
  const { models, isLoadingModels, fetchModels } = useModels();
  const [showJobs, setShowJobs] = useState(false);
  
  // Job ID popup state
  const [showJobIdPopup, setShowJobIdPopup] = useState(false);
  const [submittedJobId, setSubmittedJobId] = useState("");

  // Ensure component only renders on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Memoized functions for better performance
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
    setIsLoading(true);
    setTimeout(() => {
      const id = drones.length + 1; // Sequential ID starting from 1
      setDrones(prev => [...prev, { id, x: id, y: id, z: id, role: "both" }]); // Default position: (DRONE_ID, DRONE_ID, DRONE_ID)
      setIsLoading(false);
    }, 100);
  }, [drones.length]);

  const deleteDrone = useCallback((id) => {
    setIsLoading(true);
    setTimeout(() => {
      // Delete the drone
      setDrones((prev) => prev.filter(d => d.id !== id));
      
      // Delete any motions associated with this drone
      setMotions((prev) => prev.filter(m => m.droneId !== id));
      setIsLoading(false);
    }, 100);
  }, []);

  const handleDrag = useCallback((id, x, y) => {
    setDrones((prev) => prev.map((d) => (d.id === id ? { ...d, x, y } : d)));
  }, []);

  const openMotionEditor = useCallback((droneId) => {
    const existingMotion = motions.find(m => m.droneId === droneId);
    if (existingMotion) {
      setEditingMotion(existingMotion);
    } else {
      const drone = drones.find(d => d.id === droneId);
      setEditingMotion({
        droneId,
        motion_type: "Straight",
        endX: drone.x + 5,
        endY: drone.y,
        endZ: drone.z,
        radius: 5
      });
    }
  }, [motions, drones]);

  const saveMotion = useCallback((motionData) => {
    setMotions(prev => {
      const existing = prev.findIndex(m => m.droneId === motionData.droneId);
      if (existing >= 0) {
        // Update existing motion
        return prev.map((m, idx) => idx === existing ? motionData : m);
      } else {
        // Add new motion
        return [...prev, motionData];
      }
    });
    setEditingMotion(null);
  }, []);

  const deleteMotion = useCallback((droneId) => {
    setMotions(prev => prev.filter(m => m.droneId !== droneId));
    setEditingMotion(null);
  }, []);

  

  // Submit job to the queue
  const submitJobToQueue = useCallback(async () => {
    // Check if a model is selected
    if (!selectedModel) {
      console.error("Cannot submit job: No model selected");
      // In a real app, you would show an error message to the user
      return;
    }
    
    // Generate a UUID for the job
    const uuid = crypto.randomUUID();
    // Extract first 5 characters of the UUID
    const shortId = uuid.substring(0, 5);
    
    const sceneName = selectedModel ? 
      selectedModel.split('/').pop().replace(/\.[^/.]+$/, "") : // Remove file extension
      "no_scene";
    
    const dronesConfig = drones.map(drone => {
      const droneMotion = motions.find(m => m.droneId === drone.id);
      
      return {
        location: [drone.x, drone.y, drone.z],
        has_motion: !!droneMotion,
        motion: droneMotion ? {
          motion_type: droneMotion.motion_type === "Straight" ? "line" : droneMotion.motion_type.toLowerCase(),
          radius: droneMotion.motion_type === "Circle" ? droneMotion.radius : 0.0,
          end_position: droneMotion.motion_type === "Straight" ? [droneMotion.endX, droneMotion.endY, droneMotion.endZ] : []
        } : {
          motion_type: "",
          radius: 0.0,
          end_position: []
        }
      };
    });

    const config = {
      job_id: shortId, // Add the short ID to the config
      scene_name: sceneName,
      simulation_steps: simulationSteps,
      move_together: moveTogether,
      drones: dronesConfig,
      // Add antenna and radio configs with default values
      antenna_configs: {
        num_rows: 1,
        num_cols: 1,
        vertical_spacing: 0,
        horizontal_spacing: 0,
        pattern: "iso",
        polarization: "H"
      },
      radio_configs: {
        frequency: 6e9,
        bandwidth: 500e6
      }
    };

    try {
      const job = await submitJob(config);
      // Set the submitted job ID and show the popup
      // Use the short ID we generated instead of the one from the response
      setSubmittedJobId(shortId);
      setShowJobIdPopup(true);
      // Mark that a job was recently submitted
      setHasFetchedJobs(false);
    } catch (error) {
      console.error("Failed to submit job:", error);
      // In a real app, you would show an error message to the user
    }
  }, [drones, motions, simulationSteps, moveTogether, selectedModel, submitJob]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'd':
            e.preventDefault();
            if (!isLoading) addDrone();
            break;
          case 'g':
            e.preventDefault();
            setShowConfig(prev => !prev);
            break;
          case '3':
            e.preventDefault();
            setIs3D(prev => !prev);
            break;
        }
      }
      if (e.key === 'Escape') {
        setShowConfig(false);
        setShowModels(false);
        setShowJobs(false);
        setEditingMotion(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addDrone, isLoading]);

  // Load models when models panel is opened
  useEffect(() => {
    if (showModels && models.length === 0) {
      fetchModels();
    }
  }, [showModels, models.length, fetchModels]);

  // Track last fetch time to prevent too frequent API calls
  const lastFetchTimeRef = useRef(0);
  const [hasFetchedJobs, setHasFetchedJobs] = useState(false);
  
  const handleFetchJobs = useCallback(async () => {
    const now = Date.now();
    // Prevent fetching more than once every 2 seconds
    if (!isFetchingJobs && (now - lastFetchTimeRef.current > 2000)) {
      try {
        lastFetchTimeRef.current = now;
        await fetchJobs();
        setHasFetchedJobs(true);
      } catch (error) {
        console.error("Error fetching jobs:", error);
      }
    }
  }, [fetchJobs, isFetchingJobs]);

  // Reset hasFetchedJobs when showJobs is closed
  useEffect(() => {
    if (!showJobs) {
      setHasFetchedJobs(false);
    }
  }, [showJobs]);

  // Auto-refresh jobs every 30 seconds when panel is open
  useEffect(() => {
    if (!showJobs) return;
    
    const interval = setInterval(() => {
      handleFetchJobs();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [showJobs, handleFetchJobs]);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      lastFetchTimeRef.current = 0;
    };
  }, []);

  // Show loading screen during SSR
  if (!mounted) {
    return (
      <div className="relative w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
          <div className="text-xl font-medium">Loading Drone Simulation...</div>
          <div className="text-sm text-gray-400">Initializing 3D environment</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
      {/* Background pattern overlay */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }}></div>
      </div>
      {/* Settings icon */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-50 bg-gray-800/80 hover:bg-gray-700/80 backdrop-blur-sm border border-gray-600/50 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
        onClick={() => setShowConfig((p) => !p)}
        title="Settings (Ctrl+G)"
      >
        <Settings className="h-5 w-5 text-gray-200" />
      </Button>
      
      {/* Help tooltip */}
      <div className="absolute top-4 left-20 z-50 bg-gray-800/90 backdrop-blur-sm border border-gray-600/50 rounded-xl p-3 text-xs text-gray-300 shadow-lg">
        <div className="font-medium mb-1">Quick Shortcuts:</div>
        <div>Ctrl+D: Add Drone</div>
        <div>Ctrl+G: Toggle Settings</div>
        <div>Ctrl+3: Toggle 2D/3D</div>
        <div>ESC: Close panels</div>
      </div>
      
      {/* 2D/3D Toggle Button */}
      <div className="absolute bottom-6 left-6 z-50">
        <div 
          className={`relative flex flex-col items-center justify-center w-20 h-20 rounded-2xl shadow-2xl cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95 ${
            is3D 
              ? 'bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600' 
              : 'bg-gradient-to-br from-green-500 to-green-700 hover:from-green-400 hover:to-green-600'
          } border border-white/20`}
          onClick={() => setIs3D(!is3D)}
        >
          <div className="absolute inset-0 rounded-2xl bg-white/10 pointer-events-none" style={{ boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.2)' }}></div>
          <span className="text-white font-bold text-xl drop-shadow-sm">{is3D ? '3D' : '2D'}</span>
          <span className="text-white/90 text-xs font-medium drop-shadow-sm tracking-wide">VIEW</span>
        </div>
      </div>

      {/* Config panel - Right Sidebar */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute right-0 top-0 h-full w-96 bg-gray-900/90 backdrop-blur-xl border-l border-gray-700/50 shadow-2xl z-40 overflow-y-auto"
          >
            <div className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-700/50">
                <h2 className="text-lg font-semibold text-white">Settings</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfig(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </Button>
              </div>

              {/* Controls */}
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowModels(!showModels)} 
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white border-blue-500/50 shadow-lg transition-all duration-200 font-medium disabled:opacity-50"
                  disabled={isLoading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  3D Models
                </Button>
                <Button 
                  onClick={addDrone}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white shadow-lg transition-all duration-200 font-medium disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Add Drone"}
                </Button>
                {isLoading && (
                  <div className="flex items-center justify-center gap-2 text-blue-400 text-sm">
                    <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </div>
                )}
              </div>
              
              {/* 3D Model Controls */}
              {showModels && (
                <Card className="bg-gray-800/60 backdrop-blur-sm shadow-xl border border-gray-700/50 rounded-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">3D Model Configuration</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowModels(false)}
                        className="text-gray-400 hover:text-white"
                      >
                        ✕
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-gray-300 mb-2 block">Available Models</label>
                        {isLoadingModels ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                          </div>
                        ) : models.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {models.map((model) => (
                              <div 
                                key={model.name}
                                className={`border rounded-lg p-2 cursor-pointer transition-all ${
                                  selectedModel === model.path 
                                    ? 'border-blue-500 bg-blue-500/20' 
                                    : 'border-gray-600 hover:border-gray-500'
                                }`}
                                onClick={() => {
                                  setSelectedModel(model.path);
                                  // Set default values when selecting a model
                                  setModelScale(1);
                                  setModelPosition([0, 0, 0]);
                                  setModelRotation([0, 0, 0]);
                                  // Set model selected state for immediate feedback
                                  setIsModelSelected(true);
                                  // Close the models panel
                                  setShowModels(false);
                                }}
                              >
                                <div className="text-xs font-medium truncate">{model.name}</div>
                                <div className="text-xs text-gray-400 truncate">{model.glb_file}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-gray-400 py-2 text-sm">
                            No models found
                          </div>
                        )}
                      </div>
                      {selectedModel && (
                        <>
                          <div>
                            <label className="text-xs text-gray-300 mb-2 block">Scale</label>
                            <Input 
                              type="number" 
                              value={modelScale}
                              className="bg-gray-700/80 border-gray-600/50 text-white text-sm rounded-lg" 
                              onChange={(e) => setModelScale(parseFloat(e.target.value) || 1)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-300 mb-2 block">Position [X, Y, Z]</label>
                            <div className="grid grid-cols-3 gap-2">
                              {[0, 1, 2].map((idx) => (
                                <Input
                                  key={`pos-${idx}`}
                                  type="number"
                                  value={modelPosition[idx]}
                                  className="bg-gray-700/80 border-gray-600/50 text-white text-xs rounded-lg"
                                  onChange={(e) => {
                                    const newPos = [...modelPosition];
                                    newPos[idx] = parseFloat(e.target.value) || 0;
                                    setModelPosition(newPos);
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Drones List */}
              <Card className="bg-gray-800/60 backdrop-blur-sm shadow-xl border border-gray-700/50 rounded-lg">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Drone Management</h3>
                  <div className="space-y-3">
                    {drones.length === 0 ? (
                      <div className="text-center text-gray-400 py-4 text-sm">
                        <div>No drones yet</div>
                        <div className="text-xs">Add your first drone to get started</div>
                      </div>
                    ) : (
                      drones.map((d) => (
                        <div key={d.id} className="border border-gray-700/50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium text-sm">Drone {d.id}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                onClick={() => openMotionEditor(d.id)}
                                className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-2 py-1 h-6"
                              >
                                Motion
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={() => deleteDrone(d.id)}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 h-6"
                                disabled={isLoading}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-300">Role</label>
                              <Select value={d.role} onValueChange={(val)=>updateDrone(d.id,'role',val)}>
                                <SelectTrigger className="h-7 bg-gray-700/80 border-gray-600/50 text-white text-xs">
                                  {d.role}
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-600/50">
                                  {['rx','tx','both'].map(r=>(<SelectItem key={r} value={r} className="text-white hover:bg-gray-700 text-xs">{r}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-300">Position</label>
                              <div className="grid grid-cols-3 gap-1">
                                {['x','y','z'].map(axis=> (
                                  <div key={axis} className="relative">
                                    <Input
                                      type="number"
                                      value={d[axis]}
                                      onChange={(e)=>updateDrone(d.id,axis,e.target.value)}
                                      className="h-7 bg-gray-700/80 border-gray-600/50 text-center text-white text-xs pr-2 pl-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      placeholder={axis.toUpperCase()}
                                    />
                                    <span className="absolute -top-1 -right-1 text-[10px] text-gray-400 bg-gray-800 px-1 rounded">
                                      {axis.toUpperCase()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Stats Summary */}
              {(drones.length > 0 || motions.length > 0) && (
                <Card className="bg-gradient-to-r from-gray-800/60 to-gray-700/60 backdrop-blur-sm shadow-xl border border-gray-700/50 rounded-lg">
                  <CardContent className="p-3">
                    <div className="space-y-2 text-xs text-center">
                      <div className="flex items-center justify-center">
                        <span className="text-gray-300 font-medium">Summary</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Drones:</span>
                        <span className="text-white font-medium">{drones.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Motion Paths:</span>
                        <span className="text-white font-medium">{motions.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">View Mode:</span>
                        <span className="text-white font-medium">{is3D ? '2D' : '3D'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-gray-800/60 backdrop-blur-sm shadow-xl border border-gray-700/50 rounded-lg">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-white">Simulation Steps</label>
                      <div className="group relative flex items-center">
                        <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-400/50 flex items-center justify-center cursor-help">
                          <span className="text-blue-400 text-xs font-bold">i</span>
                        </div>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[9999] w-72 p-3 bg-gray-900/95 backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-xl text-xs text-gray-200 transform">
                          <div className="font-medium text-white mb-1">Simulation Steps Explained:</div>
                          <div className="space-y-1 text-gray-300">
                            <div>• Controls how many points are calculated along each motion path</div>
                            <div>• <strong>Circle motion:</strong> Steps = 4 means drone positions at 0°, 90°, 180°, 270°</div>
                            <div>• <strong>Straight motion:</strong> Steps = 5 from X=-2 to X=2 gives positions at -2, -1, 0, 1, 2</div>
                            <div>• Higher values = smoother motion visualization, but slower simulation</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Input
                      type="number"
                      min="2"
                      max="100"
                      value={simulationSteps}
                      onChange={(e) => setSimulationSteps(Math.max(2, parseInt(e.target.value) || 10))}
                      className="bg-gray-700/80 border-gray-600/50 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="Enter steps (2-100)"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Move Together Setting */}
              <Card className="bg-gray-800/60 backdrop-blur-sm shadow-xl border border-gray-700/50 rounded-lg">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-white">Move Together</label>
                      <div className="group relative flex items-center">
                        <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-400/50 flex items-center justify-center cursor-help">
                          <span className="text-green-400 text-xs font-bold">i</span>
                        </div>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[9999] w-72 p-3 bg-gray-900/95 backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-xl text-xs text-gray-200 transform">
                          <div className="font-medium text-white mb-1">Move Together Explained:</div>
                          <div className="space-y-1 text-gray-300">
                            <div>• <strong>True:</strong> All drones move simultaneously through their motion paths in sync</div>
                            <div>• <strong>False:</strong> Each drone completes its full motion before the next starts</div>
                            <div>• False mode: Total steps = simulation steps × number of drones (much slower)</div>
                            <div>• True mode: Total steps = simulation steps (faster, coordinated movement)</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Select value={moveTogether.toString()} onValueChange={(val) => setMoveTogether(val === "true")}>
                      <SelectTrigger className="bg-gray-700/80 border-gray-600/50 text-white">
                        {moveTogether ? "True" : "False"}
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600/50">
                        <SelectItem value="true" className="text-white hover:bg-gray-700">True</SelectItem>
                        <SelectItem value="false" className="text-white hover:bg-gray-700">False</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Job Control Buttons */}
              <div className="relative">
                <div className="space-y-3">
                  <Button 
                    onClick={async () => {
                      // If we haven't fetched jobs yet or a job was recently submitted, fetch jobs
                      if (!hasFetchedJobs) {
                        await handleFetchJobs();
                      }
                      setShowJobs(!showJobs);
                    }}
                    disabled={isFetchingJobs}
                    className="w-full bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white shadow-lg transition-all duration-200 font-medium h-10 text-sm"
                  >
                    {isFetchingJobs ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading Jobs...
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        View Jobs ({jobs.length})
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={submitJobToQueue}
                    disabled={isSubmitting || drones.length === 0 || !selectedModel}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-lg transition-all duration-200 font-medium disabled:opacity-50 h-10 text-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Submit Job
                      </>
                    )}
                  </Button>
                </div>

                {/* Job Queue Panel - Positioned below the View Jobs button */}
                <AnimatePresence>
                  {showJobs && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 top-full mt-2 w-80 z-50"
                    >
                      <Card className="bg-gray-800/90 backdrop-blur-sm shadow-xl border border-gray-700/50 rounded-lg">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-white">Job Queue</h3>
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={handleFetchJobs}
                                disabled={isFetchingJobs}
                                className="h-7 text-xs flex items-center gap-1"
                              >
                                {isFetchingJobs ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3" />
                                )}
                                Refresh
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => setShowJobs(false)}
                                className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {jobs.length === 0 ? (
                              <div className="text-center text-gray-400 py-4 text-sm">
                                <div>No jobs in queue</div>
                                <div className="text-xs">Submit a job to get started</div>
                              </div>
                            ) : (
                              jobs.map((job) => (
                                <div 
                                  key={job.id} 
                                  className="border border-gray-700/50 rounded-lg p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-white font-medium text-sm truncate">
                                      {job.config.job_id ? `${job.config.job_id} - ` : ''}
                                      {job.config.scene_name || 'Unnamed Job'}
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      job.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                      job.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                                      job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                      'bg-red-500/20 text-red-400'
                                    }`}>
                                      {job.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    {new Date(job.created_at).toLocaleString()}
                                  </div>
                                  {(job.status === 'processing' || job.status === 'completed') && (
                                    <div className="mt-2">
                                      <div className="w-full bg-gray-700 rounded-full h-1.5">
                                        <div 
                                          className="bg-blue-500 h-1.5 rounded-full" 
                                          style={{ width: `${job.progress}%` }}
                                        />
                                      </div>
                                      <div className="text-xs text-gray-400 text-right mt-1">
                                        {job.progress}%
                                      </div>
                                      {job.result && (
                                        <div className="text-xs text-gray-400 mt-1">
                                          Results: {job.result.results ? `completed` : 'completed'}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Motion Editor Popup */}
      <AnimatePresence>
        {editingMotion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setEditingMotion(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6 w-96 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Motion Editor</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingMotion(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Drone ID</label>
                  <Input
                    value={editingMotion.droneId}
                    disabled
                    className="bg-gray-700/50 border-gray-600/50 text-gray-400"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Motion Type</label>
                  <Select 
                    value={editingMotion.motion_type} 
                    onValueChange={(val) => setEditingMotion(prev => ({...prev, motion_type: val}))}
                  >
                    <SelectTrigger className="bg-gray-700/80 border-gray-600/50 text-white">
                      {editingMotion.motion_type}
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600/50">
                      <SelectItem value="Straight" className="text-white hover:bg-gray-700">Straight</SelectItem>
                      <SelectItem value="Circle" className="text-white hover:bg-gray-700">Circle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editingMotion.motion_type === "Straight" ? (
                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">End Position [X, Y, Z]</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['endX', 'endY', 'endZ'].map(axis => (
                        <div key={axis} className="relative">
                          <Input
                            type="number"
                            value={editingMotion[axis]}
                            onChange={(e) => setEditingMotion(prev => ({
                              ...prev, 
                              [axis]: parseFloat(e.target.value) || 0
                            }))}
                            className="bg-gray-700/80 border-gray-600/50 text-white text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder={axis.slice(-1).toUpperCase()}
                          />
                          <span className="absolute -top-1 -right-1 text-[10px] text-gray-400 bg-gray-800 px-1 rounded">
                            {axis.slice(-1).toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">Radius</label>
                    <Input
                      type="number"
                      value={editingMotion.radius}
                      onChange={(e) => setEditingMotion(prev => ({
                        ...prev, 
                        radius: parseFloat(e.target.value) || 0
                      }))}
                      className="bg-gray-700/80 border-gray-600/50 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => saveMotion(editingMotion)}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white"
                  >
                    Save Motion
                  </Button>
                  <Button
                    onClick={() => deleteMotion(editingMotion.droneId)}
                    variant="outline"
                    className="bg-red-600/20 border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay for 3D Models */}
      <LoadingOverlay 
        isModelSelected={isModelSelected} 
        onModelLoaded={() => setIsModelSelected(false)} 
      />
      
      {/* 2D Canvas */}
      <Canvas 
        className="w-full h-full" 
        shadows 
        camera={{position:[40,40,40], fov:50}}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true
        }}
        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
      >
        <CameraSwitcher is3D={is3D} />
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[50,50,25]} 
          intensity={0.8} 
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        <hemisphereLight
          skyColor="#87CEEB"
          groundColor="#362d59"
          intensity={0.2}
        />
        <Suspense fallback={null}>
          {drones.map(d=>(<DroneMesh key={d.id} drone={d} is3D={is3D} onDrag={handleDrag} />))}
          
          {/* Render motion paths for each motion */}
          {motions.map((motion, idx) => {
            // Find the drone associated with this motion
            const drone = drones.find(d => d.id === motion.droneId);
            // Only render if we found the drone
            if (drone) {
              // Get the same color as the drone
              const colors = { rx: "#3b82f6", tx: "#ef4444", both: "#10b981" };
              const color = colors[drone.role];
              return (
                <MotionPath 
                  key={`path-${idx}`}
                  motion={motion}
                  drones={drones}
                  color={color}
                />
              );
            }
            return null;
          })}
          
          {/* Render the selected 3D model if available */}
          {selectedModel && (
            <Model3D 
              modelPath={selectedModel} 
              position={modelPosition} 
              rotation={[modelRotation[0], modelRotation[1], modelRotation[2]]} 
              scale={modelScale} 
            />
          )}
        </Suspense>
        <Grid 
          args={[100,100]} 
          infiniteGrid 
          cellColor="#4a5568"
          sectionColor="#718096"
          sectionThickness={1.2}
          cellThickness={0.6}
          fadeDistance={100}
          fadeStrength={1}
        />
        {!is3D && <OrbitControls makeDefault enablePan={true} enableZoom={true} enableRotate={true} />}
      </Canvas>
      
      {/* Job ID Popup */}
      <AnimatePresence>
        {showJobIdPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setShowJobIdPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6 w-80 shadow-2xl"
            >
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-white">Job Submitted</h3>
                  <p className="text-sm text-gray-400 mt-1">Your job has been successfully submitted</p>
                </div>
                <div className="w-full bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Job ID</div>
                  <div className="text-white font-mono text-sm break-all">{submittedJobId?.substring(0, 6)}</div>
                </div>
                <Button
                  onClick={() => setShowJobIdPopup(false)}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white"
                >
                  OK
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}