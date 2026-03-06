import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Download } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function float16ToFloat64(uint16) {
  const sign = (uint16 >> 15) & 0x1;
  const exponent = (uint16 >> 10) & 0x1f;
  const fraction = uint16 & 0x3ff;

  if (exponent === 0) {
    return (sign ? -1 : 1) * Math.pow(2, -14) * (fraction / 1024);
  }
  if (exponent === 0x1f) {
    return fraction === 0
      ? sign
        ? -Infinity
        : Infinity
      : NaN;
  }
  return (sign ? -1 : 1) * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
}

function decodeBase64Float16(base64Str) {
  const binaryStr = atob(base64Str);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const numValues = len / 2;
  const result = new Float64Array(numValues);
  for (let i = 0; i < numValues; i++) {
    result[i] = float16ToFloat64(view.getUint16(i * 2, true));
  }
  return result;
}

function getSlice(flat, shape, rxDrone, rxAnt, txDrone, txAnt) {
  const [, numRxAnt, numTx, numTxAnt, numTimeSteps, numTaps] = shape;
  const stride0 = numRxAnt * numTx * numTxAnt * numTimeSteps * numTaps;
  const stride1 = numTx * numTxAnt * numTimeSteps * numTaps;
  const stride2 = numTxAnt * numTimeSteps * numTaps;
  const stride3 = numTimeSteps * numTaps;
  const offset =
    rxDrone * stride0 +
    rxAnt * stride1 +
    txDrone * stride2 +
    txAnt * stride3;
  return flat.slice(offset, offset + numTaps);
}

