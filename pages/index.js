// pages/index.js
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a CSV file.');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('csv', file);

    try {
      // Explicitly set method to POST and provide the FormData
      const res = await fetch('/api/run-lighthouse', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      // Assume the response is a CSV blob for download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (error) {
      console.error('Error uploading CSV:', error);
      alert(error.message);
    }
    setLoading(false);
  };

  return (
    <div>
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