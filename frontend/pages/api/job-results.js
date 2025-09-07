// frontend/pages/api/job-results.js
// Example API route for frontend to get job results

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({ message: 'Missing jobId parameter' });
  }

  try {
    // Make a request to the simulation service to get job with results
    const response = await fetch(`${process.env.SIMULATION_API_URL}/db/jobs/${jobId}/results`);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ message: 'Job not found' });
      }
      throw new Error(`Simulation service error: ${response.status}`);
    }

    const jobWithResults = await response.json();

    // Return the job information with results to the frontend
    res.status(200).json(jobWithResults);
  } catch (error) {
    console.error('Error fetching job results:', error);
    res.status(500).json({ message: 'Failed to fetch job results', error: error.message });
  }
}