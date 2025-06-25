import { useState, useEffect } from 'react';
import axios from 'axios';
import Graph from './components/Graph';
import Quiz from './components/Quiz';
import LearningPathPage from './components/LearningPathPage';
import { v4 as uuidv4 } from 'uuid';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// Type definitions
type PrereqData = {
  topic: string;
  prerequisites: string[];
};

type MCQ = {
  id: string;
  topic: string;
  question: string;
  options: string[];
  answer: string;
};

function App() {
  const [topic, setTopic] = useState('');
  const [data, setData] = useState<PrereqData | null>(null);
  const [mcqs, setMcqs] = useState<MCQ[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState('');
  const [conceptSummary, setConceptSummary] = useState('');
  const [showGraph, setShowGraph] = useState(true);
  const [currentQuizSessionId, setCurrentQuizSessionId] = useState<string>(uuidv4());
  const [attemptsToday, setAttemptsToday] = useState(0);
  const [canAttempt, setCanAttempt] = useState(true);
  const [quizPassed, setQuizPassed] = useState(false);
  const [showLearningPathPage, setShowLearningPathPage] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [showLearnPathBtn, setShowLearnPathBtn] = useState(false);

  const navigate = useNavigate();

  // Check remaining attempts on mount or topic change
  useEffect(() => {
    const checkAttempts = async () => {
      if (!topic) return;
      try {
        const res = await axios.get('http://localhost:5000/api/quiz-attempts', {
          params: { topic },
        });
        setAttemptsToday(res.data.attemptsToday);
        setCanAttempt(res.data.canAttempt);
      } catch (err) {
        console.error('Error checking quiz attempts:', err);
        alert('Failed to verify quiz attempts. Please try again.');
      }
    };
    checkAttempts();
  }, [topic]);

  const handleSubmit = async () => {
    if (!topic.trim()) {
      alert('Please enter a topic.');
      return;
    }
    setLoading(true);
    setMcqs(null);
    setData(null);
    setSelectedConcept('');
    setConceptSummary('');
    setShowGraph(true);
    setIsAcknowledged(false);
    setCurrentQuizSessionId(uuidv4());
    setQuizPassed(false);
    setAttemptsToday(0);
    setCanAttempt(true);
    setShowLearningPathPage(false);
    setQuizScore(0);
    setShowLearnPathBtn(false);
    try {
      const res = await axios.post('http://localhost:5000/api/prerequisites', { topic });
      setData(res.data);
    } catch (err) {
      console.error('Error fetching prerequisites:', err);
      alert('Failed to fetch prerequisites. Please check server and topic.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromLearningPath = () => {
    setShowLearningPathPage(false);
  };

  const fetchMCQs = async (resetCache: boolean = false) => {
    if (!data || (!isAcknowledged && !resetCache)) {
      if (!data) console.warn("No prerequisite data to fetch MCQs for.");
      if (!isAcknowledged && !resetCache) console.warn("Prerequisites not acknowledged yet.");
      return;
    }

    // Check attempts before fetching
    try {
      const res = await axios.get('http://localhost:5000/api/quiz-attempts', {
        params: { topic: data.topic },
      });
      setAttemptsToday(res.data.attemptsToday);
      setCanAttempt(res.data.canAttempt);
      if (!res.data.canAttempt) {
        alert(`Max attempts reached for ${data.topic} today. Please try again tomorrow.`);
        return;
      }
    } catch (err) {
      console.error('Error checking quiz attempts:', err);
      alert('Failed to verify quiz attempts. Please try again.');
      return;
    }

    setQuizLoading(true);
    setMcqs(null);
    setCurrentQuizSessionId(uuidv4());
    setQuizPassed(false);

    try {
      const res = await axios.post('http://localhost:5000/api/prerequisites/mcq', {
        prerequisites: data.prerequisites,
        restart: resetCache,
      });
      setMcqs(res.data);
      console.log("MCQs fetched successfully. Current quiz ID:", currentQuizSessionId);
    } catch (err) {
      console.error('Error fetching MCQs:', err);
      alert('Failed to fetch quiz questions. Please try again.');
    } finally {
      setQuizLoading(false);
    }
  };

  const handleConceptClick = async (concept: string) => {
    setSelectedConcept(concept);
    setConceptSummary('⏳ Loading...');
    setShowGraph(false);
    try {
      const res = await axios.post('http://localhost:5000/api/topic-summary', {
        topic: concept,
        mainTopic: data?.topic || '',
      });
      setConceptSummary(res.data.summary);
    } catch (err) {
      console.error('Error fetching summary', err);
      setConceptSummary('⚠️ Failed to load summary.');
    }
  };

  const handleQuizRestart = async (score: number, passed: boolean) => {
    console.log("App.tsx: Quiz restart requested by Quiz component. Score:", score, "Passed:", passed);
    if (passed) {
      console.log("Restart blocked: User passed the quiz.");
      setQuizPassed(true);
      return;
    }

    try {
      const res = await axios.get('http://localhost:5000/api/quiz-attempts', {
        params: { topic: data?.topic },
      });
      setAttemptsToday(res.data.attemptsToday);
      setCanAttempt(res.data.canAttempt);
      if (!res.data.canAttempt) {
        console.log("Restart blocked: Max attempts reached.");
        return;
      }
    } catch (err) {
      console.error('Error checking quiz attempts:', err);
      alert('Failed to verify quiz attempts. Please try again.');
      return;
    }

    setIsAcknowledged(false);
    await fetchMCQs(true);
  };

  const handleQuizSubmit = async (score: number, total: number) => {
    const scorePercentage = (score / total) * 100;
    const passed = scorePercentage >= 65;
    setQuizScore(scorePercentage);
    setQuizPassed(passed);
    setShowLearnPathBtn(passed);
    try {
      await axios.post('http://localhost:5000/api/quiz-attempts', {
        quizId: currentQuizSessionId,
        score: scorePercentage,
        passed,
        topic: data?.topic,
      });
      setAttemptsToday((prev) => prev + 1);
      setCanAttempt(attemptsToday + 1 < 3);
    } catch (err) {
      console.error('Error recording quiz attempt:', err);
      alert('Failed to record quiz attempt. Please try again.');
    }
  };

  const handleLearnPathClick = () => {
    navigate('/learning-path', { 
      state: { 
        topic: data?.topic || topic, 
        score: quizScore 
      } 
    });
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(to right, #f3f4f6, #e0e7ff)',
            padding: '20px',
          }}>
            <header style={{
              backgroundColor: '#4f46e5',
              color: '#fff',
              padding: '24px 32px',
              borderRadius: '12px',
              marginBottom: '30px',
              textAlign: 'center',
            }}>
              <h1 style={{ fontSize: '32px', margin: 0 }}>📘 LearnPath</h1>
              <p style={{ marginTop: '8px', fontSize: '16px', opacity: 0.9 }}>
                A Smart Learning Path Recommender, Get the best prerequisites before diving into any topic.
              </p>
            </header>

            <div style={{
              maxWidth: '1400px',
              margin: '0 auto',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '30px',
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '40px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            }}>
              <div style={{ flex: 1, minWidth: '300px' }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  marginBottom: '20px',
                  color: '#1f2937'
                }}>
                  Enter a Topic
                </h2>

                <div style={{ marginBottom: '20px' }}>
                  <p style={{ marginBottom: '10px', fontWeight: 600 }}>Try one of these:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {['Machine Learning', 'Data Structures', 'Cloud Computing', 'Blockchain', 'AI Ethics'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTopic(t)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#e0e7ff',
                          border: '1px solid #6366f1',
                          color: '#3730a3',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          transition: '0.2s ease-in-out'
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Deep Learning"
                    style={{
                      flexGrow: 1,
                      padding: '14px',
                      fontSize: '16px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      outlineColor: '#6366f1'
                    }}
                  />
                  <button
                    onClick={handleSubmit}
                    style={{
                      padding: '14px 22px',
                      fontSize: '16px',
                      backgroundColor: '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Generate'}
                  </button>
                </div>

                {loading && (
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <div className="loader"></div>
                    <p>Generating personalized recommendations...</p>
                  </div>
                )}

                {data && (
                  <>
                    <h3 style={{ marginTop: '24px', marginBottom: '12px', fontSize: '20px', fontWeight: 600 }}>
                      Prerequisites for <span style={{ color: '#6366f1' }}>{data.topic}</span>
                    </h3>
                    <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                      {data.prerequisites.map((item, i) => (
                        <li
                          key={i}
                          onClick={() => handleConceptClick(item)}
                          title="Click to explore this topic"
                          style={{
                            color: '#1f2937',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            marginBottom: '6px',
                            textDecoration: selectedConcept === item ? 'underline' : 'none',
                            fontWeight: selectedConcept === item ? 'bold' : 'normal',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                            e.currentTarget.style.color = '#4f46e5';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration =
                              selectedConcept === item ? 'underline' : 'none';
                            e.currentTarget.style.color = '#1f2937';
                          }}
                        >
                          {item}
                        </li>
                      ))}
                    </ul>

                    {!mcqs && canAttempt && (
                      <>
                        <label style={{ display: 'flex', alignItems: 'center', marginTop: '20px', color: '#374151' }}>
                          <input
                            type="checkbox"
                            checked={isAcknowledged}
                            onChange={(e) => setIsAcknowledged(e.target.checked)}
                            style={{ marginRight: '8px' }}
                          />
                          I have thoroughly reviewed all prerequisites and am ready for the test
                        </label>
                        <button
                          onClick={() => fetchMCQs(false)}
                          style={{
                            marginTop: '10px',
                            padding: '12px 20px',
                            backgroundColor: '#10b981',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: isAcknowledged && !quizLoading ? 'pointer' : 'not-allowed',
                            opacity: isAcknowledged && !quizLoading ? 1 : 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                          }}
                          disabled={!isAcknowledged || quizLoading}
                        >
                          {quizLoading ? (
                            <>
                              <span className="loader" style={{ border: '3px solid #fff', borderTop: '3px solid transparent', width: '16px', height: '16px' }}></span>
                              Starting...
                            </>
                          ) : (
                            `Start Quiz on Prerequisites (${3 - attemptsToday} attempt${3 - attemptsToday === 1 ? '' : 's'} left today)`
                          )}
                        </button>
                      </>
                    )}
                    {!canAttempt && (
                      <p style={{ color: '#ef4444', marginTop: '20px', fontWeight: 'bold' }}>
                        ⚠️ Max attempts reached for {data.topic} today. Please try again tomorrow.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div style={{ flex: 1.5, minWidth: '400px', minHeight: '500px' }}>
                {showGraph && data?.topic && data?.prerequisites && (
                  <div style={{
                    backgroundColor: '#eef2ff',
                    border: '2px dashed #6366f1',
                    borderRadius: '12px',
                    padding: '20px'
                  }}>
                    <h2 style={{ fontSize: '20px', color: '#4f46e5', marginBottom: '12px' }}>
                      📈 Prerequisite Graph for {data.topic}
                    </h2>
                    <Graph topic={data.topic} prerequisites={data.prerequisites} />
                  </div>
                )}

                {!showGraph && selectedConcept && (
                  <div style={{
                    backgroundColor: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '12px',
                    padding: '20px'
                  }}>
                    <h2 style={{ fontSize: '20px', color: '#92400e', marginBottom: '12px' }}>
                      📘 Main Concepts of {selectedConcept}
                    </h2>
                    <p style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>
                      {conceptSummary}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '40px' }}>
              {mcqs && (
                <>
                  <Quiz
                    mcqs={mcqs}
                    quizId={currentQuizSessionId}
                    onRestartQuiz={handleQuizRestart}
                    onSubmitQuiz={handleQuizSubmit}
                    canAttempt={canAttempt}
                    attemptsToday={attemptsToday}
                    quizPassed={quizPassed}
                    topic={data?.topic || ''}
                  />
                  {showLearnPathBtn && (
                    <div style={{ textAlign: 'center', marginTop: '32px' }}>
                      <button
                        onClick={handleLearnPathClick}
                        style={{
                          padding: '16px 32px',
                          backgroundColor: '#4f46e5',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '20px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        Proceed to Learning Path
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <style>{`
              .loader {
                border: 5px solid #e0e7ff;
                border-top: 5px solid #6366f1;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 10px;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        }
      />
      <Route
        path="/learning-path"
        element={<LearningPathPageWrapper />}
      />
    </Routes>
  );
}

function LearningPathPageWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const topic = state.topic || '';
  const score = state.score || 0;
  
  return (
    <LearningPathPage
      topic={topic}
      scorePercentage={score}
      onBack={() => navigate(-1)}
    />
  );
}

export default App;
