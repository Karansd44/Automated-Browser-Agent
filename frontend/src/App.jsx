import { useState } from 'react'
import './App.css'

function App() {
  const [task, setTask] = useState("Open a news site, search for 'AI', and return the titles and URLs of the top 5 articles")
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleRunAgent = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('http://localhost:8000/api/run-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Function to format the findings content
  const formatFindings = (text) => {
    if (!text) return null;

    // Split by newlines to preserve formatting
    const lines = text.split('\n');

    return lines.map((line, index) => {
      // Check if line contains a URL
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = line.split(urlRegex);

      return (
        <div key={index} style={{ marginBottom: '0.5rem' }}>
          {parts.map((part, i) => {
            if (part.match(urlRegex)) {
              return (
                <a
                  key={i}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#42d392', textDecoration: 'underline' }}
                >
                  {part}
                </a>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <div className="container">
      <header>
        <h1>Browser Agent Interface</h1>
        <p>Powered by browser-use & Gemini</p>
      </header>

      <main>
        <div className="input-group">
          <label htmlFor="task-input">Agent Task</label>
          <textarea
            id="task-input"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={4}
            placeholder="Describe what you want the agent to do..."
          />
        </div>

        <button
          onClick={handleRunAgent}
          disabled={loading}
          className="run-button"
        >
          {loading ? 'Agent is Working...' : 'Run Agent'}
        </button>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="result-container">
            <h2>✓ Task Completed</h2>

            {result.task && (
              <div className="result-section">
                <h3>Task</h3>
                <p>{result.task}</p>
              </div>
            )}

            {result.summary && (
              <div className="result-section">
                <h3>Summary</h3>
                <p>{result.summary}</p>
              </div>
            )}

            {result.final_result && (
              <div className="result-section">
                <h3>Findings</h3>
                <div className="findings-content">
                  {formatFindings(result.final_result)}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
