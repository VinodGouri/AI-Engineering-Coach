/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  CheckCircle2, 
  ChevronRight, 
  GraduationCap, 
  Trophy, 
  AlertCircle, 
  Clock, 
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Award,
  BarChart3,
  User,
  BrainCircuit,
  Eye,
  EyeOff,
  Home,
  CloudOff,
  Wifi
} from 'lucide-react';
import { 
  generateQuestions, 
  analyzeGaps, 
  generateStudyNotes,
  generateDetailedInfo,
  getExternalResources,
  generateCodingProblems,
  runCode,
  Difficulty, 
  Question, 
  AssessmentResult,
  StudyNote,
  DetailedSubjectInfo,
  ExternalResource,
  CodingProblem
} from './services/geminiService';
import Editor from '@monaco-editor/react';

const SUBJECTS = [
  "C", "C++", "Java", "Python", "DSA", "DBMS", "OS", "CN", "Web Development", "AI/ML"
];

type AppState = 'auth' | 'dashboard' | 'admin-dashboard' | 'subject-selection' | 'study-notes' | 'detailed-info' | 'external-resources' | 'test-intro' | 'testing' | 'results' | 'review' | 'certificate' | 'admin-create-contest' | 'practice-ide' | 'contest-lobby' | 'contest-active';

interface TestAttempt {
  date: string;
  subjects: string[];
  level: Difficulty;
  score: number;
  totalQuestions: number;
  weakAreas: string[];
  attemptNumber: number;
}

interface Contest {
  id: string;
  title: string;
  startTime: string;
  duration: number; // in minutes
  subjects: string[];
  problems: CodingProblem[];
}

interface UserStats {
  name: string;
  email: string;
  password?: string;
  role: 'STUDENT' | 'ADMIN';
  level: Difficulty;
  badges: string[];
  totalTests: number;
  highestScore: number;
  averageScore: number;
  beginnerAttempts: number;
  advancedAttempts: number;
  expertAttempts: number;
  lastScores: number[];
  weakAreas: string[];
  placementReady: boolean;
  attempts?: TestAttempt[];
}