export default function CIRViewer({ jobId, onClose }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [step, setStep] = useState(0);
  const [rxDrone, setRxDrone] = useState(0);
  const [rxAnt, setRxAnt] = useState(0);
  const [txDrone, setTxDrone] = useState(0);
  const [txAnt, setTxAnt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchJob() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/db/jobs/${jobId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setJob(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchJob();
    return () => { cancelled = true; };
  }, [jobId]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const decoded = useMemo(() => {
    if (!job?.result) return null;
    const stepKeys = Object.keys(job.result).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );
    return stepKeys.map((key) => {
      const stepData = job.result[key];
      const sr = stepData.step_results;
      return {
        key,
        shape: sr.shape,
        mag: decodeBase64Float16(sr.cir_mag),
        phase: decodeBase64Float16(sr.cir_phase),
        droneLocations: stepData.drone_locations,
      };
    });
  }, [job]);

  const dims = useMemo(() => {
    if (!decoded || decoded.length === 0) return null;
    const shape = decoded[0].shape;
    return {
      numSteps: decoded.length,
      numRx: shape[0],
      numRxAnt: shape[1],
      numTx: shape[2],
      numTxAnt: shape[3],
      numTaps: shape[5],
    };
  }, [decoded]);

  const chartData = useMemo(() => {
    if (!decoded || !dims) return null;
    const d = decoded[step];
    if (!d) return null;
    const magSlice = getSlice(d.mag, d.shape, rxDrone, rxAnt, txDrone, txAnt);
    const phaseSlice = getSlice(d.phase, d.shape, rxDrone, rxAnt, txDrone, txAnt);
    const points = [];
    for (let i = 0; i < magSlice.length; i++) {
      points.push({
        tap: i - 3,
        magnitude: parseFloat(magSlice[i].toFixed(6)),
        phase: parseFloat(phaseSlice[i].toFixed(6)),
      });
    }
    return points;
  }, [decoded, dims, step, rxDrone, rxAnt, txDrone, txAnt]);

  const handleExport = useCallback(() => {
    if (!chartData || !decoded) return;
    const d = decoded[step];
    const payload = {
      jobId,
      step: parseInt(d.key),
      rxDrone,
      rxAnt,
      txDrone,
      txAnt,
      shape: d.shape,
      droneLocations: d.droneLocations,
      taps: chartData,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cir_${jobId}_step${d.key}_rx${rxDrone}_tx${txDrone}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chartData, decoded, step, jobId, rxDrone, rxAnt, txDrone, txAnt]);

  const range = (n) => Array.from({ length: n }, (_, i) => i);

  const Dropdown = ({ label, value, onChange, count }) => (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400 whitespace-nowrap">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="bg-gray-800 border border-gray-600 text-sm rounded px-2 py-1 text-gray-200 min-w-[60px]"
      >
        {range(count).map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
    </div>
  );

  const chartProps = {
    margin: { top: 5, right: 10, left: 0, bottom: 5 },
  };

  const gridProps = {
    strokeDasharray: "3 3",
    stroke: "#374151",
  };

  const tooltipProps = {
    contentStyle: {
      backgroundColor: "#1f2937",
      border: "1px solid #374151",
      borderRadius: "6px",
      fontSize: "12px",
    },
    labelStyle: { color: "#9ca3af" },
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute inset-y-0 right-0 w-[520px] bg-gray-900/95 backdrop-blur border-l border-gray-700 z-20 flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div>
          <h2 className="text-sm font-semibold text-white">CIR Viewer</h2>
          <p className="text-xs text-gray-400 font-mono truncate max-w-[380px]">
            {jobId}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-700 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="text-sm text-gray-400">Loading job data...</div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
            Failed to load job: {error}
          </div>
        )}

        {!loading && !error && decoded && dims && (
          <>
            <div className="flex flex-wrap gap-3">
              <Dropdown
                label="Step"
                value={step}
                onChange={setStep}
                count={dims.numSteps}
              />
              <Dropdown
                label="RX Drone"
                value={rxDrone}
                onChange={setRxDrone}
                count={dims.numRx}
              />
              <Dropdown
                label="RX Ant"
                value={rxAnt}
                onChange={setRxAnt}
                count={dims.numRxAnt}
              />
              <Dropdown
                label="TX Drone"
                value={txDrone}
                onChange={setTxDrone}
                count={dims.numTx}
              />
              <Dropdown
                label="TX Ant"
                value={txAnt}
                onChange={setTxAnt}
                count={dims.numTxAnt}
              />
            </div>

            {decoded[step]?.droneLocations && (
              <div>
                <h3 className="text-xs font-medium text-gray-400 mb-1">
                  Drone Locations (Step {step})
                </h3>
                <div className="grid grid-cols-2 gap-1">
                  {decoded[step].droneLocations.map((loc, i) => (
                    <div
                      key={i}
                      className={`text-xs px-2 py-1 rounded font-mono ${
                        i === rxDrone
                          ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          : i === txDrone
                          ? "bg-green-500/15 text-green-400 border border-green-500/30"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      D{i}: [{loc.map((v) => v.toFixed(1)).join(", ")}]
                    </div>
                  ))}
                </div>
              </div>
            )}

            {chartData && (
              <>
                <div>
                  <h3 className="text-xs font-medium text-gray-400 mb-1">
                    Channel Magnitude
                  </h3>
                  <div className="h-48 bg-gray-800/50 rounded border border-gray-700 p-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} {...chartProps}>
                        <CartesianGrid {...gridProps} />
                        <XAxis
                          dataKey="tap"
                          tick={{ fontSize: 10, fill: "#9ca3af" }}
                          label={{
                            value: "Tap Index",
                            position: "insideBottom",
                            offset: -2,
                            style: { fontSize: 10, fill: "#9ca3af" },
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#9ca3af" }}
                        />
                        <Tooltip {...tooltipProps} />
                        <Line
                          type="monotone"
                          dataKey="magnitude"
                          stroke="#3b82f6"
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-medium text-gray-400 mb-1">
                    Channel Phase (radians)
                  </h3>
                  <div className="h-48 bg-gray-800/50 rounded border border-gray-700 p-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} {...chartProps}>
                        <CartesianGrid {...gridProps} />
                        <XAxis
                          dataKey="tap"
                          tick={{ fontSize: 10, fill: "#9ca3af" }}
                          label={{
                            value: "Tap Index",
                            position: "insideBottom",
                            offset: -2,
                            style: { fontSize: 10, fill: "#9ca3af" },
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#9ca3af" }}
                        />
                        <Tooltip {...tooltipProps} />
                        <Line
                          type="monotone"
                          dataKey="phase"
                          stroke="#10b981"
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={handleExport}
              disabled={!chartData}
              className="w-full h-8 text-xs font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
