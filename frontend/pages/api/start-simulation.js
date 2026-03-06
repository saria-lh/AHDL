export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const config = req.body;

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
    res.status(200).json({
      message: 'Simulation job started',
      jobId: job.id,
    });
  } catch (error) {
    console.error('Error starting simulation:', error);
    res.status(500).json({ message: 'Failed to start simulation', error: error.message });
  }
}
