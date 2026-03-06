export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({ message: 'Missing jobId parameter' });
  }

  try {
    const response = await fetch(`${process.env.SIMULATION_API_URL}/db/jobs/${jobId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ message: 'Job not found' });
      }
      throw new Error(`Simulation service error: ${response.status}`);
    }

    const job = await response.json();
    res.status(200).json(job);
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ message: 'Failed to fetch job status', error: error.message });
  }
}
