export default async function handler(req, res) {
  console.log("API called with method:", req.method);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.status(200).json({ message: "Hello, this is a POST endpoint!" });
}