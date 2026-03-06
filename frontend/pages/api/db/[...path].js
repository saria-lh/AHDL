const DATABASE_URL = process.env.DATABASE_URL || "http://database:8000";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  const { path } = req.query;
  const target = `${DATABASE_URL}/${path.join("/")}`;

  try {
    const headers = { "Content-Type": req.headers["content-type"] || "application/json" };

    const fetchOpts = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      fetchOpts.body = Buffer.concat(chunks);
    }

    const upstream = await fetch(target, fetchOpts);

    res.status(upstream.status);

    const ct = upstream.headers.get("content-type") || "";
    res.setHeader("Content-Type", ct);

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err) {
    console.error("DB proxy error:", err.message);
    res.status(502).json({ error: "Database service unavailable" });
  }
}
