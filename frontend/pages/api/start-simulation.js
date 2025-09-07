// frontend/pages/api/start-simulation.js
// Example API route for frontend to start a simulation job

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get the simulation configuration from the request body
    const config = req.body;

    // In a real implementation, you would send this to your backend service
    // For this example, we'll just log it
    console.log('Received simulation config:', config);

    // Make a request to the simulation service to start the job
    const response = await fetch(`${process.env.SIMULATION_API_URL}/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Simulation service error: ${response.status}`);
    }

    const job = await response.json();

    // Return the job information to the frontend
    res.status(200).json({
      message: 'Simulation job started',
      jobId: job.id,
    });
  } catch (error) {
    console.error('Error starting simulation:', error);
    res.status(500).json({ message: 'Failed to start simulation', error: error.message });
  }
}