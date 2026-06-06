import { useState } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function handleFileChange(e) {
    const selected = e.target.files[0];
    setFile(selected || null);
    setError("");
    setResult(null);
  }

  async function handleAnalyze(e) {
    e.preventDefault();

    if (!file) {
      setError("Please upload a resume first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("resume", file);
    formData.append("jobTitle", jobTitle);
    formData.append("jobDescription", jobDescription);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setResult(data);
    } catch {
      setError("Could not connect to server. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }

  function getScoreColor(score) {
    if (score >= 80) return "score-high";
    if (score >= 60) return "score-medium";
    return "score-low";
  }

  function getVerdictClass(verdict) {
    if (verdict === "Shortlisted") return "verdict-good";
    if (verdict === "Under Review") return "verdict-ok";
    if (verdict === "Low Match") return "verdict-warn";
    return "verdict-bad";
  }

  function getBarColor(score) {
    if (score >= 80) return "bar-high";
    if (score >= 60) return "bar-medium";
    return "bar-low";
  }

  return (
    <div className="app">
      <header className="header">
        <h1>ATS Resume Checker</h1>
        <p>
          Scored the same way companies filter resumes — keyword match, skills,
          experience, education &amp; format
        </p>
      </header>

      <main className="main">
        <form className="card" onSubmit={handleAnalyze}>
          <h2>1. Upload Resume</h2>

          <label className="file-label">
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              disabled={loading}
            />
            <span className="file-box">
              {file ? file.name : "Choose PDF or DOCX file"}
            </span>
          </label>

          <h2 className="section-title">2. Job Details</h2>
          <p className="hint">
            Paste the job description — ATS ranks you by keyword match against it
            (this is the #1 factor companies use)
          </p>

          <div className="field">
            <label htmlFor="jobTitle">Job Title</label>
            <input
              id="jobTitle"
              type="text"
              placeholder="e.g. Software Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="field">
            <label htmlFor="jobDescription">Job Description</label>
            <textarea
              id="jobDescription"
              placeholder="Paste the full job description here..."
              rows={5}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn" disabled={loading || !file}>
            {loading ? "Scanning like ATS..." : "Check ATS Score"}
          </button>
        </form>

        {result && (
          <div className="results">
            {/* Verdict + Score */}
            <div className="card score-card">
              <span className={`verdict ${getVerdictClass(result.verdict)}`}>
                {result.verdict}
              </span>
              <div className={`score-circle ${getScoreColor(result.atsScore)}`}>
                <span className="score-number">{result.atsScore}</span>
                <span className="score-label">/ 100</span>
              </div>
              <p className="summary">{result.verdictDetail}</p>
              {result.keywordMatchPercent !== null && (
                <p className="keyword-match">
                  Keyword Match: <strong>{result.keywordMatchPercent}%</strong> with job description
                </p>
              )}
            </div>

            {/* Knockout warnings */}
            {result.knockoutFails && result.knockoutFails.length > 0 && (
              <div className="card knockout">
                <h2 className="text-red">ATS Knockout Filters Failed</h2>
                <p className="hint">These are reasons ATS may auto-reject before a human sees your resume:</p>
                <ul>
                  {result.knockoutFails.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* ATS Breakdown — how companies score */}
            {result.breakdown && (
              <div className="card">
                <h2>How ATS Scored You</h2>
                <p className="hint">Same categories companies use to rank candidates</p>
                <div className="breakdown">
                  {result.breakdown.map((item, i) => (
                    <div key={i} className="breakdown-row">
                      <div className="breakdown-header">
                        <span>{item.name}</span>
                        <span>{item.score}% <small>({item.weight}% weight)</small></span>
                      </div>
                      <div className="bar-track">
                        <div
                          className={`bar-fill ${getBarColor(item.score)}`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                      <p className="breakdown-detail">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matched vs Missing Keywords */}
            {result.matchedKeywords && result.matchedKeywords.length > 0 && (
              <div className="card">
                <h2 className="text-green">Keywords Found in Resume</h2>
                <div className="tags">
                  {result.matchedKeywords.map((kw, i) => (
                    <span key={i} className="tag tag-green">{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {result.missingKeywords && result.missingKeywords.length > 0 && (
              <div className="card">
                <h2 className="text-red">Missing Keywords (ATS won't rank you for these)</h2>
                <div className="tags">
                  {result.missingKeywords.map((kw, i) => (
                    <span key={i} className="tag tag-red">{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {result.missingSkills && result.missingSkills.length > 0 && (
              <div className="card">
                <h2 className="text-yellow">Missing Required Skills</h2>
                <div className="tags">
                  {result.missingSkills.map((s, i) => (
                    <span key={i} className="tag tag-yellow">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <h2 className="text-green">Strengths</h2>
              <ul>
                {result.strengths.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h2 className="text-red">Weaknesses</h2>
              <ul>
                {result.weaknesses.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h2 className="text-blue">Recommendations</h2>
              <ul>
                {result.recommendations.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>ATS scoring: Keyword Match 35% · Skills 25% · Experience 15% · Education 10% · Format 10%</p>
      </footer>
    </div>
  );
}

export default App;