export default function App() {
  // User State
  const [user, setUser] = useState<UserStats | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'STUDENT' | 'ADMIN'>('STUDENT');
  const [adminCode, setAdminCode] = useState('');
  
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.BEGINNER);
  const [appState, setAppState] = useState<AppState>('auth');
  
  // Test State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([]);
  const [detailedInfo, setDetailedInfo] = useState<DetailedSubjectInfo[]>([]);
  const [externalResources, setExternalResources] = useState<ExternalResource[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AssessmentResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(120); // 120 seconds per question

  // Contest & IDE State
  const [contests, setContests] = useState<Contest[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOnlineStatus, setShowOnlineStatus] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineStatus(true);
      setTimeout(() => setShowOnlineStatus(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineStatus(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkConnection = () => {
    setIsOnline(navigator.onLine);
    if (navigator.onLine) {
      setShowOnlineStatus(true);
      setTimeout(() => setShowOnlineStatus(false), 3000);
    }
  };
  const [activeContest, setActiveContest] = useState<Contest | null>(null);
  const [contestTimeLeft, setContestTimeLeft] = useState(120 * 60); // 120 minutes
  const [tabSwitches, setTabSwitches] = useState(0);
  const [codingSubmissions, setCodingSubmissions] = useState<Record<string, string>>({});
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [practiceCode, setPracticeCode] = useState('');
  const [contestProblems, setContestProblems] = useState<CodingProblem[]>([]);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [codeOutput, setCodeOutput] = useState<{ output: string; error?: string } | null>(null);
  const [isRunningCode, setIsRunningCode] = useState(false);

  // Progress Persistence
  useEffect(() => {
    const currentEmail = localStorage.getItem('coach_current_user_email');
    const savedUsers = localStorage.getItem('coach_users');
    const savedContests = localStorage.getItem('coach_contests');
    
    if (savedContests) {
      setContests(JSON.parse(savedContests));
    }

    if (currentEmail && savedUsers) {
      const users = JSON.parse(savedUsers);
      const userData = users[currentEmail];
      if (userData) {
        setUser(userData);
        setDifficulty(userData.level || Difficulty.BEGINNER);
        setAppState(userData.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard');
      }
    }
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const savedUsers = localStorage.getItem('coach_users');
    const users = savedUsers ? JSON.parse(savedUsers) : {};

    if (authMode === 'register') {
      if (users[email]) {
        alert('User already exists. Please login.');
        return;
      }

      let finalRole = role;
      if (role === 'ADMIN') {
        if (adminCode !== 'ADMIN123') {
          alert('Invalid Admin Access Code. Defaulting to STUDENT role.');
          finalRole = 'STUDENT';
        }
      }

      const newUser: UserStats = {
        name,
        email,
        password,
        role: finalRole,
        level: Difficulty.BEGINNER,
        badges: [],
        totalTests: 0,
        highestScore: 0,
        averageScore: 0,
        beginnerAttempts: 0,
        advancedAttempts: 0,
        expertAttempts: 0,
        lastScores: [],
        weakAreas: [],
        placementReady: false
      };
      users[email] = newUser;
      localStorage.setItem('coach_users', JSON.stringify(users));
      localStorage.setItem('coach_current_user_email', email);
      setUser(newUser);
      setAppState(finalRole === 'ADMIN' ? 'admin-dashboard' : 'dashboard');
    } else {
      const userData = users[email];
      if (userData) {
        if (userData.password === password) {
          localStorage.setItem('coach_current_user_email', email);
          setUser(userData);
          setDifficulty(userData.level || Difficulty.BEGINNER);
          setAppState(userData.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard');
        } else {
          alert('Invalid credentials');
        }
      } else {
        alert('User not found. Please register.');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('coach_current_user_email');
    setAppState('auth');
    setUser(null);
    setEmail('');
    setPassword('');
    setName('');
    setShowPassword(false);
  };

  // Timer logic
  useEffect(() => {
    let timer: number;
    if (appState === 'testing' && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && appState === 'testing') {
      handleNextQuestion();
    }
    return () => clearInterval(timer);
  }, [appState, timeLeft]);

  // Contest Timer logic
  useEffect(() => {
    let timer: number;
    if (appState === 'contest-active' && contestTimeLeft > 0) {
      timer = window.setInterval(() => {
        setContestTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (contestTimeLeft === 0 && appState === 'contest-active') {
      handleSubmitContest();
    }
    return () => clearInterval(timer);
  }, [appState, contestTimeLeft]);

  // Anti-cheating logic
  useEffect(() => {
    if (appState === 'contest-active') {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          setTabSwitches(prev => {
            const newVal = prev + 1;
            if (newVal >= 3) {
              alert('Maximum tab switches reached. Contest submitted automatically.');
              handleSubmitContest();
            } else {
              alert(`Warning: Tab switch detected. ${3 - newVal} chances left.`);
            }
            return newVal;
          });
        }
      };

      const handleBlur = () => {
        setTabSwitches(prev => {
          const newVal = prev + 1;
          if (newVal >= 3) {
            alert('Maximum screen off/tab switch reached. Contest submitted automatically.');
            handleSubmitContest();
          } else {
            alert(`Warning: Screen off/Tab switch detected. ${3 - newVal} chances left.`);
          }
          return newVal;
        });
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleBlur);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleBlur);
      };
    }
  }, [appState]);

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subject) 
        ? prev.filter(s => s !== subject) 
        : [...prev, subject]
    );
  };

  const handleFetchNotes = async () => {
    setIsLoading(true);
    setAppState('study-notes');
    try {
      const notes = await generateStudyNotes(selectedSubjects);
      setStudyNotes(notes);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchDetailedInfo = async () => {
    setIsLoading(true);
    setAppState('detailed-info');
    try {
      const info = await generateDetailedInfo(selectedSubjects);
      setDetailedInfo(info);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchExternalResources = async () => {
    setIsLoading(true);
    setAppState('external-resources');
    try {
      const resources = await getExternalResources(selectedSubjects);
      setExternalResources(resources);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTest = async () => {
    if (!isOnline) {
      alert("You are currently offline. Please check your connection to start the assessment.");
      return;
    }
    setIsLoading(true);
    try {
      const q = await generateQuestions(selectedSubjects, difficulty);
      setQuestions(q);
      setAppState('testing');
      setCurrentQuestionIndex(0);
      setAnswers({});
      setTimeLeft(120);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    setAnswers(prev => ({ ...prev, [questions[currentQuestionIndex].id]: answer }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setTimeLeft(120);
    } else {
      handleSubmitTest();
    }
  };

  const handleSubmitTest = async () => {
    setIsLoading(true);
    setAppState('results');
    
    const score = questions.reduce((acc, q) => {
      return acc + (answers[q.id] === q.correctAnswer ? 1 : 0);
    }, 0);

    const percentage = Math.round((score / questions.length) * 100);

    const initialResults: AssessmentResult = {
      score,
      total: questions.length,
      feedback: questions.map(q => ({
        questionId: q.id,
        isCorrect: answers[q.id] === q.correctAnswer,
        selectedAnswer: answers[q.id],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation
      })),
      weakAreas: [],
      recommendations: []
    };

    try {
      const analyzed = await analyzeGaps(initialResults);
      setResults(analyzed);
      
      // Update User Stats
      if (user) {
        const updatedStats: UserStats = { ...user };
        const oldTotal = user.totalTests;
        const newTotal = oldTotal + 1;
        
        updatedStats.totalTests = newTotal;
        updatedStats.highestScore = Math.max(user.highestScore, percentage);
        updatedStats.lastScores = [percentage, ...user.lastScores].slice(0, 5);
        updatedStats.averageScore = Math.round(
          (user.averageScore * oldTotal + percentage) / newTotal
        );
        
        if (difficulty === Difficulty.BEGINNER) updatedStats.beginnerAttempts += 1;
        if (difficulty === Difficulty.ADVANCED) updatedStats.advancedAttempts += 1;
        if (difficulty === Difficulty.EXPERT) updatedStats.expertAttempts += 1;

        updatedStats.weakAreas = Array.from(new Set([...user.weakAreas, ...analyzed.weakAreas])).slice(0, 10);

        // Save Attempt
        const newAttempt: TestAttempt = {
          date: new Date().toLocaleString(),
          subjects: selectedSubjects,
          level: difficulty,
          score: percentage,
          totalQuestions: questions.length,
          weakAreas: analyzed.weakAreas,
          attemptNumber: updatedStats.totalTests
        };
        updatedStats.attempts = [newAttempt, ...(user.attempts || [])];

        // Progression Logic
        if (percentage === 100) {
          if (difficulty === Difficulty.BEGINNER && !user.badges.includes('Beginner Champion')) {
            updatedStats.badges.push('Beginner Champion');
            updatedStats.level = Difficulty.ADVANCED;
          } else if (difficulty === Difficulty.ADVANCED && !user.badges.includes('Advanced Master')) {
            updatedStats.badges.push('Advanced Master');
            updatedStats.level = Difficulty.EXPERT;
          } else if (difficulty === Difficulty.EXPERT && !user.badges.includes('Expert Legend')) {
            updatedStats.badges.push('Expert Legend');
            updatedStats.placementReady = true;
          }
        }

        setUser(updatedStats);
        
        // Update in multi-user storage
        const savedUsers = localStorage.getItem('coach_users');
        if (savedUsers) {
          const users = JSON.parse(savedUsers);
          users[user.email] = updatedStats;
          localStorage.setItem('coach_users', JSON.stringify(users));
        }
      }
    } catch (error) {
      setResults(initialResults);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateContest = async (title: string, startTime: string, duration: number) => {
    setIsLoading(true);
    try {
      const problems = await generateCodingProblems(selectedSubjects, difficulty);
      const newContest: Contest = {
        id: Math.random().toString(36).substr(2, 9),
        title,
        startTime,
        duration,
        subjects: selectedSubjects,
        problems
      };
      const updatedContests = [...contests, newContest];
      setContests(updatedContests);
      localStorage.setItem('coach_contests', JSON.stringify(updatedContests));
      setAppState('admin-dashboard');
      alert('Contest scheduled successfully!');
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinContest = (contest: Contest) => {
    const now = new Date();
    const start = new Date(contest.startTime);
    const diff = (now.getTime() - start.getTime()) / 1000 / 60;

    if (diff < 0) {
      alert(`Contest hasn't started yet. Starts at ${contest.startTime}`);
      return;
    }
    if (diff > contest.duration) {
      alert('Contest has already ended.');
      return;
    }

    setActiveContest(contest);
    setContestProblems(contest.problems);
    setContestTimeLeft(Math.round((contest.duration - diff) * 60));
    setAppState('contest-active');
    setTabSwitches(0);
    setCurrentProblemIndex(0);
  };

  const handleSubmitContest = () => {
    setAppState('dashboard');
    alert('Contest submitted successfully! Your results will be analyzed.');
    // In a real app, we would evaluate the code against test cases here
  };

  const handleRunCode = async (code: string, lang: string) => {
    if (!isOnline) {
      setCodeOutput({ output: "", error: "Offline: Internet connection required for AI code analysis." });
      return;
    }
    setIsRunningCode(true);
    setCodeOutput(null);
    try {
      const result = await runCode(code, lang);
      setCodeOutput(result);
    } catch (error) {
      setCodeOutput({ output: "", error: "Execution failed" });
    } finally {
      setIsRunningCode(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <BrainCircuit className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">AI Engineering Coach</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Placement Ready</p>
          </div>
        </div>
        {name && (
          <div className="flex items-center gap-4">
            {!isOnline ? (
              <button 
                onClick={checkConnection}
                className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold animate-pulse hover:bg-red-100 transition-colors"
              >
                <CloudOff className="w-3 h-3" />
                Offline - Click to Retry
              </button>
            ) : showOnlineStatus ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold animate-bounce">
                <Wifi className="w-3 h-3" />
                Back Online
              </div>
            ) : null}
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 rounded-full">
              <User className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">{name}</span>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* Auth Screen */}
          {appState === 'auth' && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto w-full space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="inline-block bg-indigo-600 p-4 rounded-3xl shadow-xl shadow-indigo-200 mb-4">
                  <BrainCircuit className="text-white w-12 h-12" />
                </div>
                <h2 className="text-3xl font-serif font-bold text-slate-900">
                  {authMode === 'login' ? 'Welcome Back' : 'Join the Coach'}
                </h2>
                <p className="text-slate-500">
                  {authMode === 'login' 
                    ? 'Login to track your placement readiness.' 
                    : 'Register to start your engineering assessment journey.'}
                </p>
              </div>

              <form onSubmit={handleAuth} className="glass-panel p-8 rounded-3xl space-y-6">
                {authMode === 'register' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-widest ml-1">Full Name</label>
                      <input 
                        type="text" 
                        placeholder="John Doe"
                        className="input-field"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-widest ml-1">Role</label>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setRole('STUDENT')}
                          className={`flex-1 py-2 rounded-xl border-2 transition-all font-bold ${role === 'STUDENT' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500'}`}
                        >
                          Student
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole('ADMIN')}
                          className={`flex-1 py-2 rounded-xl border-2 transition-all font-bold ${role === 'ADMIN' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500'}`}
                        >
                          Admin
                        </button>
                      </div>
                    </div>
                    {role === 'ADMIN' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-widest ml-1">Admin Access Code</label>
                        <input 
                          type="password" 
                          placeholder="Enter secret code"
                          className="input-field"
                          value={adminCode}
                          onChange={(e) => setAdminCode(e.target.value)}
                          required
                        />
                      </div>
                    )}
                  </>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest ml-1">Email ID</label>
                  <input 
                    type="email" 
                    placeholder="john@example.com"
                    className="input-field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest ml-1">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••"
                      className="input-field pr-12"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full py-4 shadow-lg shadow-indigo-200">
                  {authMode === 'login' ? 'Login' : 'Register'}
                </button>
              </form>

              <div className="text-center">
                <button 
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-sm font-semibold text-indigo-600 hover:underline"
                >
                  {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
                </button>
              </div>
            </motion.div>
          )}

          {/* Admin Create Contest */}
          {appState === 'admin-create-contest' && (
            <motion.div
              key="admin-create-contest"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto w-full space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-slate-900">Schedule a Coding Contest</h2>
                <p className="text-slate-500">Create a 120-minute challenge for students.</p>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleCreateContest(
                    formData.get('title') as string,
                    formData.get('startTime') as string,
                    parseInt(formData.get('duration') as string)
                  );
                }}
                className="glass-panel p-8 rounded-3xl space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest ml-1">Contest Title</label>
                  <input name="title" type="text" placeholder="Weekly Coding Challenge #1" className="input-field" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-widest ml-1">Start Time</label>
                    <input name="startTime" type="datetime-local" className="input-field" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-widest ml-1">Duration (Minutes)</label>
                    <input name="duration" type="number" defaultValue="120" className="input-field" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest ml-1">Select Subjects</label>
                  <div className="grid grid-cols-3 gap-2">
                    {SUBJECTS.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSubject(s)}
                        className={`p-2 rounded-xl border text-xs font-bold transition-all ${selectedSubjects.includes(s) ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setAppState('admin-dashboard')} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={isLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Schedule Contest'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Practice IDE */}
          {appState === 'practice-ide' && (
            <motion.div
              key="practice-ide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-[80vh] flex flex-col gap-4"
            >
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                  <button onClick={() => setAppState(user?.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard')} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
                    <Home className="w-5 h-5 text-slate-600" />
                  </button>
                  <h2 className="text-xl font-bold text-slate-900">Code Practice IDE</h2>
                </div>
                <div className="flex items-center gap-3">
                  <select 
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="bg-slate-100 border-none rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none"
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                  </select>
                  <button 
                    onClick={() => handleRunCode(practiceCode, selectedLanguage)}
                    disabled={isRunningCode}
                    className="btn-primary px-6 py-2 text-sm flex items-center gap-2"
                  >
                    {isRunningCode ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Run Code'}
                  </button>
                </div>
              </div>

              <div className="flex-1 flex gap-4 overflow-hidden">
                <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
                  <Editor
                    height="100%"
                    language={selectedLanguage}
                    value={practiceCode}
                    theme="vs-light"
                    onChange={(val) => setPracticeCode(val || '')}
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                </div>
                
                <div className="w-1/3 bg-slate-900 rounded-2xl p-6 font-mono text-sm overflow-y-auto">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                    <span className="text-slate-400 uppercase text-xs font-bold tracking-widest">Output</span>
                    <button onClick={() => setCodeOutput(null)} className="text-slate-500 hover:text-white transition-all">Clear</button>
                  </div>
                  {codeOutput ? (
                    <div className="space-y-4">
                      {codeOutput.error && (
                        <div className="text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                          {codeOutput.error}
                        </div>
                      )}
                      <pre className="text-green-400 whitespace-pre-wrap">{codeOutput.output}</pre>
                    </div>
                  ) : (
                    <p className="text-slate-600 italic">Run code to see output...</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Contest Active View */}
          {appState === 'contest-active' && activeContest && (
            <motion.div
              key="contest-active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-[90vh] flex flex-col gap-4"
            >
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="bg-red-600 p-2 rounded-lg">
                    <Trophy className="text-white w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{activeContest.title}</h2>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-bold uppercase tracking-widest">
                      <span>Problem {currentProblemIndex + 1} of {contestProblems.length}</span>
                      <span>•</span>
                      <span className="text-red-500">Tab Switches: {tabSwitches}/3</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full font-mono font-bold text-slate-700">
                    <Clock className="w-4 h-4" />
                    {Math.floor(contestTimeLeft / 60)}:{(contestTimeLeft % 60).toString().padStart(2, '0')}
                  </div>
                  <button onClick={handleSubmitContest} className="btn-primary px-6 py-2 text-sm bg-green-600 hover:bg-green-700">Submit Contest</button>
                </div>
              </div>

              <div className="flex-1 flex gap-4 overflow-hidden">
                <div className="w-1/3 bg-white rounded-2xl shadow-sm p-6 overflow-y-auto border border-slate-100 space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-slate-900">{contestProblems[currentProblemIndex]?.title}</h3>
                    <div className="flex gap-2">
                      {activeContest.subjects.map(s => (
                        <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold uppercase">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="prose prose-slate prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-slate-600 leading-relaxed">
                      {contestProblems[currentProblemIndex]?.description}
                    </p>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Constraints</h4>
                      <p className="text-sm text-slate-600 font-mono bg-slate-50 p-3 rounded-xl">{contestProblems[currentProblemIndex]?.constraints}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Sample Input</h4>
                      <pre className="text-sm text-slate-600 font-mono bg-slate-50 p-3 rounded-xl">{contestProblems[currentProblemIndex]?.sampleInput}</pre>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Sample Output</h4>
                      <pre className="text-sm text-slate-600 font-mono bg-slate-50 p-3 rounded-xl">{contestProblems[currentProblemIndex]?.sampleOutput}</pre>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 flex flex-col">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center justify-between">
                      <select 
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold text-slate-700 outline-none"
                      >
                        <option value="python">Python</option>
                        <option value="javascript">JavaScript</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                      </select>
                      <button 
                        onClick={() => handleRunCode(codingSubmissions[contestProblems[currentProblemIndex]?.id] || contestProblems[currentProblemIndex]?.initialCode[selectedLanguage] || '', selectedLanguage)}
                        disabled={isRunningCode}
                        className="px-4 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg uppercase flex items-center gap-2"
                      >
                        {isRunningCode ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Run Code'}
                      </button>
                    </div>
                    <div className="flex-1">
                      <Editor
                        height="100%"
                        language={selectedLanguage}
                        value={codingSubmissions[contestProblems[currentProblemIndex]?.id] || contestProblems[currentProblemIndex]?.initialCode[selectedLanguage] || ''}
                        theme="vs-light"
                        onChange={(val) => setCodingSubmissions(prev => ({ ...prev, [contestProblems[currentProblemIndex].id]: val || '' }))}
                        options={{
                          fontSize: 14,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>
                    {codeOutput && (
                      <div className="h-1/3 bg-slate-900 p-4 font-mono text-xs overflow-y-auto border-t border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-400 uppercase font-bold tracking-widest">Output</span>
                          <button onClick={() => setCodeOutput(null)} className="text-slate-500 hover:text-white">Clear</button>
                        </div>
                        {codeOutput.error && <div className="text-red-400 mb-2">{codeOutput.error}</div>}
                        <pre className="text-green-400 whitespace-pre-wrap">{codeOutput.output}</pre>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
                    <button 
                      disabled={currentProblemIndex === 0}
                      onClick={() => setCurrentProblemIndex(prev => prev - 1)}
                      className="btn-secondary px-6 py-2 text-sm disabled:opacity-50"
                    >
                      Previous Problem
                    </button>
                    <div className="flex gap-2">
                      {contestProblems.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i === currentProblemIndex ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <button 
                      disabled={currentProblemIndex === contestProblems.length - 1}
                      onClick={() => setCurrentProblemIndex(prev => prev + 1)}
                      className="btn-primary px-6 py-2 text-sm disabled:opacity-50"
                    >
                      Next Problem
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {appState === 'admin-dashboard' && user && (
            <motion.div
              key="admin-dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-3 rounded-2xl">
                    <User className="text-white w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-3xl font-serif font-bold text-slate-900">Admin Panel</h2>
                    <p className="text-slate-500">{user.name} ({user.email})</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleLogout} className="btn-secondary px-6 py-2">Logout</button>
                  <button onClick={() => setAppState('admin-create-contest')} className="btn-primary px-6 py-2">Create Contest</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(() => {
                  const allUsers = Object.values(JSON.parse(localStorage.getItem('coach_users') || '{}')) as any[];
                  const students = allUsers.filter(u => !u.role || u.role === 'STUDENT');
                  const totalTests = students.reduce((acc, u) => acc + (u.totalTests || 0), 0);
                  const placementReady = students.filter(u => u.placementReady).length;
                  const avgScore = Math.round(students.reduce((acc, u) => acc + (u.averageScore || 0), 0) / (students.length || 1));

                  return [
                    { label: 'Total Students', value: students.length, icon: User, color: 'text-blue-600' },
                    { label: 'Tests Attempted', value: totalTests, icon: BarChart3, color: 'text-indigo-600' },
                    { label: 'Placement Ready', value: placementReady, icon: Trophy, color: 'text-amber-600' },
                    { label: 'Avg. Platform Score', value: `${avgScore}%`, icon: CheckCircle2, color: 'text-green-600' },
                  ].map((stat, i) => (
                    <div key={i} className="glass-panel p-6 rounded-3xl space-y-2">
                      <div className="flex items-center justify-between">
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                    </div>
                  ));
                })()}
              </div>

              <div className="glass-panel p-8 rounded-3xl space-y-6">
                <h3 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">Scheduled Contests</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contests.length > 0 ? contests.map(contest => (
                    <div key={contest.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800">{contest.title}</div>
                        <div className="text-xs text-slate-400 font-bold uppercase">{new Date(contest.startTime).toLocaleString()}</div>
                        <div className="flex gap-1 mt-1">
                          {contest.subjects.map(s => (
                            <span key={s} className="text-[8px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase">{s}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-500">{contest.duration} min</div>
                        <div className="text-[10px] text-slate-400">{contest.problems.length} Problems</div>
                      </div>
                    </div>
                  )) : <p className="text-sm text-slate-400 italic">No contests scheduled yet.</p>}
                </div>
              </div>

              <div className="glass-panel p-8 rounded-3xl space-y-6">
                <h3 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">Student Management</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                        <th className="pb-4">Student Name</th>
                        <th className="pb-4">Email</th>
                        <th className="pb-4">Level</th>
                        <th className="pb-4">Tests</th>
                        <th className="pb-4">Avg Score</th>
                        <th className="pb-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {Object.values(JSON.parse(localStorage.getItem('coach_users') || '{}'))
                        .filter((u: any) => !u.role || u.role === 'STUDENT')
                        .map((student: any, i) => (
                        <tr key={i} className="text-sm">
                          <td className="py-4 font-bold text-slate-800">{student.name}</td>
                          <td className="py-4 text-slate-500">{student.email}</td>
                          <td className="py-4">
                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold uppercase">
                              {student.level}
                            </span>
                          </td>
                          <td className="py-4 text-slate-600">{student.totalTests}</td>
                          <td className="py-4 font-mono text-slate-600">{student.averageScore}%</td>
                          <td className="py-4">
                            {student.placementReady ? (
                              <span className="text-green-600 font-bold flex items-center gap-1">
                                <Trophy className="w-4 h-4" /> Ready
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Learning</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
          {appState === 'dashboard' && user && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-3xl font-serif font-bold text-slate-900">Hello, {user.name} 👋</h2>
                  <p className="text-slate-500">{user.email}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleLogout} className="btn-secondary px-4 py-2 text-sm">Logout</button>
                  <button onClick={() => setAppState('practice-ide')} className="btn-secondary px-4 py-2 text-sm border-indigo-200 text-indigo-700">Practice IDE</button>
                  <button onClick={() => setAppState('subject-selection')} className="btn-primary px-6 py-2 text-sm shadow-lg shadow-indigo-100">Start Test</button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setAppState('review')} 
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  <Clock className="w-4 h-4" /> View Detailed History
                </button>
                <button 
                  onClick={() => setAppState('subject-selection')} 
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  <BookOpen className="w-4 h-4" /> View Learning Material
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Ongoing Contests</h3>
                    <Clock className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="space-y-3">
                    {contests.length > 0 ? contests.map(contest => (
                      <div key={contest.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-slate-800">{contest.title}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">{new Date(contest.startTime).toLocaleString()}</div>
                        </div>
                        <button 
                          onClick={() => handleJoinContest(contest)}
                          className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg uppercase"
                        >
                          Join
                        </button>
                      </div>
                    )) : <p className="text-xs text-slate-400 italic">No contests scheduled</p>}
                  </div>
                </div>

                <div className="glass-panel p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Current Level</h3>
                    <Award className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{user.level}</div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-1000" 
                      style={{ width: user.level === Difficulty.BEGINNER ? '33%' : user.level === Difficulty.ADVANCED ? '66%' : '100%' }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    {user.level === Difficulty.BEGINNER ? 'Unlock Advanced at 100% score' : user.level === Difficulty.ADVANCED ? 'Unlock Expert at 100% score' : 'Expert Level Mastered'}
                  </p>
                </div>

                <div className="glass-panel p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Placement Status</h3>
                    <CheckCircle2 className={`w-5 h-5 ${user.placementReady ? 'text-green-500' : 'text-slate-300'}`} />
                  </div>
                  <div className={`text-2xl font-bold ${user.placementReady ? 'text-green-600' : 'text-slate-900'}`}>
                    {user.placementReady ? 'Placement Ready' : 'In Progress'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {user.placementReady ? 'Mastery Certificate Unlocked' : 'Complete Expert level to be ready'}
                  </div>
                </div>

                <div className="glass-panel p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Badges Earned</h3>
                    <Trophy className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {user.badges.length > 0 ? user.badges.map(badge => (
                      <span key={badge} className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-[10px] font-bold uppercase tracking-tighter">
                        {badge}
                      </span>
                    )) : <span className="text-slate-400 text-sm italic">No badges yet</span>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-8 rounded-3xl space-y-6">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Performance Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <div className="text-xs text-slate-400 uppercase font-bold tracking-widest">Total Tests</div>
                      <div className="text-2xl font-bold text-slate-900">{user.totalTests}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <div className="text-xs text-slate-400 uppercase font-bold tracking-widest">Highest Score</div>
                      <div className="text-2xl font-bold text-slate-900">{user.highestScore}%</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <div className="text-xs text-slate-400 uppercase font-bold tracking-widest">Avg. Score</div>
                      <div className="text-2xl font-bold text-slate-900">{user.averageScore}%</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <div className="text-xs text-slate-400 uppercase font-bold tracking-widest">Last 5 Scores</div>
                      <div className="flex gap-1 mt-1">
                        {user.lastScores.map((s, i) => (
                          <div key={i} className="w-4 bg-indigo-200 rounded-t" style={{ height: `${s/2}px` }} title={`${s}%`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-8 rounded-3xl space-y-6">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    Weak Areas Identified
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {user.weakAreas.length > 0 ? user.weakAreas.map(area => (
                      <span key={area} className="px-3 py-1 bg-red-50 text-red-700 border border-red-100 rounded-full text-xs font-bold">
                        {area}
                      </span>
                    )) : <p className="text-slate-400 text-sm italic">No data yet. Take a test to find gaps.</p>}
                  </div>
                  {user.placementReady && (
                    <button 
                      onClick={() => setAppState('certificate')}
                      className="w-full btn-primary bg-green-600 hover:bg-green-700 shadow-green-100"
                    >
                      View Mastery Certificate
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Certificate View */}
          {appState === 'certificate' && user && (
            <motion.div
              key="certificate"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-3xl mx-auto w-full space-y-8"
            >
              <div className="bg-white border-[12px] border-double border-indigo-600 p-12 rounded-lg shadow-2xl text-center space-y-8 relative">
                <div className="absolute top-4 right-4 opacity-10">
                  <BrainCircuit className="w-32 h-32 text-indigo-600" />
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-4xl font-serif font-bold text-slate-900 uppercase tracking-widest">Certificate of Mastery</h1>
                  <p className="text-indigo-600 font-bold tracking-widest uppercase text-sm">AI Engineering Assessment & Learning Coach</p>
                </div>

                <div className="py-8 space-y-4">
                  <p className="text-slate-500 italic">This is to certify that</p>
                  <h2 className="text-5xl font-serif font-bold text-slate-900 border-b-2 border-slate-200 inline-block px-8 pb-2">{user.name}</h2>
                  <p className="text-slate-500 max-w-md mx-auto">
                    has successfully completed all levels of the AI Engineering Assessment, demonstrating 
                    exceptional proficiency in Computer Science fundamentals and placement readiness.
                  </p>
                </div>

                <div className="flex justify-between items-end pt-8">
                  <div className="text-left space-y-1">
                    <div className="font-serif font-bold text-slate-900">AI Coach</div>
                    <div className="text-xs text-slate-400 uppercase tracking-widest">Verification System</div>
                  </div>
                  <div className="bg-indigo-600 p-4 rounded-full">
                    <Award className="text-white w-12 h-12" />
                  </div>
                  <div className="text-right space-y-1">
                    <div className="font-serif font-bold text-slate-900">{new Date().toLocaleDateString()}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-widest">Date Issued</div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button onClick={() => setAppState('dashboard')} className="btn-secondary">Back to Dashboard</button>
                <button onClick={() => window.print()} className="btn-primary">Download PDF</button>
              </div>
            </motion.div>
          )}

          {/* Subject Selection */}
          {appState === 'subject-selection' && (
            <motion.div
              key="subjects"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-slate-900">Select Your Subjects</h2>
                <p className="text-slate-500">Choose the topics you want to be tested on today.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {SUBJECTS.map(subject => (
                  <button
                    key={subject}
                    onClick={() => toggleSubject(subject)}
                    className={`p-4 rounded-2xl border-2 transition-all text-center font-semibold ${
                      selectedSubjects.includes(subject)
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    {subject}
                  </button>
                ))}
              </div>

              <div className="flex flex-col md:flex-row flex-wrap gap-4 justify-center pt-4">
                <button
                  onClick={() => setAppState(user?.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard')}
                  className="btn-secondary min-w-[200px] flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go back to Dashboard
                </button>
                <button
                  onClick={() => setAppState('test-intro')}
                  disabled={selectedSubjects.length === 0}
                  className="btn-secondary min-w-[200px] flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Directly Take Test
                </button>
                <button
                  onClick={handleFetchNotes}
                  disabled={selectedSubjects.length === 0}
                  className="btn-primary min-w-[200px] flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  Generate AI Study Notes
                </button>
                <button
                  onClick={handleFetchDetailedInfo}
                  disabled={selectedSubjects.length === 0}
                  className="btn-secondary min-w-[200px] border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center justify-center gap-2"
                >
                  <GraduationCap className="w-4 h-4" />
                  Learn More (In-depth)
                </button>
                <button
                  onClick={handleFetchExternalResources}
                  disabled={selectedSubjects.length === 0}
                  className="btn-secondary min-w-[200px] border-emerald-200 text-emerald-700 hover:bg-emerald-50 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Explore External Learning
                </button>
              </div>
            </motion.div>
          )}

          {/* Detailed History View (Reusing review state for history) */}
          {appState === 'review' && user && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-serif font-bold text-slate-900">Attempt History</h2>
                <button onClick={() => setAppState('dashboard')} className="btn-secondary flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </button>
              </div>

              <div className="space-y-4">
                {user.attempts && user.attempts.length > 0 ? user.attempts.map((attempt, idx) => (
                  <div key={idx} className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Attempt #{attempt.attemptNumber}</span>
                        <span className="text-xs text-slate-400">• {attempt.date}</span>
                      </div>
                      <h3 className="font-bold text-slate-800">{attempt.subjects.join(', ')}</h3>
                      <div className="flex gap-2">
                        {attempt.weakAreas.slice(0, 3).map(area => (
                          <span key={area} className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">{area}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-xs text-slate-400 uppercase font-bold tracking-widest">Level</div>
                        <div className="font-bold text-slate-700">{attempt.level}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-400 uppercase font-bold tracking-widest">Score</div>
                        <div className={`text-2xl font-bold ${attempt.score === 100 ? 'text-green-600' : 'text-slate-900'}`}>{attempt.score}%</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-20 glass-panel rounded-3xl">
                    <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500">No test attempts recorded yet.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {appState === 'detailed-info' && (
            <motion.div
              key="detailed-info"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-slate-900">In-depth Subject Knowledge</h2>
                <p className="text-slate-500">Master the core concepts and architectural details.</p>
              </div>

              {isLoading ? (
                <div className="text-center py-20 space-y-4">
                  <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
                  <h2 className="text-2xl font-bold text-slate-900">Generating Deep Insights...</h2>
                  <p className="text-slate-500">Our AI is preparing comprehensive explanations for you.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-8">
                    {detailedInfo.map((info, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="glass-panel p-8 rounded-3xl space-y-6"
                      >
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                          <div className="bg-indigo-600 p-2 rounded-xl">
                            <GraduationCap className="text-white w-6 h-6" />
                          </div>
                          <h3 className="text-2xl font-serif font-bold text-slate-900">{info.subject}</h3>
                        </div>
                        
                        <div className="space-y-4">
                          <p className="text-slate-700 leading-relaxed text-lg">{info.explanation}</p>
                          
                          <div className="grid grid-cols-1 gap-4 mt-6">
                            {info.subTopics.map((sub, sIdx) => (
                              <div key={sIdx} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-2">
                                <h4 className="font-bold text-indigo-700 flex items-center gap-2">
                                  <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                                  {sub.title}
                                </h4>
                                <p className="text-slate-600 text-sm leading-relaxed">{sub.detail}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
                    <button 
                      onClick={() => setAppState(user?.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard')}
                      className="btn-secondary flex items-center justify-center gap-2"
                    >
                      <Home className="w-4 h-4" /> Dashboard
                    </button>
                    <button 
                      onClick={() => setAppState('subject-selection')}
                      className="btn-secondary"
                    >
                      Back to Subjects
                    </button>
                    <button 
                      onClick={() => setAppState('test-intro')}
                      className="btn-primary flex items-center justify-center gap-2"
                    >
                      Ready for Assessment? Start Test 🚀
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* External Resources View */}
          {appState === 'external-resources' && (
            <motion.div
              key="external-resources"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-slate-900">Top-Tier External Resources</h2>
                <p className="text-slate-500">Hand-picked learning materials from the best platforms.</p>
              </div>

              {isLoading ? (
                <div className="text-center py-20 space-y-4">
                  <RefreshCw className="w-12 h-12 text-emerald-600 animate-spin mx-auto" />
                  <h2 className="text-2xl font-bold text-slate-900">Curating Resources...</h2>
                  <p className="text-slate-500">Finding the best videos and articles for your selection.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {externalResources.map((platform, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="glass-panel p-6 rounded-3xl space-y-4 border-t-4 border-t-emerald-500"
                      >
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <ExternalLink className="w-5 h-5 text-emerald-600" />
                          {platform.platform}
                        </h3>
                        <div className="space-y-3">
                          {platform.resources.map((res, rIdx) => (
                            <a 
                              key={rIdx}
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-xl transition-all group"
                            >
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-700">{res.name}</div>
                                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 group-hover:text-emerald-500">{res.type}</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                              </div>
                            </a>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 justify-center pt-8">
                    <button 
                      onClick={() => setAppState(user?.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard')}
                      className="btn-secondary flex items-center justify-center gap-2"
                    >
                      <Home className="w-4 h-4" /> Dashboard
                    </button>
                    <button 
                      onClick={() => setAppState('subject-selection')}
                      className="btn-secondary"
                    >
                      Back to Subjects
                    </button>
                    <button 
                      onClick={() => setAppState('test-intro')}
                      className="btn-primary"
                    >
                      Take the Test Now 🚀
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
          {appState === 'study-notes' && (
            <motion.div
              key="study-notes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-slate-900">AI Quick Revision Notes</h2>
                <p className="text-slate-500">Review these key concepts before taking the test.</p>
              </div>

              {isLoading ? (
                <div className="text-center py-20 space-y-4">
                  <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
                  <h2 className="text-2xl font-bold text-slate-900">Preparing Your Notes...</h2>
                  <p className="text-slate-500">Our AI is curating the most important topics for you.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-6">
                    {studyNotes.map((note, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="glass-panel p-8 rounded-3xl space-y-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-indigo-100 p-2 rounded-lg">
                            <BookOpen className="text-indigo-600 w-5 h-5" />
                          </div>
                          <h3 className="text-xl font-bold text-slate-900">{note.topic}</h3>
                        </div>
                        <p className="text-slate-600 leading-relaxed">{note.content}</p>
                        <div className="space-y-2">
                          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Key Points:</h4>
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {note.keyPoints.map((point, pIdx) => (
                              <li key={pIdx} className="flex items-start gap-2 text-sm text-slate-600">
                                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
                    <button 
                      onClick={() => setAppState(user?.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard')}
                      className="btn-secondary flex items-center justify-center gap-2"
                    >
                      <Home className="w-4 h-4" /> Dashboard
                    </button>
                    <button 
                      onClick={() => setAppState('subject-selection')}
                      className="btn-secondary"
                    >
                      Back to Subjects
                    </button>
                    <button 
                      onClick={() => setAppState('test-intro')}
                      className="btn-primary flex items-center justify-center gap-2"
                    >
                      I'm Confident, Start Test 🚀
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Test Intro */}
          {appState === 'test-intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-8 rounded-3xl space-y-8"
            >
              <div className="flex items-center gap-4">
                <div className="bg-amber-100 p-3 rounded-2xl">
                  <GraduationCap className="text-amber-600 w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Ready for the {difficulty} Level?</h2>
                  <p className="text-slate-500">We'll check your fundamentals with 10-15 questions.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Test Details</h3>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-slate-600">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span>10-15 Questions</span>
                    </li>
                    <li className="flex items-center gap-3 text-slate-600">
                      <Clock className="w-5 h-5 text-indigo-500" />
                      <span>60s per question</span>
                    </li>
                    <li className="flex items-center gap-3 text-slate-600">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <span>No negative marking</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl space-y-2">
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Selected Subjects</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedSubjects.map(s => (
                      <span key={s} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <button 
                  onClick={() => setAppState(user?.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard')}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" /> Dashboard
                </button>
                <button 
                  onClick={() => setAppState('subject-selection')}
                  className="btn-secondary flex-1"
                >
                  Change Subjects
                </button>
                <button 
                  onClick={handleStartTest}
                  disabled={isLoading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'START TEST'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Testing */}
          {appState === 'testing' && currentQuestion && (
            <motion.div
              key="testing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Question {currentQuestionIndex + 1} of {questions.length}</span>
                  <h3 className="text-sm font-medium text-slate-500">{currentQuestion.subject} • {currentQuestion.type}</h3>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold ${timeLeft < 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
                  <Clock className="w-4 h-4" />
                  {timeLeft}s
                </div>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <motion.div 
                  className="bg-indigo-600 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>

              <div className="glass-panel p-8 rounded-3xl space-y-8">
                <p className="text-xl font-medium leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {currentQuestion.text}
                </p>

                <div className="grid grid-cols-1 gap-4">
                  {(Object.entries(currentQuestion.options) as [string, string][]).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => handleAnswerSelect(key)}
                      className={`p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 group ${
                        answers[currentQuestion.id] === key
                          ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/10'
                          : 'border-slate-100 hover:border-slate-200 bg-white'
                      }`}
                    >
                      <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-colors ${
                        answers[currentQuestion.id] === key
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                      }`}>
                        {key}
                      </span>
                      <span className="font-medium text-slate-700">{value}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleNextQuestion}
                  disabled={!answers[currentQuestion.id]}
                  className="btn-primary min-w-[160px] flex items-center justify-center gap-2"
                >
                  {currentQuestionIndex === questions.length - 1 ? 'Finish Test' : 'Next Question'}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Results */}
          {appState === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {isLoading ? (
                <div className="text-center py-20 space-y-4">
                  <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
                  <h2 className="text-2xl font-bold text-slate-900">Evaluating Your Performance...</h2>
                  <p className="text-slate-500">Our AI coach is identifying your knowledge gaps.</p>
                </div>
              ) : results && (
                <>
                  <div className="glass-panel p-10 rounded-3xl text-center space-y-6 relative overflow-hidden">
                    {results.score === results.total && (
                      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
                    )}
                    
                    <div className="space-y-2">
                      <h2 className="text-3xl font-bold text-slate-900">Test Results – {difficulty} Level</h2>
                      <p className="text-slate-500">Great effort, {name}! Let's see how you did.</p>
                    </div>

                    <div className="flex justify-center items-center gap-8 py-4">
                      <div className="text-center">
                        <div className="text-5xl font-bold text-indigo-600">{results.score}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Score</div>
                      </div>
                      <div className="h-12 w-px bg-slate-200" />
                      <div className="text-center">
                        <div className="text-5xl font-bold text-slate-900">{Math.round((results.score / results.total) * 100)}%</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Accuracy</div>
                      </div>
                    </div>

                    {results.score === results.total ? (
                      <div className="bg-green-50 border border-green-100 p-6 rounded-2xl space-y-3">
                        <div className="flex items-center justify-center gap-2 text-green-700 font-bold">
                          <Trophy className="w-6 h-6" />
                          <span>100% Mastery Achieved!</span>
                        </div>
                        <p className="text-green-600 text-sm">
                          {difficulty === Difficulty.EXPERT 
                            ? "You've mastered the Expert level! Your placement readiness certificate is ready." 
                            : `You've unlocked the ${difficulty === Difficulty.BEGINNER ? 'Advanced' : 'Expert'} level.`}
                        </p>
                        <button 
                          onClick={() => {
                            if (difficulty === Difficulty.EXPERT) {
                              setAppState('certificate');
                            } else {
                              if (difficulty === Difficulty.BEGINNER) setDifficulty(Difficulty.ADVANCED);
                              else if (difficulty === Difficulty.ADVANCED) setDifficulty(Difficulty.EXPERT);
                              setAppState('test-intro');
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all"
                        >
                          {difficulty === Difficulty.EXPERT ? 'View Certificate' : `Move to ${difficulty === Difficulty.BEGINNER ? 'Advanced' : 'Expert'} Level`}
                        </button>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl space-y-3">
                        <div className="flex items-center justify-center gap-2 text-amber-700 font-bold">
                          <AlertCircle className="w-6 h-6" />
                          <span>Keep Pushing!</span>
                        </div>
                        <p className="text-amber-600 text-sm">Score 100% to unlock the next level. Review your gaps below.</p>
                        <button 
                          onClick={() => setAppState('test-intro')}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all"
                        >
                          Retake Test
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel p-6 rounded-3xl space-y-4">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="text-indigo-600 w-5 h-5" />
                        <h3 className="font-bold text-slate-800">Knowledge Gaps</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {results.weakAreas.map(area => (
                          <span key={area} className="px-3 py-1 bg-red-50 text-red-700 border border-red-100 rounded-full text-xs font-bold">
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="glass-panel p-6 rounded-3xl space-y-4">
                      <div className="flex items-center gap-3">
                        <BookOpen className="text-indigo-600 w-5 h-5" />
                        <h3 className="font-bold text-slate-800">Recommended Resources</h3>
                      </div>
                      <div className="space-y-3">
                        {results.recommendations.map((rec, i) => (
                          <div key={i} className="space-y-2">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{rec.topic}</p>
                            <div className="flex flex-wrap gap-2">
                              {rec.resources.map((res, j) => (
                                <a 
                                  key={j} 
                                  href={res.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                                >
                                  {res.name}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-900 px-2">Detailed Review</h3>
                    <div className="space-y-4">
                      {results.feedback.map((f, i) => {
                        const q = questions.find(question => question.id === f.questionId);
                        if (!q) return null;
                        return (
                          <div key={i} className={`glass-panel p-6 rounded-2xl border-l-4 ${f.isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-3">
                                <p className="font-medium text-slate-800">{q.text}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  <div className={`p-3 rounded-xl border ${f.selectedAnswer === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                    <span className="font-bold mr-2">Your Answer:</span>
                                    {f.selectedAnswer ? `${f.selectedAnswer}. ${q.options[f.selectedAnswer as keyof typeof q.options]}` : 'No Answer'}
                                  </div>
                                  {!f.isCorrect && (
                                    <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700">
                                      <span className="font-bold mr-2">Correct Answer:</span>
                                      {q.correctAnswer}. {q.options[q.correctAnswer]}
                                    </div>
                                  )}
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 leading-relaxed">
                                  <span className="font-bold text-slate-800 block mb-1">Explanation:</span>
                                  {f.explanation}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-center pb-12 gap-4">
                    <button 
                      onClick={() => setAppState('dashboard')}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <BarChart3 className="w-5 h-5" />
                      Dashboard
                    </button>
                    <button 
                      onClick={() => setAppState('subject-selection')}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      Back to Subjects
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-100 text-center space-y-2">
        <p className="text-sm text-slate-400 font-medium">Built for Indian CS Students • Placement Ready</p>
        <div className="flex justify-center gap-6">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">NPTEL</span>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">freeCodeCamp</span>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Gate Smashers</span>
        </div>
      </footer>
    </div>
  );
}
