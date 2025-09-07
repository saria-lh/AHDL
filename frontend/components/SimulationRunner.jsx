// frontend/components/SimulationRunner.jsx
// Example component showing how to interact with the simulation API

import { useState } from 'react';
import { Button } from "@/components/ui/button";

export default function SimulationRunner({ config }) {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, starting, running, completed, failed
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const startSimulation = async () => {
    try {
      setStatus('starting');
      setError(null);
      
      const response = await fetch('/api/start-simulation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to start simulation: ${response.status}`);
      }

      const data = await response.json();
      setJobId(data.jobId);
      setStatus('running');
      setProgress(0);
      
      // Start polling for status updates
      pollJobStatus(data.jobId);
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  const pollJobStatus = async (id) => {
    try {
      const response = await fetch(`/api/job-status?jobId=${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch job status: ${response.status}`);
      }
      
      const job = await response.json();
      
      setStatus(job.status);
      setProgress(job.progress);
      
      if (job.status === 'running') {
        // Continue polling
        setTimeout(() => pollJobStatus(id), 2000); // Poll every 2 seconds
      } else if (job.status === 'completed') {
        // Fetch results
        fetchResults(id);
      }
    } catch (err) {
      setError(err.message);
      setStatus('failed');
    }
  };

  const fetchResults = async (id) => {
    try {
      const response = await fetch(`/api/job-results?jobId=${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Simulation Runner</h3>
      
      {status === 'idle' && (
        <Button onClick={startSimulation}>Start Simulation</Button>
      )}
      
      {status === 'starting' && (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
          <span>Starting simulation...</span>
        </div>
      )}
      
      {status === 'running' && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Running simulation...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {status === 'completed' && (
        <div className="space-y-2">
          <div className="text-green-400">Simulation completed!</div>
          {results && (
            <div className="text-sm">
              <div>Simulation time: {results[0]?.data?.simulation_time}</div>
              <div>Drones: {results[0]?.data?.drone_count}</div>
              <div>Data points: {results[0]?.data?.data_points}</div>
            </div>
          )}
        </div>
      )}
      
      {status === 'failed' && (
        <div className="text-red-400">Simulation failed: {error}</div>
      )}
      
      {error && status !== 'failed' && (
        <div className="text-red-400">Error: {error}</div>
      )}
    </div>
  );
}