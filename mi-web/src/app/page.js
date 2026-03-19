"use client";
import { useState, useRef } from "react";
import { BookOpen, TrendingUp, Upload, Settings, Send, ArrowRight, RefreshCcw, FileText, Plus, Trash2, ChevronRight, CheckCircle, Network, X, Info } from "lucide-react";

// Markdown and Math imports
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; 

// Recharts imports for the Performance Chart
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

// React Flow imports for the Knowledge Graph
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';

export default function Home() {
  const [activeTab, setActiveTab] = useState("tutor"); 
  
  // Parameters State
  const [level, setLevel] = useState(5);
  const [length, setLength] = useState("Medium");
  const [assessmentType, setAssessmentType] = useState("None");
  const [extraGuidelines, setExtraGuidelines] = useState("");
  
  // Syllabus State
  const [syllabusText, setSyllabusText] = useState("");
  const [pdfName, setPdfName] = useState("");
  const fileInputRef = useRef(null);

  // Tutor State
  const [topic, setTopic] = useState("");
  const [chatLog, setChatLog] = useState([]); 
  const [historicalContext, setHistoricalContext] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");

  // Knowledge Graph State
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [showGraph, setShowGraph] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null); 

  // Strict Grading Agent State
  const [evalQuestion, setEvalQuestion] = useState("");
  const [evalAnswer, setEvalAnswer] = useState("");
  const [evalResult, setEvalResult] = useState("");
  const [evalLoading, setEvalLoading] = useState(false);

  // Performance Manager State
  const [subjects, setSubjects] = useState([
    {
      id: 1,
      name: "Mathematics",
      credits: 6,
      assignments: [
        { id: 101, name: "Midterm", score: 7.5, weight: 40 },
        { id: 102, name: "Final Exam", score: 8.0, weight: 60 }
      ]
    },
    {
      id: 2,
      name: "Physics",
      credits: 4,
      assignments: [
        { id: 201, name: "Lab Work", score: 9.0, weight: 30 },
        { id: 202, name: "Final Exam", score: 6.5, weight: 70 }
      ]
    }
  ]);
  
  const [studyPlan, setStudyPlan] = useState("");
  const [planLoading, setPlanLoading] = useState(false);

  // --- NEW: API BASE URL FOR PRODUCTION ---
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // --- API Handlers ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfName(file.name);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload-pdf`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setSyllabusText(data.text);
        alert("PDF processed successfully. The AI now has access to your syllabus.");
      } else {
        alert("Error processing PDF.");
      }
    } catch (error) {
      alert("Failed to connect to the server.");
    }
  };

  const callTutorAPI = async (actionType, specificQuery = "") => {
    setLoading(true);
    
    if (actionType === "ask_question" || actionType === "targeted_feedback") {
      setChatLog(prev => [...prev, { role: "user", content: specificQuery }]);
    } else if (actionType === "advance_good") {
      setChatLog(prev => [...prev, { role: "user", content: "Action: Advance to next concept." }]);
    } else if (actionType === "advance_bad") {
      setChatLog(prev => [...prev, { role: "user", content: "Action: I didn't understand. Explain differently." }]);
    } else if (actionType === "summarize") {
      setChatLog(prev => [...prev, { role: "user", content: "Action: Summarize what we have seen so far." }]);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic,
          level: parseInt(level),
          extra: extraGuidelines,
          length: length,
          action: actionType,
          assessment_type: assessmentType,
          historical_context: historicalContext,
          notes_text: syllabusText,
          user_query: specificQuery
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        setChatLog(prev => [...prev, { role: "tutor", content: data.response }]);
        if (actionType !== "summarize" && actionType !== "ask_question") {
          setHistoricalContext(prev => prev + "\n" + data.response);
        }
      } else {
        setChatLog(prev => [...prev, { role: "error", content: "Error: " + data.detail }]);
      }
    } catch (error) {
      setChatLog(prev => [...prev, { role: "error", content: "Failed to connect to Python backend." }]);
    }
    
    setLoading(false);
    setUserQuery(""); 
  };

  const startSession = () => {
    if (!topic.trim()) return;
    setChatLog([]);
    setHistoricalContext("");
    setShowGraph(false);
    setSelectedNode(null);
    callTutorAPI("new");
  };

  const generateGraph = async () => {
    if (!historicalContext) return;
    setShowGraph(true);
    setGraphLoading(true);
    setSelectedNode(null); 

    try {
      const res = await fetch(`${API_BASE_URL}/api/graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic,
          historical_context: historicalContext
        }),
      });
      const data = await res.json();
      
      if (res.ok && data.graph) {
        const formattedNodes = data.graph.nodes.map((node, i) => ({
          id: String(node.id),
          position: { x: (i % 3) * 250, y: Math.floor(i / 3) * 150 },
          data: { label: node.label, description: node.description || "No definition provided." },
          style: { background: '#1e293b', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 'bold', fontSize: '12px', textAlign: 'center', width: 180, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', cursor: 'pointer' }
        }));
        
        const formattedEdges = data.graph.edges.map((edge, i) => ({
          id: `e${edge.source}-${edge.target}-${i}`,
          source: String(edge.source),
          target: String(edge.target),
          label: edge.label,
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          labelStyle: { fill: '#64748b', fontWeight: 600, fontSize: 11 }
        }));

        setNodes(formattedNodes);
        setEdges(formattedEdges);
      }
    } catch (error) {
      console.error("Graph error:", error);
    }
    setGraphLoading(false);
  };

  const submitForGrading = async () => {
    setEvalLoading(true);
    setEvalResult("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: evalQuestion,
          student_answer: evalAnswer,
          syllabus_text: syllabusText
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEvalResult(data.evaluation);
      } else {
        setEvalResult("Error: " + data.detail);
      }
    } catch (error) {
      setEvalResult("Failed to connect to Python backend.");
    }
    setEvalLoading(false);
  };

  const getSubjectScore = (subject) => {
    const totalWeight = subject.assignments.reduce((sum, a) => sum + Number(a.weight || 0), 0);
    if (totalWeight === 0) return 0;
    const totalPoints = subject.assignments.reduce((sum, a) => sum + (Number(a.score || 0) * Number(a.weight || 0)), 0);
    return totalPoints / totalWeight; 
  };

  const calculateGlobalGPA = () => {
    const totalCredits = subjects.reduce((sum, s) => sum + Number(s.credits || 0), 0);
    if (totalCredits === 0) return "0.00";
    const totalPoints = subjects.reduce((sum, s) => sum + (getSubjectScore(s) * Number(s.credits || 0)), 0);
    return (totalPoints / totalCredits).toFixed(2);
  };

  const getChartData = () => {
    return subjects.map(s => ({
      subject: s.name,
      score: Number(getSubjectScore(s).toFixed(2))
    }));
  };

  const updateSubject = (subIndex, field, value) => {
    const newSubjects = [...subjects];
    newSubjects[subIndex] = { ...newSubjects[subIndex], [field]: value };
    setSubjects(newSubjects);
  };

  const updateAssignment = (subIndex, assignIndex, field, value) => {
    const newSubjects = [...subjects];
    const newAssignments = [...newSubjects[subIndex].assignments];
    newAssignments[assignIndex] = { ...newAssignments[assignIndex], [field]: value };
    newSubjects[subIndex] = { ...newSubjects[subIndex], assignments: newAssignments };
    setSubjects(newSubjects);
  };

  const addSubject = () => {
    setSubjects([...subjects, { id: Date.now(), name: `Subject ${subjects.length + 1}`, credits: 6, assignments: [] }]);
  };

  const removeSubject = (subIndex) => {
    setSubjects(subjects.filter((_, i) => i !== subIndex));
  };

  const addAssignment = (subIndex) => {
    const newSubjects = [...subjects];
    newSubjects[subIndex].assignments.push({ id: Date.now(), name: "New Assignment", score: 0, weight: 10 });
    setSubjects(newSubjects);
  };

  const removeAssignment = (subIndex, assignIndex) => {
    const newSubjects = [...subjects];
    newSubjects[subIndex].assignments = newSubjects[subIndex].assignments.filter((_, i) => i !== assignIndex);
    setSubjects(newSubjects);
  };

  const generatePlan = async () => {
    setPlanLoading(true);
    setStudyPlan("");
    
    const performanceDataStr = subjects.map(s => {
      const subjScore = getSubjectScore(s).toFixed(2);
      const assigns = s.assignments.map(a => `  - ${a.name}: ${a.score}/10 (Weight: ${a.weight}%)`).join("\n");
      return `${s.name}: ${subjScore}/10 (Credits: ${s.credits})\n${assigns}`;
    }).join("\n\n");

    try {
      const res = await fetch(`${API_BASE_URL}/api/study-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performance_data: performanceDataStr,
          syllabus_text: syllabusText
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStudyPlan(data.response);
      } else {
        setStudyPlan("Error: " + data.detail);
      }
    } catch (error) {
      setStudyPlan("Failed to connect to Python backend.");
    }
    setPlanLoading(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Settings size={20} /> Parameters
          </h1>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Academic Rigor: {level}</label>
            <input type="range" min="1" max="10" value={level} onChange={(e) => setLevel(e.target.value)} className="w-full" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Response Length</label>
            <select value={length} onChange={(e) => setLength(e.target.value)} className="w-full border rounded p-2 text-sm bg-white">
              <option value="Short">Short</option>
              <option value="Medium">Medium</option>
              <option value="Long">Long</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Assessment Type</label>
            <select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)} className="w-full border rounded p-2 text-sm bg-white">
              <option value="None">None</option>
              <option value="Multiple Choice Test">Multiple Choice Test</option>
              <option value="Practical Exercises">Practical Exercises</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Custom Guidelines</label>
            <textarea 
              value={extraGuidelines} 
              onChange={(e) => setExtraGuidelines(e.target.value)}
              placeholder="E.g., Focus heavily on dates..."
              className="w-full border rounded p-2 text-sm h-20 resize-none bg-white"
            />
          </div>

          <div className="pt-4 border-t border-slate-200">
            <label className="block text-sm font-semibold mb-2">Reference Material (PDF)</label>
            <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button 
              onClick={() => fileInputRef.current.click()}
              className="w-full flex items-center justify-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 px-4 rounded text-sm transition-colors bg-white"
            >
              <Upload size={16} /> {pdfName ? "Change PDF" : "Upload Syllabus"}
            </button>
            {pdfName && <p className="text-xs text-slate-500 mt-2 truncate">File: {pdfName}</p>}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex gap-4 shrink-0">
          <button 
            onClick={() => setActiveTab("tutor")}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-md transition-colors ${activeTab === "tutor" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <BookOpen size={18} /> Academic Tutor
          </button>
          
          <button 
            onClick={() => setActiveTab("evaluator")}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-md transition-colors ${activeTab === "evaluator" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <CheckCircle size={18} /> Exam Evaluator
          </button>

          <button 
            onClick={() => setActiveTab("performance")}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-md transition-colors ${activeTab === "performance" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <TrendingUp size={18} /> Performance Manager
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          
          {/* TAB 1: ACADEMIC TUTOR */}
          {activeTab === "tutor" && (
            <div className="max-w-4xl mx-auto space-y-6 pb-24">
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-lg font-semibold mb-4 text-slate-800">Start New Topic</h2>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter subject or topic..."
                    className="flex-1 border border-slate-300 rounded-md p-3 text-sm focus:outline-none focus:border-slate-500 bg-white"
                  />
                  <button 
                    onClick={startSession}
                    disabled={loading || !topic}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-md text-sm font-medium transition-colors disabled:bg-slate-400"
                  >
                    Start Session
                  </button>
                </div>
              </div>
              
              <div className="space-y-6 mt-8">
                {chatLog.map((msg, index) => (
                  <div key={index} className={`p-6 rounded-lg border ${msg.role === "user" ? "bg-slate-100 border-slate-200 ml-12" : msg.role === "error" ? "bg-red-50 border-red-200" : "bg-white border-slate-200 shadow-sm mr-12"}`}>
                    <p className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">
                      {msg.role === "user" ? "You" : "AI Tutor"}
                    </p>
                    <div className="text-slate-800 leading-relaxed text-sm overflow-x-auto">
                      {msg.role === "user" ? (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      ) : (
                        <div className="prose prose-sm max-w-none prose-slate">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {loading && (
                  <div className="p-6 rounded-lg border bg-white border-slate-200 shadow-sm mr-12 animate-pulse">
                    <p className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">AI Tutor</p>
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                  </div>
                )}
              </div>

              {chatLog.length > 0 && !loading && (
                <div className="mt-8 pt-8 border-t border-slate-200">
                  <p className="text-sm font-semibold text-slate-700 mb-4">Choose your next step:</p>
                  <div className="flex flex-wrap gap-3 mb-6">
                    <button onClick={() => callTutorAPI("advance_good")} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                      <ArrowRight size={16} /> Advance to Next Concept
                    </button>
                    <button onClick={() => callTutorAPI("advance_bad")} className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded text-sm font-medium transition-colors">
                      <RefreshCcw size={16} /> Explain Differently
                    </button>
                    <button onClick={() => callTutorAPI("summarize")} className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded text-sm font-medium transition-colors">
                      <FileText size={16} /> Summarize Module
                    </button>
                    
                    <button onClick={generateGraph} className="flex items-center gap-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded text-sm font-bold transition-colors">
                      <Network size={16} /> Visualize Concepts
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Ask a specific question or provide feedback..."
                      className="flex-1 border border-slate-300 rounded-md p-3 text-sm focus:outline-none focus:border-slate-500 bg-white"
                      onKeyDown={(e) => e.key === 'Enter' && userQuery.trim() && callTutorAPI("ask_question", userQuery)}
                    />
                    <button 
                      onClick={() => callTutorAPI("ask_question", userQuery)}
                      disabled={!userQuery.trim()}
                      className="bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-700 transition-colors disabled:bg-slate-400 flex items-center gap-2"
                    >
                      <Send size={16} /> Send
                    </button>
                  </div>
                  
                  {/* React Flow Graph Display Container */}
                  {showGraph && (
                    <div className="mt-8 border border-slate-200 rounded-lg bg-white overflow-hidden shadow-md flex flex-col relative" style={{ height: '500px' }}>
                      <div className="flex justify-between items-center bg-slate-800 text-white p-3 px-5">
                        <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2"><Network size={16} /> AI Knowledge Graph</h3>
                        <button onClick={() => setShowGraph(false)} className="text-slate-300 hover:text-white transition-colors">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex-1 bg-slate-50 relative">
                        {graphLoading ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 animate-pulse">
                            <Network size={40} className="mb-3 text-blue-400" />
                            <p className="font-semibold">Extracting nodes and relationships...</p>
                          </div>
                        ) : (
                          <>
                            <ReactFlow 
                              nodes={nodes} 
                              edges={edges} 
                              fitView 
                              attributionPosition="bottom-left"
                              onNodeClick={(event, node) => setSelectedNode(node)}
                              onPaneClick={() => setSelectedNode(null)}
                            >
                              <Background color="#cbd5e1" gap={16} />
                              <Controls />
                              <MiniMap nodeStrokeColor="#0f172a" nodeColor="#1e293b" maskColor="rgba(241, 245, 249, 0.7)" />
                            </ReactFlow>

                            {/* POP-UP INFO CARD */}
                            {selectedNode && (
                              <div className="absolute top-4 right-4 w-72 bg-white p-5 rounded-lg shadow-xl border border-slate-200 z-10 animate-fade-in">
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Info size={16} className="text-blue-500"/>
                                    {selectedNode.data.label}
                                  </h4>
                                  <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600">
                                    <X size={16} />
                                  </button>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                  {selectedNode.data.description}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXAM EVALUATOR */}
          {activeTab === "evaluator" && (
            <div className="max-w-4xl mx-auto space-y-8 pb-24">
              <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-slate-100 p-2 rounded-full text-slate-700"><CheckCircle size={24} /></div>
                  <h2 className="text-2xl font-bold text-slate-800">Strict Grading Agent</h2>
                </div>
                <p className="text-slate-600 text-sm mb-8">
                  Paste an exam question and your answer below. The AI will act as a strict examiner, grading your response <strong>exclusively</strong> based on the uploaded syllabus.
                </p>

                {!syllabusText && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm font-medium">
                    ⚠️ Note: You haven't uploaded a PDF Syllabus yet. The AI will evaluate based on its general knowledge, but for strict contextual grading, please upload a document in the sidebar.
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Exam Question</label>
                    <input 
                      type="text"
                      value={evalQuestion}
                      onChange={(e) => setEvalQuestion(e.target.value)}
                      placeholder="E.g., Explain the concept of Newton's First Law..."
                      className="w-full border border-slate-300 rounded-lg p-4 text-sm focus:outline-slate-500 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Your Answer</label>
                    <textarea 
                      value={evalAnswer}
                      onChange={(e) => setEvalAnswer(e.target.value)}
                      placeholder="Type your detailed answer here..."
                      className="w-full border border-slate-300 rounded-lg p-4 text-sm h-48 resize-y focus:outline-slate-500 bg-slate-50"
                    />
                  </div>

                  <button 
                    onClick={submitForGrading}
                    disabled={evalLoading || !evalQuestion.trim() || !evalAnswer.trim()}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-lg disabled:bg-slate-400 transition-colors shadow-sm text-lg"
                  >
                    {evalLoading ? "Analyzing against Syllabus..." : "Submit for Strict Evaluation"}
                  </button>
                </div>
              </div>

              {evalResult && (
                <div className="bg-slate-800 p-8 rounded-lg shadow-md border border-slate-700 text-white animate-fade-in">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 border-b border-slate-600 pb-2">Official Examiner Evaluation</h3>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {evalResult}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PERFORMANCE MANAGER */}
          {activeTab === "performance" && (
            <div className="max-w-6xl mx-auto space-y-8 pb-24">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-2">Overall Academic Tracker</h2>
                <p className="text-slate-600 text-sm mb-6">Manage your subjects and individual assignments to generate a highly detailed strategic plan.</p>
                
                <div className="bg-slate-800 text-white p-6 rounded-lg mb-8 flex flex-col md:flex-row justify-between items-center shadow-md">
                  <div className="mb-4 md:mb-0">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Global GPA (Credit-Weighted)</h3>
                    <p className="text-4xl font-bold mt-1">
                      {calculateGlobalGPA()} <span className="text-xl text-slate-400 font-normal">/ 10</span>
                    </p>
                  </div>
                  <div className="text-right flex gap-8">
                    <div>
                      <p className="text-sm text-slate-300 uppercase tracking-wider">Total Credits</p>
                      <p className="text-2xl font-bold text-blue-400 mt-1">
                        {subjects.reduce((acc, curr) => acc + Number(curr.credits || 0), 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-300 uppercase tracking-wider">Total Subjects</p>
                      <p className="text-2xl font-bold text-emerald-400 mt-1">{subjects.length}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    {subjects.map((sub, subIndex) => (
                      <div key={sub.id} className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
                        
                        <div className="bg-slate-50 p-4 flex gap-3 items-center border-b border-slate-200">
                          <input 
                            type="text" 
                            value={sub.name} 
                            onChange={(e) => updateSubject(subIndex, 'name', e.target.value)}
                            className="flex-1 font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:outline-none"
                            placeholder="Subject Name"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase">Credits:</span>
                            <input 
                              type="number" 
                              step="0.5" min="0" 
                              value={sub.credits} 
                              onChange={(e) => updateSubject(subIndex, 'credits', e.target.value)}
                              className="w-16 border border-slate-300 rounded p-1 text-sm bg-white focus:outline-slate-500 text-center"
                            />
                          </div>
                          <div className="bg-slate-800 text-white px-3 py-1 rounded text-sm font-bold">
                            {getSubjectScore(sub).toFixed(2)}
                          </div>
                          <button onClick={() => removeSubject(subIndex)} className="text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="p-4 bg-white space-y-3">
                          {sub.assignments.length > 0 && (
                            <div className="flex gap-2 text-[10px] font-bold text-slate-400 uppercase px-1">
                              <div className="flex-1">Assignment Name</div>
                              <div className="w-16 text-center">Score</div>
                              <div className="w-16 text-center">Weight %</div>
                              <div className="w-6"></div>
                            </div>
                          )}
                          
                          {sub.assignments.map((assign, assignIndex) => (
                            <div key={assign.id} className="flex gap-2 items-center">
                              <ChevronRight size={14} className="text-slate-300" />
                              <input 
                                type="text" 
                                value={assign.name} 
                                onChange={(e) => updateAssignment(subIndex, assignIndex, 'name', e.target.value)}
                                className="flex-1 border border-slate-200 rounded p-1.5 text-sm bg-slate-50 focus:bg-white focus:outline-slate-400"
                              />
                              <input 
                                type="number" 
                                step="0.1" min="0" max="10" 
                                value={assign.score} 
                                onChange={(e) => updateAssignment(subIndex, assignIndex, 'score', e.target.value)}
                                className="w-16 border border-slate-200 rounded p-1.5 text-sm bg-slate-50 focus:bg-white focus:outline-slate-400 text-center"
                              />
                              <input 
                                type="number" 
                                step="1" min="0" max="100" 
                                value={assign.weight} 
                                onChange={(e) => updateAssignment(subIndex, assignIndex, 'weight', e.target.value)}
                                className="w-16 border border-slate-200 rounded p-1.5 text-sm bg-slate-50 focus:bg-white focus:outline-slate-400 text-center"
                              />
                              <button onClick={() => removeAssignment(subIndex, assignIndex)} className="text-slate-300 hover:text-red-500">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          
                          {sub.assignments.reduce((sum, a) => sum + Number(a.weight || 0), 0) !== 100 && sub.assignments.length > 0 && (
                            <p className="text-xs text-amber-600 font-medium px-5">
                              Note: Total weight is {sub.assignments.reduce((sum, a) => sum + Number(a.weight || 0), 0)}%. (Should ideally be 100%)
                            </p>
                          )}

                          <button onClick={() => addAssignment(subIndex)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 mt-2 px-5">
                            <Plus size={12} /> Add Assignment
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    <button onClick={addSubject} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-400 transition-all">
                      <Plus size={18} /> Add New Subject
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="h-80 bg-slate-50 border border-slate-200 rounded-lg p-6 flex flex-col">
                      <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Subject Comparison</h3>
                      <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="subject" tick={{fontSize: 11}} tickLine={false} axisLine={false} />
                            <YAxis domain={[0, 10]} tick={{fontSize: 11}} tickLine={false} axisLine={false} />
                            <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Bar dataKey="score" name="Final Score (0-10)" fill="#1e293b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="p-6 bg-blue-50 border border-blue-100 rounded-lg">
                      <h3 className="text-sm font-bold text-blue-900 mb-2">Ready to optimize your study routine?</h3>
                      <p className="text-xs text-blue-800 mb-4 leading-relaxed">
                        The AI will analyze your highly detailed nested grade structure (every subject and assignment) alongside your uploaded syllabus to generate a personalized study plan.
                      </p>
                      <button 
                        onClick={generatePlan}
                        disabled={planLoading || subjects.length === 0}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-blue-400 transition-colors shadow-sm"
                      >
                        {planLoading ? "Analyzing Deep Performance Data..." : "Generate AI Strategic Plan"}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {studyPlan && (
                <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 mt-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Your Strategic Action Plan</h3>
                  <div className="prose prose-sm max-w-none prose-slate">
                    <ReactMarkdown>{studyPlan}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}