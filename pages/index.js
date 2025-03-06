// pages/index.js
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('csv', file);
    const res = await fetch('/api/run-lighthouse', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    } else {
      alert('Error running Lighthouse');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Lighthouse CSV Runner</h1>
      <form onSubmit={handleSubmit}>
        <input type="file" accept=".csv" onChange={handleFileChange} />
        <button type="submit" disabled={loading}>Run Lighthouse</button>
      </form>
      {loading && <p>Processing...</p>}
      {downloadUrl && (
        <div>
          <p>Processing complete. <a href={downloadUrl} download="lighthouse-results.csv">Download CSV</a></p>
        </div>
      )}
    </div>
  );
}