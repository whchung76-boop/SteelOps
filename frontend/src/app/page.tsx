"use client";

import { useState, useEffect, useRef } from "react";

// Types matching the backend schema
interface ProjectSpec {
  id?: string;
  speed: string | null;
  plc_type: string | null;
  comm_type: string | null;
  environment: string | null;
}

interface Customer {
  id: string;
  name: string;
}

interface Project {
  id?: string;
  customer_id?: string;
  title: string;
  line_name: string | null;
  steel_grade: string | null;
  equipment_type: string | null;
  status: string | null;
  target_date: string | null;
  total_amount: number | null;
  margin_rate: number | null;
  created_at?: string;
  customer?: Customer | null;
  specs: ProjectSpec | null;
}

interface RiskAlert {
  message: string;
  acknowledged: boolean;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<string[]>([]);
  const [steelGradeFilter, setSteelGradeFilter] = useState<string[]>([]);
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  
  // Draft Data for New Project
  const [draftProject, setDraftProject] = useState<Partial<Project>>({
    title: "", line_name: "", steel_grade: "", equipment_type: "", customer_id: ""
  });
  const [draftSpecs, setDraftSpecs] = useState<Partial<ProjectSpec>>({
    speed: "", plc_type: "", comm_type: "", environment: ""
  });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const url = new URL("http://localhost:8000/api/projects/");
      if (statusFilter) url.searchParams.append("status", statusFilter);
      if (keywordFilter) url.searchParams.append("keyword", keywordFilter);
      equipmentFilter.forEach(eq => url.searchParams.append("equipment_type", eq));
      steelGradeFilter.forEach(sg => url.searchParams.append("steel_grade", sg));
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/customers/");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchCustomers();
  }, [statusFilter, equipmentFilter, steelGradeFilter]);

  // Handle Object URL memory leak
  useEffect(() => {
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile);
      setFilePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreviewUrl(null);
    }
  }, [uploadedFile]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjects();
  };

  const toggleFilter = (setFilter: React.Dispatch<React.SetStateAction<string[]>>, filterList: string[], value: string) => {
    if (filterList.includes(value)) {
      setFilter(filterList.filter(item => item !== value));
    } else {
      setFilter([...filterList, value]);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "수주": return "bg-green-100 text-green-800 border-green-200";
      case "견적제출": return "bg-blue-100 text-blue-800 border-blue-200";
      case "실주": return "bg-red-100 text-red-800 border-red-200";
      case "검토중": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // --- Modal Logic ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const toggleRiskAlert = (index: number) => {
    setRiskAlerts(prev => prev.map((alert, i) => i === index ? { ...alert, acknowledged: !alert.acknowledged } : alert));
  };

  const startAIAnalysis = async () => {
    if (!uploadedFile) {
      alert("사양서 파일을 업로드해주세요.");
      return;
    }
    if (!draftProject.customer_id) {
      alert("고객사를 선택해주세요.");
      return;
    }
    
    setModalStep(2); // Loading state

    const formData = new FormData();
    formData.append("file", uploadedFile);

    try {
      const res = await fetch("http://localhost:8000/api/projects/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setDraftProject(prev => ({
          ...prev,
          title: data.title || prev.title,
          line_name: data.line_name || prev.line_name,
          steel_grade: data.steel_grade || prev.steel_grade,
          equipment_type: data.equipment_type || prev.equipment_type
        }));
        setDraftSpecs({
          speed: data.speed,
          plc_type: data.plc_type,
          comm_type: data.comm_type,
          environment: data.environment
        });
        const alerts = data.risk_alerts || [];
        setRiskAlerts(alerts.map((msg: string) => ({ message: msg, acknowledged: false })));
        setModalStep(3); // Result Form state
      }
    } catch (e) {
      console.error(e);
      alert("AI 분석 중 오류가 발생했습니다.");
      setModalStep(1);
    }
  };

  const saveProject = async () => {
    const unacknowledged = riskAlerts.filter(a => !a.acknowledged);
    if (unacknowledged.length > 0) {
      alert("모든 리스크 경고를 확인(체크)해야 저장이 가능합니다.");
      return;
    }

    try {
      const payload = { ...draftProject, specs: draftSpecs };
      const res = await fetch("http://localhost:8000/api/projects/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setModalStep(1);
        setUploadedFile(null);
        setDraftProject({title: "", line_name: "", steel_grade: "", equipment_type: "", customer_id: ""});
        setDraftSpecs({speed: "", plc_type: "", comm_type: "", environment: ""});
        setRiskAlerts([]);
        fetchProjects();
      } else {
        alert("저장 실패");
      }
    } catch (e) {
      console.error(e);
      alert("저장 중 오류");
    }
  };

  const selectedCustomerName = customers.find(c => c.id === draftProject.customer_id)?.name;

  return (
    <div className="flex h-full relative">
      <div className={`flex-1 p-6 flex flex-col transition-all duration-300 ${selectedProject ? 'mr-[40rem]' : ''}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">프로젝트 견적 이력</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-md hover:bg-slate-800 transition font-medium shadow-sm flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            신규 견적 등록 (AI 분석)
          </button>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 mb-6 space-y-4">
          <form onSubmit={handleSearch} className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">통합 검색어</label>
              <input type="text" placeholder="프로젝트명, 라인명 검색..." className="w-full border-slate-300 rounded-md shadow-sm border p-2 focus:ring-blue-500 focus:border-blue-500" value={keywordFilter} onChange={(e) => setKeywordFilter(e.target.value)} />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-slate-700 mb-1">상태 필터</label>
              <select className="w-full border-slate-300 rounded-md shadow-sm border p-2 focus:ring-blue-500 focus:border-blue-500 bg-white" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">전체 상태</option>
                <option value="검토중">검토중</option>
                <option value="견적제출">견적제출</option>
                <option value="수주">수주</option>
                <option value="실주">실주</option>
              </select>
            </div>
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition font-medium shadow-sm h-[42px]">검색</button>
          </form>

          <div className="grid grid-cols-2 gap-6 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">설비 종류 다중 선택</label>
              <div className="flex gap-2 flex-wrap">
                {["마킹기", "밴딩기", "결속기", "비전검사기"].map(eq => (
                  <button key={eq} type="button" onClick={() => toggleFilter(setEquipmentFilter, equipmentFilter, eq)} className={`px-3 py-1 text-sm rounded-full border transition ${equipmentFilter.includes(eq) ? 'bg-blue-100 border-blue-400 text-blue-800 font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {eq}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">적용 강종 다중 선택</label>
              <div className="flex gap-2 flex-wrap">
                {["열연", "냉연", "후판", "도금", "선재"].map(sg => (
                  <button key={sg} type="button" onClick={() => toggleFilter(setSteelGradeFilter, steelGradeFilter, sg)} className={`px-3 py-1 text-sm rounded-full border transition ${steelGradeFilter.includes(sg) ? 'bg-slate-800 border-slate-800 text-white font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {sg}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-0">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">상태</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">견적일</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">고객사 / 라인명</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">프로젝트명</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">주요 사양</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">총 견적가</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">마진율</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">데이터를 불러오는 중입니다...</td></tr>
                ) : projects.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">검색 결과가 없습니다.</td></tr>
                ) : (
                  projects.map((p) => {
                    const isLowMargin = p.margin_rate !== null && p.margin_rate < 20;
                    return (
                      <tr key={p.id} onClick={() => setSelectedProject(p)} className={`cursor-pointer transition ${isLowMargin ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-blue-50'} ${selectedProject?.id === p.id ? 'bg-blue-50 ring-inset ring-2 ring-blue-500' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(p.status)}`}>{p.status}</span></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800"><div className="font-medium">{p.customer?.name}</div><div className="text-slate-500 text-xs">{p.line_name}</div></td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">{p.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600"><div className="flex gap-2 items-center"><span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{p.equipment_type}</span><span className="text-slate-400">|</span><span>{p.steel_grade}</span></div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 text-right font-medium">{p.total_amount ? `₩ ${p.total_amount.toLocaleString()}` : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right"><span className={`font-bold flex items-center justify-end gap-1 ${isLowMargin ? 'text-red-600' : 'text-slate-700'}`}>{isLowMargin && <span title="적정 마진율 미달">⚠️</span>}{p.margin_rate ? `${p.margin_rate}%` : '-'}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={`fixed top-16 right-0 bottom-0 w-[40rem] bg-white border-l border-slate-200 shadow-2xl transform transition-transform duration-300 ease-in-out z-10 overflow-y-auto ${selectedProject ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedProject && (
          <div className="p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">{selectedProject.customer?.name} - {selectedProject.line_name}</div>
                <h2 className="text-2xl font-bold text-slate-900 leading-tight">{selectedProject.title}</h2>
              </div>
              <button onClick={() => setSelectedProject(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-slate-500 mb-1">상태</div>
                    <div className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full border ${getStatusColor(selectedProject.status)}`}>{selectedProject.status}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500 mb-1">납기일</div>
                    <div className="text-base font-medium text-slate-900">{selectedProject.target_date ? new Date(selectedProject.target_date).toLocaleDateString() : '미정'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500 mb-1">총 견적가</div>
                    <div className="text-lg font-bold text-blue-700">{selectedProject.total_amount ? `₩ ${selectedProject.total_amount.toLocaleString()}` : '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500 mb-1">마진율</div>
                    <div className={`text-lg font-bold flex items-center gap-1 ${selectedProject.margin_rate !== null && selectedProject.margin_rate < 20 ? 'text-red-600' : 'text-slate-900'}`}>
                      {selectedProject.margin_rate !== null && selectedProject.margin_rate < 20 && <span>⚠️</span>}
                      {selectedProject.margin_rate ? `${selectedProject.margin_rate}%` : '-'}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                  핵심 기술 사양 (Project Specs)
                </h3>
                <div className="space-y-4 bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
                  <div className="flex justify-between items-center py-2 border-b border-slate-50 border-dashed"><span className="text-slate-500 font-medium">생산 속도 (Line Speed)</span><span className="text-base font-semibold text-slate-900">{selectedProject.specs?.speed || 'N/A'}</span></div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50 border-dashed"><span className="text-slate-500 font-medium">적용 강종</span><span className="text-base font-semibold text-slate-900">{selectedProject.steel_grade || 'N/A'}</span></div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50 border-dashed"><span className="text-slate-500 font-medium">제어반 (PLC Type)</span><span className="text-base font-semibold text-slate-900">{selectedProject.specs?.plc_type || 'N/A'}</span></div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50 border-dashed"><span className="text-slate-500 font-medium">통신 방식</span><span className="text-base font-semibold text-slate-900">{selectedProject.specs?.comm_type || 'N/A'}</span></div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50 border-dashed"><span className="text-slate-500 font-medium">설치 환경 (리스크)</span><span className="text-base font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded">{selectedProject.specs?.environment || 'N/A'}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className={`bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-500 ${modalStep === 3 ? 'w-full max-w-7xl h-[85vh]' : 'w-[40rem] max-h-[85vh]'}`}>
            
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">{modalStep}</span>
                신규 견적/프로젝트 등록 (AI 사양 분석)
              </h3>
              <button onClick={() => { setIsModalOpen(false); setModalStep(1); }} className="text-slate-400 hover:text-slate-600 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col">
              {modalStep === 1 && (
                <div className="p-8 space-y-6 overflow-y-auto">
                  <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm flex gap-3">
                    <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p>고객사에서 받은 <strong>PDF 사양서</strong>를 업로드하시면 AI가 데이터를 추출합니다.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">고객사 선택 (필수)</label>
                    <select className="w-full border-slate-300 rounded-md shadow-sm border p-3 focus:ring-blue-500 bg-white" value={draftProject.customer_id || ""} onChange={(e) => setDraftProject({...draftProject, customer_id: e.target.value})}>
                      <option value="">고객사를 선택해주세요</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">사양서 파일 업로드</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-blue-400 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className="bg-blue-100 text-blue-600 p-4 rounded-full mb-4">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      </div>
                      <p className="font-bold text-slate-700 text-lg mb-1">{uploadedFile ? uploadedFile.name : "사양서 파일을 드래그 앤 드롭 하세요"}</p>
                      <p className="text-slate-500 mb-4">또는 클릭하여 파일 선택 (PDF 권장)</p>
                      <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,image/*" />
                    </div>
                  </div>
                </div>
              )}

              {modalStep === 2 && (
                <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-6">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 border-t-blue-600"></div>
                  <h3 className="text-xl font-bold text-slate-800">AI 모델이 사양서를 분석 중입니다...</h3>
                  <p className="text-slate-500 text-center">도면 기호, 소재 규격, 필수 요구사항을 판별하고 누락된 요소를 찾고 있습니다.<br/>(약 2~3초 소요)</p>
                </div>
              )}

              {modalStep === 3 && (
                <div className="flex flex-1 overflow-hidden">
                  {/* Left: Split View File Preview */}
                  <div className="w-1/2 bg-slate-100 border-r border-slate-200 p-4 flex flex-col">
                    <h4 className="font-semibold text-slate-700 mb-2">원본 사양서 미리보기</h4>
                    <div className="flex-1 bg-white border border-slate-300 rounded-md overflow-hidden shadow-inner flex items-center justify-center">
                      {filePreviewUrl ? (
                        uploadedFile?.type.includes('pdf') ? (
                          <object data={filePreviewUrl} type="application/pdf" className="w-full h-full">
                            <p className="text-center text-slate-500 p-4">PDF 미리보기를 지원하지 않는 브라우저입니다.</p>
                          </object>
                        ) : uploadedFile?.type.includes('image') ? (
                          <img src={filePreviewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                        ) : (
                          <div className="text-center text-slate-500 p-10">미리보기를 지원하지 않는 형식입니다.<br/>문서를 원본 앱에서 열어 참조하세요.</div>
                        )
                      ) : (
                        <div className="text-slate-400">파일 미리보기 영역</div>
                      )}
                    </div>
                  </div>

                  {/* Right: AI Result & Form */}
                  <div className="w-1/2 p-6 overflow-y-auto bg-slate-50">
                    <div className="space-y-6 max-w-2xl mx-auto">
                      
                      {/* Risk Alerts */}
                      {riskAlerts.length > 0 && (
                        <div className="bg-white border border-red-200 shadow-sm rounded-lg overflow-hidden">
                          <div className="bg-red-50 border-b border-red-200 p-3">
                            <h4 className="flex items-center text-red-800 font-bold text-sm">
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              치명적 리스크 자동 탐지 (필수 확인)
                            </h4>
                          </div>
                          <div className="p-3">
                            <ul className="space-y-2">
                              {riskAlerts.map((alert, idx) => (
                                <li key={idx} className={`flex items-start gap-3 p-2 rounded-md transition ${alert.acknowledged ? 'bg-slate-50 opacity-50' : 'bg-red-50/50'}`}>
                                  <input 
                                    type="checkbox" 
                                    checked={alert.acknowledged} 
                                    onChange={() => toggleRiskAlert(idx)}
                                    className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 rounded cursor-pointer"
                                  />
                                  <span className={`text-sm ${alert.acknowledged ? 'text-slate-500 line-through' : 'text-red-700 font-medium'}`}>{alert.message}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Forms */}
                      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                        <h4 className="font-semibold text-slate-800 mb-4 border-b pb-2">기본 정보 (AI 추출)</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">프로젝트명</label>
                            <input className="w-full border border-slate-300 p-2.5 rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={draftProject.title || ""} onChange={e => setDraftProject({...draftProject, title: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">라인명</label>
                            <input className="w-full border border-slate-300 p-2.5 rounded-md text-sm" value={draftProject.line_name || ""} onChange={e => setDraftProject({...draftProject, line_name: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">설비 종류</label>
                            <input className="w-full border border-slate-300 p-2.5 rounded-md text-sm font-semibold text-blue-700" value={draftProject.equipment_type || ""} onChange={e => setDraftProject({...draftProject, equipment_type: e.target.value})} />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">적용 강종</label>
                            <input className="w-full border border-slate-300 p-2.5 rounded-md text-sm" value={draftProject.steel_grade || ""} onChange={e => setDraftProject({...draftProject, steel_grade: e.target.value})} />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                        <h4 className="font-semibold text-slate-800 mb-4 border-b pb-2">상세 기술 요구사항</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">생산 속도</label>
                            <input className="w-full border border-slate-300 p-2.5 rounded-md text-sm" value={draftSpecs.speed || ""} onChange={e => setDraftSpecs({...draftSpecs, speed: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">설치 환경</label>
                            <input className="w-full border border-slate-300 p-2.5 rounded-md text-sm" value={draftSpecs.environment || ""} onChange={e => setDraftSpecs({...draftSpecs, environment: e.target.value})} />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">PLC 및 제어반 규격</label>
                            <input className={`w-full border p-2.5 rounded-md text-sm ${draftSpecs.plc_type?.includes('미기재') ? 'border-red-400 bg-red-50 text-red-700 font-semibold' : 'border-slate-300'}`} value={draftSpecs.plc_type || ""} onChange={e => setDraftSpecs({...draftSpecs, plc_type: e.target.value})} />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">통신 방식</label>
                            <input className={`w-full border p-2.5 rounded-md text-sm ${draftSpecs.comm_type?.includes('미기재') ? 'border-red-400 bg-red-50 text-red-700 font-semibold' : 'border-slate-300'}`} value={draftSpecs.comm_type || ""} onChange={e => setDraftSpecs({...draftSpecs, comm_type: e.target.value})} />
                          </div>
                        </div>
                      </div>

                      {/* Data Hint Component */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-4">
                        <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                          <h5 className="font-bold text-blue-800 mb-1 text-sm">유사 프로젝트 이력 힌트</h5>
                          <p className="text-sm text-blue-700 mb-2">
                            AI 분석 결과, <strong>{selectedCustomerName || "해당 고객사"}</strong>의 <strong>{draftProject.equipment_type || "유사 설비"}</strong> 구축 이력이 <span className="font-bold underline">2건</span> 발견되었습니다. 이전의 견적 단가와 마진율을 참고하여 견적을 작성하세요.
                          </p>
                          <button className="text-sm font-semibold text-blue-600 hover:text-blue-800 bg-white px-3 py-1.5 rounded border border-blue-200 shadow-sm transition">
                            관련 과거 견적 보기 →
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
              <button onClick={() => { setIsModalOpen(false); setModalStep(1); }} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-md transition">
                취소
              </button>
              {modalStep === 1 && (
                <button onClick={startAIAnalysis} className="px-6 py-2.5 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-md transition flex items-center gap-2 shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  AI 분석 시작
                </button>
              )}
              {modalStep === 3 && (
                <button onClick={saveProject} className="px-8 py-2.5 bg-green-600 text-white font-bold hover:bg-green-700 rounded-md transition shadow-md flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  이 내용으로 최종 저장
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
