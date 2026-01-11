import { useState } from 'react'
import './App.css'

function App() {
  const [task, setTask] = useState("")
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState([])

  // Predefined task suggestions
  const suggestions = [
    "Open a news site, search for 'AI', and return the titles and URLs of the top 5 articles",
    "Find the top 5 YouTube channels and their subscriber counts",
    "Search for the latest Tesla stock price and news",
    "Find the top 5 trending topics on Twitter",
    "Search for Python tutorials and return the top 5 results",
    "Find the weather forecast for New York for the next 5 days",
    "Search for the best restaurants in Paris and return top 5",
    "Find the top 5 movies on IMDb this week",
    "Search for cryptocurrency prices (Bitcoin, Ethereum, Dogecoin)",
    "Find job openings for 'Software Engineer' on LinkedIn"
  ]

  const handleTaskChange = (e) => {
    const value = e.target.value
    setTask(value)

    // Filter suggestions based on input
    if (value.length > 0) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
      setFilteredSuggestions([])
    }
  }

  const handleSuggestionClick = (suggestion) => {
    setTask(suggestion)
    setShowSuggestions(false)
  }

  const handleRunAgent = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setShowSuggestions(false)
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

    // Clean the text first - remove escaped characters
    const cleanedText = text.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');

    // Pattern 1: "Title: [title], URL: [url]" format
    const titleUrlPattern = /(\d+)\.\s*Title:\s*([^,\n]+?)(?:,\s*)?(?:URL:|,\s*URL:)\s*(https?:\/\/[^\s\n,]+)/gi;
    let articleMatches = [...cleanedText.matchAll(titleUrlPattern)];

    // Pattern 2: Try to match numbered items with URLs anywhere in the line
    if (articleMatches.length === 0) {
      const altPattern = /(\d+)\.\s*([^(\n]+?)\s*(?:\(|,\s*)?(https?:\/\/[^\s\)\n,]+)/gi;
      articleMatches = [...cleanedText.matchAll(altPattern)];
    }

    // Pattern 3: Most flexible - any numbered line with URL
    if (articleMatches.length === 0) {
      const flexPattern = /(\d+)\.\s*(.+?)(https?:\/\/[^\s\n]+)/gi;
      articleMatches = [...cleanedText.matchAll(flexPattern)];
    }

    if (articleMatches.length > 0) {
      return (
        <div className="findings-grid">
          {articleMatches.map((match, index) => {
            const number = match[1];
            let title = match[2];
            const url = match[3];

            // Clean up the title
            title = title
              .replace(/Title:\s*/gi, '')
              .replace(/URL:\s*/gi, '')
              .replace(/[,\(\)]+$/g, '')
              .replace(/\s+/g, ' ')
              .trim();

            return (
              <div key={index} className="finding-card">
                <div className="finding-number">{number}</div>
                <div className="finding-content">
                  <div className="finding-title">{title}</div>
                  <div className="finding-details">
                    <a
                      href={url.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="finding-link"
                    >
                      🔗 View Article
                    </a>
                    <div style={{ fontSize: '0.85em', marginTop: '0.5rem', color: '#888', wordBreak: 'break-all' }}>
                      {url.trim()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Pattern 4: Handle numbered lists with parentheses in paragraph format
    // Example: "The top 5 items are: 1) Item, 2) Item, 3) Item"
    const parenPattern = /(\d+)\)\s*([^,\d]+?)(?=\s*(?:,?\s*(?:and\s+)?\d+\)|,?\s*and\s*\d+\)|\.?\s*$))/gi;
    const parenMatches = [...cleanedText.matchAll(parenPattern)];

    if (parenMatches.length > 1) { // Need at least 2 matches to consider it a list
      return (
        <div className="findings-grid">
          {parenMatches.map((match, index) => {
            const number = match[1];
            let content = match[2].trim();

            // Clean up trailing punctuation and conjunctions
            content = content
              .replace(/\s*,\s*$/g, '')
              .replace(/\s+and\s*$/gi, '')
              .replace(/\.+$/g, '')
              .trim();

            return (
              <div key={index} className="finding-card">
                <div className="finding-number">{number}</div>
                <div className="finding-content">
                  <div className="finding-title">{content}</div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Fallback: numbered items without explicit URL pattern
    const numberedItemRegex = /(\d+)\.\s+([^\n]+)/g;
    const matches = [...cleanedText.matchAll(numberedItemRegex)];

    if (matches.length > 0) {
      return (
        <div className="findings-grid">
          {matches.map((match, index) => {
            const [, number, content] = match;

            // Extract URLs from content
            const urlRegex = /(https?:\/\/[^\s,\)\n]+)/g;
            const urls = content.match(urlRegex) || [];

            // Remove URLs and clean up title
            let title = content
              .replace(urlRegex, '')
              .replace(/Title:\s*/gi, '')
              .replace(/URL:\s*/gi, '')
              .replace(/[\(\),]+$/g, '')
              .replace(/,\s*,/g, ',')
              .replace(/\s+/g, ' ')
              .trim();

            return (
              <div key={index} className="finding-card">
                <div className="finding-number">{number}</div>
                <div className="finding-content">
                  <div className="finding-title">{title}</div>
                  {urls.length > 0 && (
                    <div className="finding-details">
                      {urls.map((url, urlIndex) => (
                        <div key={urlIndex} style={{ marginBottom: '0.5rem' }}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="finding-link"
                          >
                            🔗 View Article
                          </a>
                          <div style={{ fontSize: '0.85em', marginTop: '0.25rem', color: '#888', wordBreak: 'break-all' }}>
                            {url}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Ultimate fallback: display as formatted lines
    const lines = cleanedText.split('\n').filter(line => line.trim());
    return (
      <div className="findings-grid" style={{ gridTemplateColumns: '1fr' }}>
        {lines.map((line, index) => {
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const urls = line.match(urlRegex) || [];
          const textWithoutUrls = line.replace(urlRegex, '').trim();

          if (!textWithoutUrls && urls.length === 0) return null;

          return (
            <div key={index} className="finding-card">
              <div className="finding-content" style={{ width: '100%' }}>
                {textWithoutUrls && <div className="finding-title">{textWithoutUrls}</div>}
                {urls.length > 0 && (
                  <div className="finding-details">
                    {urls.map((url, urlIndex) => (
                      <a
                        key={urlIndex}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="finding-link"
                        style={{ display: 'block', marginTop: '0.5rem' }}
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container">
      <header>
        <h1>Browser Agent Interface</h1>
        <p>Powered by browser-use & Gemini</p>
      </header>

      <main>
        <div className="input-group" style={{ position: 'relative' }}>
          <label htmlFor="task-input">Agent Task</label>
          <textarea
            id="task-input"
            value={task}
            onChange={handleTaskChange}
            onFocus={() => task.length > 0 && filteredSuggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            rows={4}
            placeholder="Describe what you want the agent to do... (e.g., 'Find top 5 YouTube channels')"
          />

          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="suggestions-dropdown">
              {filteredSuggestions.slice(0, 5).map((suggestion, index) => (
                <div
                  key={index}
                  className="suggestion-item"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  💡 {suggestion}
                </div>
              ))}
            </div>
          )}
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
