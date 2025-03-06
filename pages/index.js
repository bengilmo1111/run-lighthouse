// pages/index.js
import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');

  const handleRunLighthouse = async () => {
    setLoading(true);
    setDownloadUrl('');
    try {
      // Send a GET request to your static API endpoint
      const res = await fetch('/api/run-lighthouse');
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      // Assume the API returns a CSV blob for download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (error) {
      console.error('Error running Lighthouse:', error);
      alert(error.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Lighthouse Static URL Runner</h1>
      <button onClick={handleRunLighthouse} disabled={loading}>
        {loading ? 'Processing...' : 'Run Lighthouse'}
      </button>
      {loading && <p>Please wait while we process the URLs...</p>}
      {downloadUrl && (
        <p>
          Processing complete.{' '}
          <a href={downloadUrl} download="lighthouse-results.csv">
            Download CSV
          </a>
        </p>
      )}
    </div>
  );
}