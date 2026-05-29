"use client";

import { useState, useEffect, useRef } from "react";
import * as mammoth from "mammoth";

// Types matching the backend schema
interface ProjectSpec { speed: string | null; plc_type: string | null; comm_type: string | null; environment: string | null; }
interface Customer { id: string; name: string; contact_person?: string; contact_number?: string; email?: string; }
interface Project {
  id?: string; customer_id?: string; customer_name?: string; title: string; line_name: string | null; steel_grade: string | null;
  equipment_type: string | null; status: string | null; target_date: string | null; total_amount: number | null;
  margin_rate: number | null; created_at?: string; customer?: Customer | null; specs: ProjectSpec | null;
  actual_quote_price?: number | null;
  bid_price?: number | null;
  competitor_name?: string | null;
  winning_price?: number | null;
}
interface RiskAlert { message: string; acknowledged: boolean; }
interface QuoteItem { name: string; specification: string; quantity: number; unit_price: number; total_price: number; }
interface QuoteResponse { title: string; total_amount: number; items: QuoteItem[]; scope_of_supply: string[]; exclusions: string[]; conditions: string[]; }
interface CallSummary { id: string; customer_name: string; inquiry_type: string; specs: string; predicted_equipment: string; todos: string[]; created_at: string; }
interface VendorQuote { vendor_name: string; unit_price: number; delivery_days: number; notes: string; }
interface VendorItem { item_name: string; quotes: VendorQuote[]; }
interface VendorComparison { project_id: string; items: VendorItem[]; }

// Custom SVG Chart Components
function WeeklyTrendChart({ trends }: { trends: { week_label: string; amount: number }[] }) {
  const maxAmount = Math.max(...trends.map(t => t.amount), 100000000); // 1억 baseline
  const width = 500;
  const height = 300;
  const paddingLeft = 80;
  const paddingRight = 30;
  const paddingTop = 40;
  const paddingBottom = 40;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  const formatAmount = (amt: number) => {
    if (amt >= 100000000) {
      return (amt / 100000000).toFixed(1) + "억";
    } else if (amt >= 10000) {
      return (amt / 10000).toFixed(0) + "만";
    }
    return amt.toLocaleString();
  };

  const yDivisions = [0, maxAmount * 0.33, maxAmount * 0.66, maxAmount];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      
      {yDivisions.map((val, idx) => {
        const y = paddingTop + chartHeight - (val / maxAmount) * chartHeight;
        return (
          <g key={idx}>
            <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
            <text x={paddingLeft - 10} y={y + 3} textAnchor="end" className="text-[10px] font-medium text-slate-400 fill-current">
              {formatAmount(val)}
            </text>
          </g>
        );
      })}
      
      {trends.map((item, idx) => {
        const barWidth = 40;
        const groupWidth = chartWidth / trends.length;
        const x = paddingLeft + idx * groupWidth + (groupWidth - barWidth) / 2;
        const barHeight = (item.amount / maxAmount) * chartHeight;
        const y = paddingTop + chartHeight - barHeight;
        
        return (
          <g key={idx} className="group">
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 2)} fill="url(#barGradient)" rx="4" className="transition-all duration-300 hover:fill-blue-500 cursor-pointer" />
            {item.amount > 0 && (
              <text x={x + barWidth / 2} y={y - 14} textAnchor="middle" className="text-[10px] font-medium text-slate-500 fill-current">
                {formatAmount(item.amount)}
              </text>
            )}
            <text x={x + barWidth / 2} y={height - 15} textAnchor="middle" className="text-[10px] font-medium text-slate-500 fill-current">
              {item.week_label}
            </text>
          </g>
        );
      })}
      
      <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke="#cbd5e1" strokeWidth="1.5" />
    </svg>
  );
}

function CustomerRatioChart({ ratios }: { ratios: { customer_name: string; won_count: number; lost_count: number }[] }) {
  const displayRatios = ratios.slice(0, 5);
  const maxCount = Math.max(...displayRatios.map(r => Math.max(r.won_count, r.lost_count)), 4);
  const width = 500;
  const height = 300;
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 50;
  const paddingBottom = 40;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  const yDivisions = Array.from({ length: maxCount + 1 }, (_, i) => i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        <linearGradient id="wonGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="lostGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>

      <g transform="translate(360, 20)">
        <rect x="0" y="1" width="7" height="7" fill="url(#wonGradient)" rx="1.5" />
        <text x="12" y="8" className="text-[9px] font-medium text-slate-400 fill-current">수주</text>
        <rect x="45" y="1" width="7" height="7" fill="url(#lostGradient)" rx="1.5" />
        <text x="57" y="8" className="text-[9px] font-medium text-slate-400 fill-current">실주</text>
      </g>
      
      {yDivisions.map((val, idx) => {
        const y = paddingTop + chartHeight - (val / maxCount) * chartHeight;
        return (
          <g key={idx}>
            <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
            <text x={paddingLeft - 10} y={y + 3} textAnchor="end" className="text-[10px] font-medium text-slate-400 fill-current">
              {val}건
            </text>
          </g>
        );
      })}
      
      {displayRatios.map((item, idx) => {
        const groupWidth = chartWidth / displayRatios.length;
        const paddingBetweenGroups = 20;
        const availableWidth = groupWidth - paddingBetweenGroups;
        const barWidth = availableWidth / 2 - 2;
        const groupX = paddingLeft + idx * groupWidth + paddingBetweenGroups / 2;
        
        const wonX = groupX;
        const wonHeight = (item.won_count / maxCount) * chartHeight;
        const wonY = paddingTop + chartHeight - wonHeight;
        
        const lostX = groupX + barWidth + 4;
        const lostHeight = (item.lost_count / maxCount) * chartHeight;
        const lostY = paddingTop + chartHeight - lostHeight;
        
        return (
          <g key={idx}>
            <rect x={wonX} y={wonY} width={barWidth} height={Math.max(wonHeight, 2)} fill="url(#wonGradient)" rx="3" className="transition-all duration-300 hover:opacity-90 cursor-pointer" />
            {item.won_count > 0 && (
              <text x={wonX + barWidth / 2} y={wonY - 14} textAnchor="middle" className="text-[10px] font-medium text-emerald-600 fill-current">
                {item.won_count}
              </text>
            )}

            <rect x={lostX} y={lostY} width={barWidth} height={Math.max(lostHeight, 2)} fill="url(#lostGradient)" rx="3" className="transition-all duration-300 hover:opacity-90 cursor-pointer" />
            {item.lost_count > 0 && (
              <text x={lostX + barWidth / 2} y={lostY - 14} textAnchor="middle" className="text-[10px] font-medium text-red-500 fill-current">
                {item.lost_count}
              </text>
            )}

            <text x={groupX + availableWidth / 2} y={height - 15} textAnchor="middle" className="text-[10px] font-medium text-slate-500 fill-current">
              {item.customer_name}
            </text>
          </g>
        );
      })}
      
      <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke="#cbd5e1" strokeWidth="1.5" />
    </svg>
  );
}

// Helper to convert number string to Korean Won representation
function convertToKoreanWon(valStr: string): string {
  const cleanStr = valStr.replace(/[^0-9]/g, "");
  if (!cleanStr) return "";
  const num = parseInt(cleanStr, 10);
  if (num === 0) return "영 원";

  const koreanNumbers = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const units = ["", "십", "백", "천"];
  const bigUnits = ["", "만", "억", "조", "경"];

  let result = "";
  const len = cleanStr.length;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(cleanStr[i], 10);
    const position = len - 1 - i; // 0-indexed position from right
    const unitPos = position % 4;
    const bigUnitPos = Math.floor(position / 4);

    if (digit !== 0) {
      result += koreanNumbers[digit] + units[unitPos];
    }

    // Add big unit (만, 억, 조...) at the boundary (every 4 digits)
    if (unitPos === 0) {
      // Check if the current 4-digit chunk has any non-zero digit
      const startIdx = Math.max(0, i - 3);
      const chunk = cleanStr.slice(startIdx, i + 1);
      if (parseInt(chunk, 10) > 0) {
        result += bigUnits[bigUnitPos] + " ";
      }
    }
  }

  const formatted = result.trim().replace(/\s+/g, " ");
  return formatted ? `일금 ${formatted}원정` : "";
}

export default function Home() {
  const [currentView, setCurrentView] = useState<"inquiry" | "tech_review" | "quote_bidding" | "project_db" | "dashboard">("inquiry");

  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Customer CRM state
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerContactPerson, setNewCustomerContactPerson] = useState("");
  const [newCustomerContactNumber, setNewCustomerContactNumber] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [statusFilter, setStatusFilter] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<string[]>([]);
  const [steelGradeFilter, setSteelGradeFilter] = useState<string[]>([]);
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<"specs" | "vendor">("specs");
  const [vendorData, setVendorData] = useState<VendorComparison | null>(null);

  // Quote Modal State
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3 | 4>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [recommendedProjects, setRecommendedProjects] = useState<Project[]>([]);
  const [quoteData, setQuoteData] = useState<QuoteResponse | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // 파일 뷰어 연동 및 DOCX 파싱
  useEffect(() => {
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile);
      setFilePreviewUrl(url);
      
      if (uploadedFile.name.toLowerCase().endsWith('.docx')) {
        const reader = new FileReader();
        reader.onload = function(event) {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          if (arrayBuffer) {
            mammoth.convertToHtml({ arrayBuffer })
              .then(result => setDocxHtml(result.value))
              .catch(err => {
                console.error("Mammoth error:", err);
                setDocxHtml(null);
              });
          }
        };
        reader.readAsArrayBuffer(uploadedFile);
      } else {
        setDocxHtml(null);
      }
      
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreviewUrl(null);
      setDocxHtml(null);
    }
  }, [uploadedFile]);

  // 데이터 수신 확인 및 강제 렌더링 트리거를 위한 useEffect
  useEffect(() => {
    if (extractedData?.extracted_tables) {
      console.log("useEffect Triggered - extracted_tables:", extractedData.extracted_tables);
    }
  }, [extractedData]);
  const [quoteItems, setQuoteItems] = useState<{unitPrice: number, quantity: number}[]>([]);

  // 세션 스토리지에서 quoteItems 불러오기
  useEffect(() => {
    const saved = sessionStorage.getItem("steelops_quote_items");
    if (saved) {
      try {
        setQuoteItems(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);

  // quoteItems 변경 시 세션 스토리지에 자동 저장
  useEffect(() => {
    if (quoteItems.length > 0) {
      sessionStorage.setItem("steelops_quote_items", JSON.stringify(quoteItems));
    }
  }, [quoteItems]);
  
  const [draftProject, setDraftProject] = useState<Partial<Project>>({title: "", line_name: "", steel_grade: "", equipment_type: "", customer_id: "", customer_name: "", status: "검토중"});
  const [draftSpecs, setDraftSpecs] = useState<Partial<ProjectSpec>>({speed: "", plc_type: "", comm_type: "", environment: ""});
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([]);

  // Commercial Results Form States
  const [statusInput, setStatusInput] = useState<string>("검토중");
  const [actualQuoteInput, setActualQuoteInput] = useState<string>("");
  const [bidInput, setBidInput] = useState<string>("");
  const [competitorInput, setCompetitorInput] = useState<string>("");
  const [winningPriceInput, setWinningPriceInput] = useState<string>("");
  const [isSavingResults, setIsSavingResults] = useState(false);

  // Editing project states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editLineName, setEditLineName] = useState("");
  const [editSteelGrade, setEditSteelGrade] = useState("");
  const [editEquipmentType, setEditEquipmentType] = useState("");
  const [editTotalAmount, setEditTotalAmount] = useState("");
  const [editMarginRate, setEditMarginRate] = useState("");
  const [editSpeed, setEditSpeed] = useState("");
  const [editPlcType, setEditPlcType] = useState("");
  const [editCommType, setEditCommType] = useState("");
  const [editEnvironment, setEditEnvironment] = useState("");

  // Helper for formatting and setting money inputs
  const handleMoneyInputChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, "");
    if (!rawVal) {
      setter("");
    } else {
      setter(parseInt(rawVal, 10).toLocaleString());
    }
  };

  // Dashboard Stats State
  interface WeeklyTrendItem { week_label: string; amount: number; }
  interface CustomerRatioItem { customer_name: string; won_count: number; lost_count: number; }
  interface DashboardStats {
    submitted_quotes_count: number;
    winning_rate: number;
    time_saved_hours: number;
    avg_margin_rate: number;
    weekly_trends: WeeklyTrendItem[];
    customer_ratios: CustomerRatioItem[];
  }
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // Phone-to-Task State
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneText, setPhoneText] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [todayTasks, setTodayTasks] = useState<CallSummary[]>([]);

  // Gmail Intake States
  interface GmailIntake {
    id: string;
    message_id: string;
    subject: string;
    sender: string;
    received_at: string;
    snippet: string | null;
    attachment_name: string | null;
    ai_status: string;
    approval_status: string;
    processed_project_id: string | null;
    created_at: string;
  }
  const [gmailIntakes, setGmailIntakes] = useState<GmailIntake[]>([]);
  const [selectedIntakeId, setSelectedIntakeId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [gmailNextPageToken, setGmailNextPageToken] = useState<string | null>(null);
  const [isLoadingMoreGmail, setIsLoadingMoreGmail] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const url = new URL("http://127.0.0.1:8000/api/projects/");
      if (statusFilter) url.searchParams.append("status", statusFilter);
      if (keywordFilter) url.searchParams.append("keyword", keywordFilter);
      equipmentFilter.forEach(eq => url.searchParams.append("equipment_type", eq));
      steelGradeFilter.forEach(sg => url.searchParams.append("steel_grade", sg));
      const res = await fetch(url.toString());
      if (res.ok) setProjects(await res.json());
    } finally { setLoading(false); }
  };

  const loadProjectDetails = async (p: any) => {
    setSelectedProject(p);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/projects/${p.id}`);
      if (res.ok) {
        const data = await res.json();
        console.log("받아온 데이터:", data);
        setSelectedProject(data);
        
        // 1. 데이터가 있는지 확인
        if (data.specs?.ai_extracted_data) {
          let aiData = data.specs.ai_extracted_data;
          if (typeof aiData === 'string') {
            try { aiData = JSON.parse(aiData); } catch (e) {}
          }
          
          const { quoteItems, extractedData } = aiData;
          
          // 2. 상태 강제 업데이트
          setExtractedData(extractedData);
          setQuoteItems(quoteItems);
          
          // 3. (중요) 모달 억제 및 탭 전환
          setIsQuoteModalOpen(false); 
          setActiveTab("specs");      
          console.log("데이터 복원 완료:", quoteItems);
        } else {
          // 데이터가 없는 완전 신규 프로젝트인 경우에만 모달 띄움
          setIsQuoteModalOpen(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCustomers = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/customers/");
    if (res.ok) setCustomers(await res.json());
  };

  const registerCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return alert("고객사명을 입력해 주세요.");
    setIsRegisteringCustomer(true);
    try {
      const isEdit = !!editingCustomer;
      const url = isEdit 
        ? `http://127.0.0.1:8000/api/customers/${editingCustomer.id}` 
        : "http://127.0.0.1:8000/api/customers/";
      const method = isEdit ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName,
          contact_person: newCustomerContactPerson || null,
          contact_number: newCustomerContactNumber || null,
          email: newCustomerEmail || null,
        }),
      });
      if (res.ok) {
        alert(isEdit ? "고객사 정보가 성공적으로 수정되었습니다." : "고객사가 성공적으로 등록되었습니다.");
        setNewCustomerName("");
        setNewCustomerContactPerson("");
        setNewCustomerContactNumber("");
        setNewCustomerEmail("");
        setEditingCustomer(null);
        await fetchCustomers(); // Refresh customer list
        await fetchProjects(); // If name updated, project list reflects it
        await fetchDashboardStats(); // Refresh dashboard
      } else {
        alert(isEdit ? "고객사 수정 실패" : "고객사 등록 실패");
      }
    } catch (err) {
      console.error(err);
      alert("처리 중 오류가 발생했습니다.");
    } finally {
      setIsRegisteringCustomer(false);
    }
  };

  const handleEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setNewCustomerName(c.name);
    setNewCustomerContactPerson(c.contact_person || "");
    setNewCustomerContactNumber(c.contact_number || "");
    setNewCustomerEmail(c.email || "");
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm("정말 이 고객사를 삭제하시겠습니까?\n해당 고객사와 관련된 모든 프로젝트가 함께 삭제되며 복구할 수 없습니다.")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/customers/${customerId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        alert("고객사가 정상적으로 삭제되었습니다.");
        if (editingCustomer?.id === customerId) {
          setEditingCustomer(null);
          setNewCustomerName("");
          setNewCustomerContactPerson("");
          setNewCustomerContactNumber("");
          setNewCustomerEmail("");
        }
        await fetchCustomers();
        await fetchProjects();
        await fetchDashboardStats();
      } else {
        alert("고객사 삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("고객사 삭제 중 오류가 발생했습니다.");
    }
  };

  const fetchEquipmentTypes = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/projects/equipment-types");
      if (res.ok) setEquipmentTypes(await res.json());
    } catch (err) {
      console.error("Error fetching equipment types:", err);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/dashboard/stats");
      if (res.ok) setDashboardStats(await res.json());
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
    }
  };

  const fetchGmailIntakes = async (pageToken?: string | null) => {
    try {
      let url = "http://127.0.0.1:8000/api/gmail/intakes";
      if (pageToken) {
        url += `?page_token=${encodeURIComponent(pageToken)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (pageToken) {
          setGmailIntakes(prev => {
            const existingIds = new Set(prev.map(item => item.id));
            const newItems = data.intakes.filter((item: GmailIntake) => !existingIds.has(item.id));
            return [...prev, ...newItems];
          });
        } else {
          setGmailIntakes(data.intakes);
        }
        setGmailNextPageToken(data.next_page_token);
      }
    } catch (err) {
      console.error("Error fetching gmail intakes:", err);
    }
  };

  const handleLoadMoreGmail = async () => {
    if (!gmailNextPageToken || isLoadingMoreGmail) return;
    setIsLoadingMoreGmail(true);
    try {
      await fetchGmailIntakes(gmailNextPageToken);
    } finally {
      setIsLoadingMoreGmail(false);
    }
  };

  const handleGmailSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/gmail/sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setGmailIntakes(data.intakes);
        setGmailNextPageToken(data.next_page_token);
        alert("지메일 동기화가 완료되었습니다.");
      } else {
        const errData: any = await res.json().catch(() => ({}));
        if (res.status === 401 && errData.detail?.auth_url) {
          if (confirm("지메일 동기화를 진행하려면 Google 계정 연동이 필요합니다. 인증 화면으로 이동하시겠습니까?")) {
            window.open(errData.detail.auth_url, "gmail_auth_popup", "width=600,height=700,status=no,menubar=no,toolbar=no");
          }
        } else {
          alert(errData.detail || "지메일 동기화에 실패했습니다.");
        }
      }
    } catch (err) {
      console.error("Error syncing gmail:", err);
      alert("서버 연결에 실패했습니다.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGmailConvert = async () => {
    let targetId = selectedIntakeId;
    if (!targetId && gmailIntakes.length > 0) {
      targetId = gmailIntakes[0].id;
      setSelectedIntakeId(targetId);
    }

    if (!targetId) {
      return alert("변환할 이메일이 존재하지 않습니다.");
    }

    const selectedIntake = gmailIntakes.find(i => i.id === targetId);
    if (selectedIntake && selectedIntake.approval_status === "APPROVED") {
      const confirmReconvert = confirm("이미 변환된 메일입니다. 다시 변환하시겠습니까?");
      if (!confirmReconvert) return;
    }

    setIsConverting(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/gmail/intakes/${targetId}/convert`, { method: "POST" });
      if (res.ok) {
        const newProject = await res.json();
        alert("이메일 분석 및 영업 카드 등록이 완료되었습니다. 기술 검토 페이지로 이관합니다.");
        await fetchGmailIntakes();
        await fetchCustomers();
        await fetchProjects();
        await fetchDashboardStats();
        setSelectedProject(newProject);
        setActiveTab("specs");
        setCurrentView("tech_review");
      } else {
        alert("프로젝트 카드 변환에 실패했습니다.");
      }
    } catch (err) {
      console.error("Error converting email:", err);
      alert("서버 연결에 실패했습니다.");
    } finally {
      setIsConverting(false);
    }
  };

  useEffect(() => { 
    fetchProjects(); 
    fetchCustomers(); 
    fetchEquipmentTypes();
    fetchDashboardStats();
    fetchGmailIntakes();
  }, [statusFilter, equipmentFilter, steelGradeFilter]);

  const syncRef = useRef(handleGmailSync);
  useEffect(() => {
    syncRef.current = handleGmailSync;
  }, [handleGmailSync]);

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== "http://127.0.0.1:8000") return;
      if (event.data === "gmail_auth_success") {
        syncRef.current();
      }
    };
    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, []);

  useEffect(() => {
    if (currentView === "dashboard") {
      fetchDashboardStats();
    }
  }, [currentView]);

  // Automatically select the first email if list is not empty and nothing is selected
  useEffect(() => {
    if (gmailIntakes.length > 0 && !selectedIntakeId) {
      setSelectedIntakeId(gmailIntakes[0].id);
    }
  }, [gmailIntakes, selectedIntakeId]);

  // Debug log for Gmail intake selection state
  useEffect(() => {
    console.log("[DEBUG] Gmail Intake Selection State:", {
      selectedIntakeId,
      isConverting,
      totalIntakes: gmailIntakes.length,
      buttonDisabled: isConverting || (gmailIntakes.length === 0)
    });
  }, [selectedIntakeId, isConverting, gmailIntakes]);

  useEffect(() => {
    if (selectedProject) {
      setStatusInput(selectedProject.status || "검토중");
      setActualQuoteInput(
        selectedProject.actual_quote_price !== null && selectedProject.actual_quote_price !== undefined
          ? selectedProject.actual_quote_price.toLocaleString()
          : (selectedProject.total_amount !== null && selectedProject.total_amount !== undefined ? selectedProject.total_amount.toLocaleString() : "")
      );
      setBidInput(selectedProject.bid_price !== null && selectedProject.bid_price !== undefined ? selectedProject.bid_price.toLocaleString() : "");
      setCompetitorInput(selectedProject.competitor_name || "");
      setWinningPriceInput(selectedProject.winning_price !== null && selectedProject.winning_price !== undefined ? selectedProject.winning_price.toLocaleString() : "");
      
      // Initialize edit fields
      setEditTitle(selectedProject.title || "");
      setEditCustomerName(selectedProject.customer?.name || "");
      setEditLineName(selectedProject.line_name || "");
      setEditSteelGrade(selectedProject.steel_grade || "");
      setEditEquipmentType(selectedProject.equipment_type || "");
      setEditTotalAmount(selectedProject.total_amount ? selectedProject.total_amount.toLocaleString() : "");
      setEditMarginRate(selectedProject.margin_rate ? selectedProject.margin_rate.toString() : "");
      
      setEditSpeed(selectedProject.specs?.speed || "");
      setEditPlcType(selectedProject.specs?.plc_type || "");
      setEditCommType(selectedProject.specs?.comm_type || "");
      setEditEnvironment(selectedProject.specs?.environment || "");
      
      // Hydrate quote data
      if (selectedProject.specs?.ai_extracted_data) {
        let aiData = selectedProject.specs.ai_extracted_data;
        if (typeof aiData === 'string') {
          try {
            aiData = JSON.parse(aiData);
          } catch (e) {
            console.error("Failed to parse ai_extracted_data:", e);
          }
        }
        
        console.log("Hydrating with aiData:", aiData);
        setExtractedData(aiData?.extractedData || null);
        setQuoteItems(aiData?.quoteItems || []);

        if (aiData?.extractedData?.extracted_tables && aiData?.quoteItems) {
            const rows = aiData.extractedData.extracted_tables.length > 1 ? aiData.extractedData.extracted_tables.slice(1) : aiData.extractedData.extracted_tables;
            const items = aiData.quoteItems.map((qi: any, idx: number) => ({
                name: rows[idx]?.[1] || '품목', // 'Description' or similar
                specification: rows[idx]?.[2] || '-', // 'Specification' or similar
                quantity: qi.quantity || 1,
                unit_price: qi.unitPrice || 0,
                total_price: (qi.quantity || 1) * (qi.unitPrice || 0)
            }));
            const total = items.reduce((acc: number, i: any) => acc + i.total_price, 0);
            setQuoteData({
                items,
                total_amount: total,
                scope_of_supply: ["시스템 구축 및 현장 설치", "시운전 및 성능 검수", "담당자 사용자 교육 1회"],
                exclusions: ["현장 토목/건축 공사", "1차 전원 간선 공사"],
                conditions: ["계약금 30%, 중도금 40%, 잔금 30%", "납기: 발주 후 12주 이내"]
            });
        }
      } else {
        setQuoteItems([]);
        setExtractedData(null);
        setQuoteData(null);
      }

      setIsEditing(false); // Default to read-only when project changes
    }
  }, [selectedProject]);

  useEffect(() => {
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile);
      setFilePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else setFilePreviewUrl(null);
  }, [uploadedFile]);

  useEffect(() => {
    if (selectedProject && activeTab === "vendor") {
      fetch(`http://127.0.0.1:8000/api/vendors/compare/${selectedProject.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setVendorData(d));
    }
  }, [selectedProject, activeTab]);

  const toggleFilter = (setF: any, fList: string[], val: string) => fList.includes(val) ? setF(fList.filter(i => i !== val)) : setF([...fList, val]);
  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "수주": return "bg-green-100 text-green-800 border-green-200";
      case "견적제출": return "bg-blue-100 text-blue-800 border-blue-200";
      case "실주": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const startExtraction = async () => {
    if (!uploadedFile || !draftProject.customer_name || !draftProject.equipment_type) {
      return alert("발주처, 설비 종류 및 사양서 파일을 모두 입력/업로드해주세요.");
    }
    setIsQuoteModalOpen(true);
    setModalStep(2);
    const formData = new FormData(); 
    formData.append("file", uploadedFile);
    formData.append("customer", draftProject.customer_name);
    formData.append("equipment_type", draftProject.equipment_type);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/projects/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        console.log("extracted_tables", data.extracted_tables);
        setExtractedData(data);
        if (data.extracted_tables && Array.isArray(data.extracted_tables)) {
          // 헤더를 제외한 나머지 행들에 대해 입력 폼 초기화
          const dataRows = data.extracted_tables.length > 1 ? data.extracted_tables.slice(1) : data.extracted_tables;
          setQuoteItems(dataRows.map(() => ({ unitPrice: 0, quantity: 1 })));
        }
        setDraftProject(p => ({ 
          ...p, 
          title: data.title || p.title, 
          line_name: data.line_name || p.line_name, 
          steel_grade: data.steel_grade || p.steel_grade, 
          equipment_type: data.equipment_type || p.equipment_type 
        }));
        setDraftSpecs({ speed: data.speed, plc_type: data.plc_type, comm_type: data.comm_type, environment: data.environment });
        setModalStep(3);
      } else {
        alert("추출 오류");
        setIsQuoteModalOpen(false);
        setModalStep(1);
      }
    } catch { 
      alert("추출 오류"); 
      setIsQuoteModalOpen(false); 
      setModalStep(1); 
    }
  };

  const generateQuote = async () => {
    // 수동 입력을 위해 바로 다음 단계로 이동
    setModalStep(4);
  };

  const saveProject = async () => {
    const payload = { 
      ...draftProject, 
      specs: { 
        ...draftSpecs,
        ai_extracted_data: { quoteItems, extractedData }
      } 
    };
    console.log("Saving payload:", payload);
    const res = await fetch("http://127.0.0.1:8000/api/projects/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      setIsQuoteModalOpen(false); setModalStep(1); setUploadedFile(null);
      setDraftProject({title: "", line_name: "", steel_grade: "", equipment_type: "", customer_id: "", customer_name: "", status: "검토중"});
      setDraftSpecs({speed: "", plc_type: "", comm_type: "", environment: ""}); setRiskAlerts([]); setQuoteData(null);
      setExtractedData(null);
      fetchProjects();
      fetchEquipmentTypes();
    } else alert("저장 실패");
  };

  const handleDeleteProject = async (projectId?: string) => {
    if (!projectId) return;
    if (!confirm("정말 이 프로젝트를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedProject(null);
        fetchProjects();
        fetchEquipmentTypes();
        fetchDashboardStats();
      } else {
        alert("삭제에 실패했습니다.");
      }
    } catch (err) {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const saveProjectModifications = async () => {
    if (!selectedProject?.id) return;
    try {
      const payload = {
        title: editTitle,
        customer_name: editCustomerName,
        line_name: editLineName,
        steel_grade: editSteelGrade,
        equipment_type: editEquipmentType,
        total_amount: editTotalAmount ? parseFloat(editTotalAmount.replace(/,/g, "")) : null,
        margin_rate: editMarginRate ? parseFloat(editMarginRate) : null,
        specs: {
          speed: editSpeed,
          plc_type: editPlcType,
          comm_type: editCommType,
          environment: editEnvironment,
          ai_extracted_data: { quoteItems, extractedData }
        }
      };
      const res = await fetch(`http://127.0.0.1:8000/api/projects/${selectedProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updatedProject = await res.json();
        setSelectedProject(updatedProject);
        await fetchProjects();
        await fetchDashboardStats();
        setIsEditing(false);
        alert("프로젝트가 성공적으로 수정되었습니다.");
      } else {
        alert("수정 저장 실패");
      }
    } catch (err) {
      console.error("Error updating project:", err);
      alert("오류 발생");
    }
  };


  const saveCommercialResults = async () => {
    if (!selectedProject?.id) return;
    setIsSavingResults(true);
    try {
      const payload = {
        status: statusInput,
        actual_quote_price: actualQuoteInput ? parseFloat(actualQuoteInput.replace(/,/g, "")) : null,
        bid_price: bidInput ? parseFloat(bidInput.replace(/,/g, "")) : null,
        competitor_name: statusInput === "실주" ? competitorInput : null,
        winning_price: statusInput === "실주" && winningPriceInput ? parseFloat(winningPriceInput.replace(/,/g, "")) : null,
      };
      const res = await fetch(`http://127.0.0.1:8000/api/projects/${selectedProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updatedProject = await res.json();
        setSelectedProject(updatedProject);
        await fetchProjects();
        await fetchDashboardStats();
        alert("상업적 결과가 성공적으로 기록되었습니다.");
      } else {
        alert("저장 실패");
      }
    } catch (err) {
      console.error("Error saving results:", err);
      alert("오류 발생");
    } finally {
      setIsSavingResults(false);
    }
  };

  const fillMockPhoneText = () => {
    setPhoneText(
      "현대제철 당진의 김과장입니다. 노후 마킹기 교체 건으로 서보 및 PLC(Profinet) 최신형 제어반 견적 요청합니다. 고속 마킹이 필요하고 현장에 분진이 다소 발생하는 환경입니다."
    );
  };

  const handlePhoneSubmit = async () => {
    if (!phoneText.trim()) return;
    setIsSummarizing(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/calls/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: phoneText }),
      });
      if (res.ok) {
        const data = await res.json();
        setTodayTasks(prev => [data, ...prev]);
        setPhoneText("");
      } else {
        alert("유선 문의 요약 분석에 실패했습니다.");
      }
    } catch (err) {
      console.error("Error summarizing call:", err);
      alert("서버 연결에 실패했습니다.");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Left Sidebar */}
      <aside className="w-68 bg-slate-900 text-white flex flex-col shrink-0 shadow-xl border-r border-slate-800 z-20">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-wider text-white">SteelOps</span>
            <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase">Sales ERP</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1.5 font-medium tracking-wide">자동화장비 영업 운영 플랫폼</span>
        </div>
        
        {/* Navigation Menus */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          <button 
            onClick={() => { setCurrentView('inquiry'); setSelectedProject(null); }} 
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all text-left ${currentView === 'inquiry' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            영업접수
          </button>
          
          <button 
            onClick={() => { setCurrentView('tech_review'); setSelectedProject(null); }} 
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all text-left ${currentView === 'tech_review' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            기술검토
          </button>
          
          <button 
            onClick={() => { setCurrentView('quote_bidding'); setSelectedProject(null); }} 
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all text-left ${currentView === 'quote_bidding' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            견적/입찰
          </button>
          
          <button 
            onClick={() => { setCurrentView('project_db'); setSelectedProject(null); }} 
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all text-left ${currentView === 'project_db' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            프로젝트DB
          </button>
          
          <button 
            onClick={() => { setCurrentView('dashboard'); setSelectedProject(null); }} 
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all text-left ${currentView === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            대시보드
          </button>
        </nav>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-850 bg-slate-950/40 text-center shrink-0 flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          <span className="text-[10px] text-slate-500 font-bold">수석비서 보좌 모드 활성</span>
        </div>
      </aside>

      {/* Right Content Pane Layout */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        
        {/* Top Header & Process Step Indicator */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center px-8 shrink-0 justify-between z-10 shadow-sm">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {currentView === 'inquiry' && "📞 영업 접수 및 고객사 CRM"}
              {currentView === 'tech_review' && "⚙️ AI 사양서 검토 & 분석 센터"}
              {currentView === 'quote_bidding' && "📄 견적산정 및 상업 입찰 업무"}
              {currentView === 'project_db' && "🗄️ 프로젝트 통합 데이터베이스"}
              {currentView === 'dashboard' && "📊 영업 통계 대시보드"}
            </h2>
          </div>
          
          {/* Sales Operations Workflow Progress Tracker */}
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 select-none">
            <div className={`flex items-center gap-1.5 transition-all ${currentView === 'inquiry' ? 'text-blue-600 font-black' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all ${currentView === 'inquiry' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>1</span>
              영업 접수
            </div>
            <svg className="w-3 h-3 text-slate-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            
            <div className={`flex items-center gap-1.5 transition-all ${currentView === 'tech_review' ? 'text-blue-600 font-black' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all ${currentView === 'tech_review' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>2</span>
              기술 검토
            </div>
            <svg className="w-3 h-3 text-slate-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            
            <div className={`flex items-center gap-1.5 transition-all ${currentView === 'quote_bidding' ? 'text-blue-600 font-black' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all ${currentView === 'quote_bidding' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>3</span>
              견적/입찰
            </div>
            <svg className="w-3 h-3 text-slate-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            
            <div className={`flex items-center gap-1.5 transition-all ${currentView === 'project_db' ? 'text-blue-600 font-black' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all ${currentView === 'project_db' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>4</span>
              수주/이력화
            </div>
          </div>
        </header>

        {/* Scrollable Work Container */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          
          {/* 1. 영업접수 View */}
          {currentView === 'inquiry' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start text-left">
              {/* Left Panel: Gmail Inquiry Intake */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6 flex flex-col justify-between min-h-[500px]">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        [지메일 견적 접수함]
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">대표 지메일 사서함으로 수신된 견적 요청 메일을 실시간 자동 확인 및 동기화합니다.</p>
                    </div>
                  </div>

                  {/* Gmail Auto Sync List */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/20">
                    <div className="overflow-y-auto max-h-[480px]">
                      <table className="min-w-full divide-y divide-slate-200 text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                          <tr>
                            <th className="px-4 py-3 text-left bg-slate-50">보낸 사람</th>
                            <th className="px-4 py-3 text-left bg-slate-50">메일 제목 / 요약</th>
                            <th className="px-4 py-3 text-left bg-slate-50">수신 날짜</th>
                            <th className="px-4 py-3 text-left bg-slate-50">첨부파일</th>
                            <th className="px-4 py-3 text-center bg-slate-50">상태</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                          {gmailIntakes.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-24 text-slate-400">
                                <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                수신된 지메일 견적 요청 메일이 없습니다.<br/>
                                <span className="text-[10px] text-slate-400 mt-1 block">[지메일 수동 동기화] 버튼을 눌러 메일을 즉시 가져오세요.</span>
                              </td>
                            </tr>
                          ) : (
                            gmailIntakes.map(intake => {
                              const isSelected = selectedIntakeId === intake.id;
                              const isApproved = intake.approval_status === "APPROVED";
                              return (
                                <tr 
                                  key={intake.id}
                                  onClick={() => setSelectedIntakeId(intake.id)}
                                  className={`transition-all cursor-pointer ${
                                    isSelected 
                                      ? "bg-blue-50/60 border-l-4 border-blue-500 font-semibold" 
                                      : isApproved 
                                        ? "opacity-75 bg-slate-50/30 hover:bg-slate-50/50" 
                                        : "hover:bg-slate-50/50"
                                  }`}
                                >
                                  <td className="px-4 py-3 font-semibold text-slate-900 truncate max-w-[120px]" title={intake.sender}>
                                    {intake.sender.split("@")[0]} <span className="text-[10px] text-slate-400 block font-normal">{intake.sender}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-slate-800">{intake.subject}</div>
                                    <div className="text-[10px] text-slate-400 truncate max-w-[280px] mt-0.5">{intake.snippet}</div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                                    {new Date(intake.received_at).toLocaleDateString("ko-KR", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {intake.attachment_name ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] rounded font-medium">
                                        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                        {intake.attachment_name}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 text-[10px]">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center whitespace-nowrap">
                                    {isApproved ? (
                                      <span className="inline-flex px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 text-[10px] rounded-full font-black">
                                        변환완료
                                      </span>
                                    ) : (
                                      <span className="inline-flex px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] rounded-full font-black">
                                        대기중
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                      {gmailNextPageToken && (
                        <div className="p-3 text-center bg-white border-t border-slate-100">
                          <button
                            onClick={handleLoadMoreGmail}
                            disabled={isLoadingMoreGmail}
                            className="px-4 py-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            {isLoadingMoreGmail ? (
                              <>
                                <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                불러오는 중...
                              </>
                            ) : (
                              <>
                                <span>더 보기</span>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Action buttons */}
                <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t border-slate-100">
                  <button 
                    onClick={handleGmailSync}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 rounded-md text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-1.5 border border-slate-200"
                  >
                    {isSyncing ? (
                      <>
                        <div className="animate-spin h-3.5 w-3.5 border-2 border-slate-700 border-t-transparent rounded-full"></div>
                        동기화 중...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m0 0l3 3m-3-3v12" />
                        </svg>
                        지메일 수동 동기화
                      </>
                    )}
                  </button>
                  <button 
                    onClick={handleGmailConvert}
                    disabled={isConverting || gmailIntakes.length === 0}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
                  >
                    {isConverting ? (
                      <>
                        <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></div>
                        카드 변환 중 (AI)...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        영업 업무 카드 변환 (AI)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Panel: Customer CRM Management */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      고객사 명부 관리 (CRM)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">플랫폼에 등록된 주요 발주처 정보입니다. 신규 고객사를 직접 등록할 수 있습니다.</p>
                  </div>
                </div>

                {/* Add New Customer Form */}
                <form onSubmit={registerCustomer} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">
                    {editingCustomer ? "고객사 정보 수정" : "신규 고객사 직접 등록"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">고객사명 *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="예: 포스코케미칼"
                        className="w-full border border-slate-200 h-8 px-2.5 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-800"
                        value={newCustomerName}
                        onChange={e => setNewCustomerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">담당자 성함</label>
                      <input 
                        type="text" 
                        placeholder="예: 이대리"
                        className="w-full border border-slate-200 h-8 px-2.5 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-800"
                        value={newCustomerContactPerson}
                        onChange={e => setNewCustomerContactPerson(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">담당자 연락처</label>
                      <input 
                        type="text" 
                        placeholder="예: 010-1234-5678"
                        className="w-full border border-slate-200 h-8 px-2.5 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-800"
                        value={newCustomerContactNumber}
                        onChange={e => setNewCustomerContactNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">이메일 주소</label>
                      <input 
                        type="email" 
                        placeholder="예: contact@company.com"
                        className="w-full border border-slate-200 h-8 px-2.5 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-800"
                        value={newCustomerEmail}
                        onChange={e => setNewCustomerEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="text-right flex justify-end gap-2">
                    {editingCustomer && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingCustomer(null);
                          setNewCustomerName("");
                          setNewCustomerContactPerson("");
                          setNewCustomerContactNumber("");
                          setNewCustomerEmail("");
                        }}
                        className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-705 rounded text-xs font-bold transition shadow-sm"
                      >
                        수정 취소
                      </button>
                    )}
                    <button 
                      type="submit" 
                      disabled={isRegisteringCustomer}
                      className={`px-4 py-1.5 ${editingCustomer ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded text-xs font-bold disabled:opacity-50 transition shadow-sm`}
                    >
                      {isRegisteringCustomer 
                        ? (editingCustomer ? '수정 중...' : '등록 중...') 
                        : (editingCustomer ? '수정 완료' : '고객사 등록')}
                    </button>
                  </div>
                </form>

                {/* Customer List table/list */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-[300px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 text-left">고객사ID</th>
                        <th className="px-4 py-2.5 text-left">고객사명</th>
                        <th className="px-4 py-2.5 text-left">담당자</th>
                        <th className="px-4 py-2.5 text-left">연락처</th>
                        <th className="px-4 py-2.5 text-left">이메일</th>
                        <th className="px-4 py-2.5 text-center w-24">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {customers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-400 italic">등록된 고객사 정보가 없습니다.</td>
                        </tr>
                      ) : (
                        customers.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2 font-mono text-[10px] text-slate-400">{c.id.slice(0, 8)}...</td>
                            <td className="px-4 py-2 font-bold text-slate-900">{c.name}</td>
                            <td className="px-4 py-2">{c.contact_person || '-'}</td>
                            <td className="px-4 py-2 font-mono text-slate-600">{c.contact_number || '-'}</td>
                            <td className="px-4 py-2 font-mono text-slate-600">{c.email || '-'}</td>
                            <td className="px-4 py-2 text-center flex justify-center items-center gap-2">
                              <button 
                                onClick={() => handleEditCustomer(c)}
                                className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-indigo-50 transition"
                                title="수정"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button 
                                onClick={() => handleDeleteCustomer(c.id)}
                                className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                                title="삭제"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. 기술검토 View */}
          {currentView === 'tech_review' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start text-left">
              {/* Left Panel: Upload Specification for AI Analysis */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div className="border-b pb-4">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    자율주행 및 자동화 설비 사양서 업로드 (AI 분석)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">장비 사양서 파일을 드래그 앤 드롭하여 업로드하면 AI가 제원을 자동으로 파싱합니다.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">발주처 선택 (고객사)</label>
                    <input
                      type="text"
                      list="customers-list-tech"
                      placeholder="발주처명을 입력하세요 (예: 자율주행 주식회사)"
                      className="w-full border border-slate-200 p-2.5 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 bg-white"
                      value={draftProject.customer_name || ""}
                      onChange={(e) => setDraftProject({ ...draftProject, customer_name: e.target.value })}
                    />
                    <datalist id="customers-list-tech">
                      {customers.map(c => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">설비 (기계) 종류 입력</label>
                    <input
                      type="text"
                      placeholder="설비 종류를 입력하세요 (예: 자율주행 로봇 플랫폼)"
                      className="w-full border border-slate-200 p-2.5 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 bg-white"
                      value={draftProject.equipment_type || ""}
                      onChange={(e) => setDraftProject({ ...draftProject, equipment_type: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">사양서 파일</label>
                    <div
                      className="border-2 border-dashed border-slate-200 p-8 rounded-lg text-center cursor-pointer hover:bg-slate-50 transition-all bg-slate-50/50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <p className="font-bold text-xs text-slate-655 mb-1">{uploadedFile ? uploadedFile.name : "사양서 드래그 앤 드롭 또는 클릭하여 업로드"}</p>
                      <span className="text-[10px] text-slate-400">PDF, 도면 이미지 지원 (최대 10MB)</span>
                      <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => setUploadedFile(e.target.files?.[0] || null)} />
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <button 
                      onClick={startExtraction} 
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-md flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      AI 사양서 분석 및 4단계 리포트 발행
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Panel: Pending Tech Review Projects */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div className="border-b pb-4">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    기술 검토 진행 중인 프로젝트 ({projects.filter(p => p.status === '검토중').length}건)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">현재 기술 검토가 진행 중이며 사양 보완 및 리스크 점검이 필요한 리스트입니다.</p>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {projects.filter(p => p.status === '검토중').length === 0 ? (
                    <div className="text-center py-12 text-slate-400 italic text-xs">
                      현재 기술 검토 단계에 있는 프로젝트가 없습니다.
                    </div>
                  ) : (
                    projects.filter(p => p.status === '검토중').map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => { loadProjectDetails(p); setActiveTab("specs"); }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${selectedProject?.id === p.id ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-300' : 'bg-slate-50 hover:bg-slate-100/50 border-slate-200'}`}
                      >
                        <div className="flex justify-between items-start mb-2.5">
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="text-[10px] text-blue-600 font-bold block mb-0.5">{p.customer?.name}</span>
                            <h4 className="text-xs font-bold text-slate-900 truncate">{p.title}</h4>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                loadProjectDetails(p);
                                setIsEditing(true);
                              }}
                              title="수정"
                              className="p-1 text-slate-400 hover:text-blue-650 hover:bg-slate-100 rounded transition"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(p.id);
                              }}
                              title="삭제"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] rounded font-black shrink-0 ml-1">기술 검토중</span>
                          </div>
                        </div>
                        
                        <div className="bg-white p-3 rounded-lg border border-slate-200/60 space-y-1.5 text-xs text-slate-600">
                          <div className="flex justify-between"><span className="text-slate-400 font-medium">설비종류</span><span className="font-semibold text-slate-800">{p.equipment_type || '-'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400 font-medium">제어반 PLC</span><span className="font-semibold text-slate-800">{p.specs?.plc_type || '미기재 (추출 필요)'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400 font-medium">주행환경</span><span className="font-bold text-amber-600">{p.specs?.environment || '미기재 (추출 필요)'}</span></div>
                        </div>

                        <div className="mt-3 flex justify-between items-center">
                          <span className="text-[10px] text-slate-400 font-mono">접수일: {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              loadProjectDetails(p);
                              setCurrentView('quote_bidding');
                            }}
                            className="text-[10px] font-bold text-indigo-650 hover:text-indigo-800 flex items-center gap-0.5"
                          >
                            견적 산정 단계로 이동 →
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. 견적/입찰 View */}
          {currentView === 'quote_bidding' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start text-left">
              {/* Left Column: List of Projects for Pricing */}
              <div className="xl:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div className="border-b pb-4">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    견적 대상 프로젝트 선택
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">상업적 결과를 입력하거나 정밀 견적 시뮬레이션을 진행할 대상을 선택하십시오.</p>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {projects.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 italic text-xs">
                      현재 등록된 프로젝트가 없습니다.
                    </div>
                  ) : (
                    projects.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => { loadProjectDetails(p); setActiveTab("specs"); }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedProject?.id === p.id ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-300' : 'bg-slate-50 hover:bg-slate-100/50 border-slate-200'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="text-[10px] text-blue-600 font-bold block mb-0.5">{p.customer?.name}</span>
                            <h4 className="text-xs font-bold text-slate-900 leading-tight truncate">{p.title}</h4>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                loadProjectDetails(p);
                                setIsEditing(true);
                              }}
                              title="수정"
                              className="p-1 text-slate-400 hover:text-blue-655 hover:bg-slate-100 rounded transition"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(p.id);
                              }}
                              title="삭제"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                            <span className={`px-2 py-0.5 text-[9px] rounded font-black border shrink-0 ml-1 ${getStatusColor(p.status)}`}>{p.status}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] bg-white p-2 rounded border border-slate-200/50 text-slate-500">
                          <div>AI 추천가: <span className="font-mono font-bold text-slate-700">{p.total_amount ? `₩${p.total_amount.toLocaleString()}` : '-'}</span></div>
                          <div>실제 견적: <span className="font-mono font-bold text-blue-700">{p.actual_quote_price ? `₩${p.actual_quote_price.toLocaleString()}` : '-'}</span></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Center and Right Columns: Pricing Workspace */}
              <div className="xl:col-span-2 space-y-8">
                {!selectedProject ? (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                    <svg className="w-16 h-16 text-slate-300 mb-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <h3 className="text-base font-bold text-slate-700">견적/입찰 업무 작업실</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">좌측 목록에서 프로젝트를 선택하시면 AI 견적서 초안, 협력사 매트릭스 비교, 수주/실주 등 상업적 결과 입력을 원스톱으로 처리할 수 있습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Workspace Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                      <div className="flex justify-between items-center border-b pb-4">
                        <div>
                          <span className="text-xs text-blue-600 font-bold block">{selectedProject.customer?.name} 귀하</span>
                          <h3 className="text-base font-bold text-slate-800">{selectedProject.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={generateQuote}
                            className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md text-xs font-bold hover:bg-indigo-100 transition shadow-sm"
                          >
                            ⚙️ AI 견적서 초안 자동 빌드
                          </button>
                        </div>
                      </div>

                      {/* Commercial Result Recording */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-4 bg-emerald-600 rounded-sm"></span>
                          실제 상업적 결과 기록
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">진행 상태</label>
                            <select 
                              className="w-full border border-slate-200 h-9 px-2.5 rounded-lg bg-white text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-medium"
                              value={statusInput}
                              onChange={(e) => setStatusInput(e.target.value)}
                            >
                              <option value="검토중">검토중</option>
                              <option value="견적제출">견적제출</option>
                              <option value="수주">수주</option>
                              <option value="실주">실주</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">최종 견적 제출 금액 (₩)</label>
                            <input 
                              type="text"
                              className="w-full border border-slate-200 h-9 px-2.5 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-mono font-bold"
                              placeholder="금액 입력"
                              value={actualQuoteInput}
                              onChange={handleMoneyInputChange(setActualQuoteInput)}
                            />
                            {actualQuoteInput && (
                              <div className="text-[10px] text-slate-500 mt-1 font-semibold leading-tight">
                                {convertToKoreanWon(actualQuoteInput)}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">최종 투찰 금액 (₩)</label>
                            <input 
                              type="text"
                              className="w-full border border-slate-200 h-9 px-2.5 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-mono font-bold"
                              placeholder="금액 입력"
                              value={bidInput}
                              onChange={handleMoneyInputChange(setBidInput)}
                            />
                            {bidInput && (
                              <div className="text-[10px] text-slate-500 mt-1 font-semibold leading-tight">
                                {convertToKoreanWon(bidInput)}
                              </div>
                            )}
                          </div>
                        </div>

                        {statusInput === "실주" && (
                          <div className="p-4 bg-red-50/50 rounded-xl border border-red-100 space-y-3.5 animate-slide-down text-left">
                            <h5 className="text-xs font-bold text-red-800">실주 분석 피드백 입력</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-semibold text-red-700 mb-1">낙찰 경쟁사명</label>
                                <input 
                                  type="text"
                                  className="w-full border border-red-200 h-9 px-2.5 rounded-lg text-xs focus:ring-2 focus:ring-red-500 outline-none text-slate-800"
                                  placeholder="경쟁사 이름"
                                  value={competitorInput}
                                  onChange={(e) => setCompetitorInput(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-red-700 mb-1">경쟁사 낙찰가 (₩)</label>
                                <input 
                                  type="text"
                                  className="w-full border border-red-200 h-9 px-2.5 rounded-lg text-xs focus:ring-2 focus:ring-red-500 outline-none text-slate-800 font-mono font-bold"
                                  placeholder="금액 입력"
                                  value={winningPriceInput}
                                  onChange={handleMoneyInputChange(setWinningPriceInput)}
                                />
                                {winningPriceInput && (
                                  <div className="text-[10px] text-red-700 mt-1 font-semibold leading-tight">
                                    {convertToKoreanWon(winningPriceInput)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="text-right">
                          <button 
                            onClick={saveCommercialResults}
                            disabled={isSavingResults}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition shadow-md"
                          >
                            {isSavingResults ? "저장 중..." : "✓ 상업적 결과 저장"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* AI Vendor Matrix Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                      <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-4 bg-indigo-600 rounded-sm"></span>
                        AI 협력사 단가 비교 매트릭스
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-bold border-b">
                              <th className="p-3">부품 품명</th>
                              <th className="p-3">최저가 제안 협력사 (단가)</th>
                              <th className="p-3 text-center">최단 납기 제안</th>
                              <th className="p-3">비고</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            <tr>
                              <td className="p-3 font-semibold text-slate-800">주제어 PLC (Siemens S7-1500)</td>
                              <td className="p-3 font-bold text-slate-900">B사 (직판) <span className="text-[10px] text-green-600 font-normal ml-1">₩11,500,000</span></td>
                              <td className="p-3 text-center text-blue-700 font-bold">C사 (7일)</td>
                              <td className="p-3 text-slate-400">재고 현황 실시간 모니터링 필요</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-semibold text-slate-800">서보 모터 & 드라이브 세트</td>
                              <td className="p-3 font-bold text-slate-900">B사 <span className="text-[10px] text-green-600 font-normal ml-1">₩8,200,000</span></td>
                              <td className="p-3 text-center text-blue-700 font-bold">C사 (10일)</td>
                              <td className="p-3 text-slate-400">케이블 10m 별도 구매 요망</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-semibold text-slate-800">산업용 비전 카메라 (20M)</td>
                              <td className="p-3 font-bold text-slate-900">E사 <span className="text-[10px] text-green-600 font-normal ml-1">₩4,800,000</span></td>
                              <td className="p-3 text-center text-blue-700 font-bold">D사 (14일)</td>
                              <td className="p-3 text-slate-400">조명 일체형 스펙 확인</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Quotation Preview Card */}
                    {quoteData ? (
                      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8 text-left space-y-6">
                        <div className="flex justify-between items-start border-b pb-4">
                          <div>
                            <h4 className="text-base font-bold text-slate-800">공식 견적서 초안 (Quotation Preview)</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">시스템에서 자동 생성된 품명별 단가 내역서입니다.</p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 border text-slate-600 rounded font-mono font-bold">표준 양식</span>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex justify-between items-center">
                          <span className="text-xs text-slate-700 font-bold">총 공급가액 (VAT 별도):</span>
                          <span className="text-xl font-black text-blue-700">₩{quoteData.total_amount.toLocaleString()}</span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs text-left border-collapse border border-slate-100">
                            <thead>
                              <tr className="bg-slate-50 border-b">
                                <th className="p-2 border-r">품명</th>
                                <th className="p-2 border-r">규격 및 사양</th>
                                <th className="p-2 text-center w-12 border-r">수량</th>
                                <th className="p-2 text-right border-r">단가</th>
                                <th className="p-2 text-right">합계</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {quoteData.items.map((it, idx) => (
                                <tr key={idx}>
                                  <td className="p-2 border-r font-bold text-slate-900">{it.name}</td>
                                  <td className="p-2 border-r text-slate-500 font-normal">{it.specification}</td>
                                  <td className="p-2 text-center border-r">{it.quantity}</td>
                                  <td className="p-2 text-right border-r font-mono">₩{it.unit_price.toLocaleString()}</td>
                                  <td className="p-2 text-right font-mono font-bold">₩{it.total_price.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed rounded-xl p-8 text-center text-slate-400 text-xs">
                        견적서 데이터를 등록하려면 버튼을 클릭하십시오.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. 프로젝트DB View (Formerly Quote History Search) */}
          {currentView === 'project_db' && (
            <>
              <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 mb-6 space-y-4 shrink-0 text-left">
                <form onSubmit={(e) => { e.preventDefault(); fetchProjects(); }} className="flex items-end gap-4">
                  <div className="flex-1"><label className="block text-xs font-semibold text-slate-700 mb-1">통합 검색어</label><input type="text" placeholder="검색..." className="w-full border p-2 rounded-md text-xs focus:ring-1 focus:ring-blue-500 outline-none" value={keywordFilter} onChange={(e) => setKeywordFilter(e.target.value)} /></div>
                  <div className="w-48"><label className="block text-xs font-semibold text-slate-700 mb-1">상태 필터</label><select className="w-full border p-2 rounded-md text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">전체 상태</option><option value="검토중">검토중</option><option value="견적제출">견적제출</option><option value="수주">수주</option><option value="실주">실주</option></select></div>
                  <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md text-xs font-bold h-[38px] shadow-sm hover:bg-blue-700 transition">검색</button>
                </form>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t">
                  <div>
                    <label className="block text-xs font-semibold mb-2">설비 종류 다중 선택</label>
                    <div className="flex gap-2 flex-wrap">
                      {(equipmentTypes.length > 0 ? equipmentTypes : ["마킹기", "밴딩기", "결속기"]).map(eq => (
                        <button
                          key={eq}
                          onClick={() => toggleFilter(setEquipmentFilter, equipmentFilter, eq)}
                          className={`px-3 py-1 text-[10px] rounded-full border transition-all ${equipmentFilter.includes(eq) ? 'bg-blue-100 border-blue-400 font-bold text-blue-800' : 'bg-white'}`}
                        >
                          {eq}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div><label className="block text-xs font-semibold mb-2">적용 강종 다중 선택</label><div className="flex gap-2 flex-wrap">{["열연", "냉연", "후판"].map(sg => <button key={sg} onClick={() => toggleFilter(setSteelGradeFilter, steelGradeFilter, sg)} className={`px-3 py-1 text-[10px] rounded-full border transition-all ${steelGradeFilter.includes(sg) ? 'bg-slate-800 text-white border-slate-800 font-bold' : 'bg-white'}`}>{sg}</button>)}</div></div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50 sticky top-0 z-0">
                      <tr><th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">상태</th><th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">견적일</th><th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">고객사</th><th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">프로젝트명</th><th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">상업 금액 분석</th><th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">마진율</th><th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">관리</th></tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {loading ? <tr><td colSpan={7} className="text-center py-10 text-xs">로딩중...</td></tr> : 
                        projects.map(p => {
                          const lowMargin = p.margin_rate !== null && p.margin_rate < 20;
                          return (
                            <tr key={p.id} onClick={() => { loadProjectDetails(p); setActiveTab("specs"); }} className={`cursor-pointer ${lowMargin ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-blue-50'} ${selectedProject?.id === p.id ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : ''}`}>
                              <td className="px-6 py-4"><span className={`px-2.5 py-1 text-[10px] rounded-full border ${getStatusColor(p.status)}`}>{p.status}</span></td>
                              <td className="px-6 py-4 text-xs text-slate-600">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</td>
                              <td className="px-6 py-4 text-xs"><div className="font-semibold">{p.customer?.name}</div></td>
                              <td className="px-6 py-4 text-xs font-semibold">{p.title}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-col items-end text-[10px] space-y-0.5 font-medium">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold shrink-0">🤖 AI추천</span>
                                    <span className="text-slate-700 font-mono">{p.total_amount ? `${p.total_amount.toLocaleString()}원` : '-'}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold shrink-0">✍️ 실견적</span>
                                    <span className="text-slate-800 font-bold font-mono">{p.actual_quote_price ? `${p.actual_quote_price.toLocaleString()}원` : '-'}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold shrink-0">🎯 입찰가</span>
                                    <span className="text-indigo-900 font-bold font-mono">{p.bid_price ? `${p.bid_price.toLocaleString()}원` : '-'}</span>
                                  </div>
                                </div>
                              </td>
                              <td className={`px-6 py-4 text-xs text-right font-bold ${lowMargin ? 'text-red-600' : ''}`}>{lowMargin && "⚠️"}{p.margin_rate ? `${p.margin_rate}%` : '-'}</td>
                              <td className="px-6 py-4 text-right text-xs" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <button 
                                    onClick={() => {
                                      loadProjectDetails(p);
                                      setIsEditing(true);
                                    }}
                                    title="수정"
                                    className="p-1 text-slate-400 hover:text-blue-650 hover:bg-slate-100 rounded transition"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteProject(p.id)}
                                    title="삭제"
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 5. 대시보드 View */}
          {currentView === 'dashboard' && (
            <div className="flex-1 flex flex-col gap-6 w-full py-2">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 content-start text-left">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">견적 제출 수</div>
                  <div className="text-xl font-bold text-slate-800">
                    {dashboardStats ? `${dashboardStats.submitted_quotes_count}건` : "로딩중..."}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-2 font-medium">누적 제출 기준</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">수주 성공률</div>
                  <div className="text-xl font-bold text-blue-600">
                    {dashboardStats ? `${dashboardStats.winning_rate}%` : "로딩중..."}
                  </div>
                  <div className="text-[9px] text-blue-500 mt-2 font-medium">수주 / (수주+실주)</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">AI 업무 시간 절감</div>
                  <div className="text-xl font-bold text-indigo-600">
                    {dashboardStats ? `${dashboardStats.time_saved_hours}시간` : "로딩중..."}
                  </div>
                  <div className="text-[9px] text-indigo-500 mt-2 font-medium">건당 3.5시간 절감</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">평균 마진율</div>
                  <div className="text-xl font-bold text-slate-800">
                    {dashboardStats ? `${dashboardStats.avg_margin_rate}%` : "로딩중..."}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-2 font-medium">목표 마진율: 25%</div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                  <h3 className="text-slate-800 text-xs font-black mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-blue-600 rounded-sm"></span>
                    주간 수주 금액 트렌드 (최근 5주)
                  </h3>
                  <div className="flex-1 min-h-[250px] flex items-center justify-center">
                    {dashboardStats ? (
                      <WeeklyTrendChart trends={dashboardStats.weekly_trends} />
                    ) : (
                      <span className="text-slate-400 text-xs">데이터 로딩중...</span>
                    )}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                  <h3 className="text-slate-800 text-xs font-black mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-emerald-600 rounded-sm"></span>
                    발주처별 수주 / 실주 현황 (건수)
                  </h3>
                  <div className="flex-1 min-h-[250px] flex items-center justify-center">
                    {dashboardStats ? (
                      <CustomerRatioChart ratios={dashboardStats.customer_ratios} />
                    ) : (
                      <span className="text-slate-400 text-xs">데이터 로딩중...</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Slide-in Panel (Only visible in Project DB View with selectedProject) */}
        <div className={`fixed top-16 right-0 bottom-0 w-[45rem] bg-white border-l border-slate-200 shadow-2xl transition-transform duration-300 z-10 flex flex-col ${selectedProject ? 'translate-x-0' : 'translate-x-full'}`}>
          {selectedProject && (
            <>
              <div className="p-8 pb-4 shrink-0 bg-white z-20 text-left">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-sm font-semibold text-blue-600 mb-1 flex items-center gap-2">
                      {selectedProject.customer?.name}
                      {isEditing && <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">수정 모드</span>}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 leading-tight">{selectedProject.title}</h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isEditing ? (
                      <button 
                        onClick={() => setIsEditing(true)} 
                        className="text-blue-650 hover:bg-slate-100 px-3 py-1.5 rounded-md text-sm font-semibold border border-slate-250 transition flex items-center gap-1 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        수정 모드 전환
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={saveProjectModifications} 
                          className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-md text-sm font-semibold border border-emerald-250 transition flex items-center gap-1 font-bold cursor-pointer"
                        >
                          저장
                        </button>
                        <button 
                          onClick={() => setIsEditing(false)} 
                          className="text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-md text-sm font-semibold border border-slate-200 transition cursor-pointer"
                        >
                          취소
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => handleDeleteProject(selectedProject.id)} 
                      className="text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-md text-sm font-semibold border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      삭제
                    </button>
                    <button onClick={() => setSelectedProject(null)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full cursor-pointer"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </div>
                
                {/* Tabs */}
                {!isEditing && (
                  <div className="flex border-b border-slate-200">
                    <button onClick={() => setActiveTab("specs")} className={`pb-3 px-4 font-semibold text-sm transition-colors cursor-pointer ${activeTab === "specs" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}>상세 사양 (Specs)</button>
                    <button onClick={() => setActiveTab("vendor")} className={`pb-3 px-4 font-semibold text-sm transition-colors flex items-center gap-2 cursor-pointer ${activeTab === "vendor" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}>
                      협력사 비교 매트릭스 <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full">AI</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-4 bg-slate-50">
                {isEditing ? (
                  /* Editing Mode Form */
                  <div className="space-y-6 text-left">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                      <h3 className="font-bold border-b pb-2 mb-2 text-slate-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        기본 정보 수정
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-500 mb-1">프로젝트명</label>
                          <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">발주처명 (고객사)</label>
                          <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">설비 종류</label>
                          <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={editEquipmentType} onChange={e => setEditEquipmentType(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">설치 라인명</label>
                          <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={editLineName} onChange={e => setEditLineName(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">적용 강종</label>
                          <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={editSteelGrade} onChange={e => setEditSteelGrade(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">총 견적가 (₩)</label>
                          <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold bg-white" value={editTotalAmount} onChange={handleMoneyInputChange(setEditTotalAmount)} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">마진율 (%)</label>
                          <input type="number" className="w-full border border-slate-200 p-2.5 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={editMarginRate} onChange={e => setEditMarginRate(e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                      <h3 className="font-bold border-b pb-2 mb-2 text-slate-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-650" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                        기술 사양 수정
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">생산 속도</label>
                          <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={editSpeed} onChange={e => setEditSpeed(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">제어반 (PLC)</label>
                          <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={editPlcType} onChange={e => setEditPlcType(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">통신 프로토콜</label>
                          <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={editCommType} onChange={e => setEditCommType(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">동작 환경</label>
                          <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={editEnvironment} onChange={e => setEditEnvironment(e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4">
                      <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer">취소</button>
                      <button onClick={saveProjectModifications} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-lg text-xs transition shadow-md cursor-pointer">수정사항 저장</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {activeTab === "specs" && (
                      <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg border">
                        <div className="text-xs text-slate-500 mb-1">발주처</div>
                        <div className="text-lg font-bold text-slate-800">{selectedProject.customer?.name || '-'}</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border">
                        <div className="text-xs text-slate-500 mb-1">설비 종류</div>
                        <div className="text-lg font-bold text-slate-800">{selectedProject.equipment_type || '-'}</div>
                      </div>
                    </div>
                    
                    {quoteData && quoteData.items.length > 0 && (
                      <div className="bg-white border rounded-lg p-5">
                        <h3 className="font-bold border-b pb-2 mb-4 text-slate-800">사양서 리포트 (견적 내역)</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs text-left border-collapse border border-slate-100">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="p-2 border border-slate-200">품명</th>
                                <th className="p-2 text-center w-12 border border-slate-200">수량</th>
                                <th className="p-2 text-right border border-slate-200">단가 (₩)</th>
                                <th className="p-2 text-right border border-slate-200">합계 (₩)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {quoteData.items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="p-2 border border-slate-200 font-bold text-slate-900">{it.name}</td>
                                  <td className="p-2 text-center border border-slate-200">{it.quantity}</td>
                                  <td className="p-2 text-right border border-slate-200 font-mono">{it.unit_price.toLocaleString()}</td>
                                  <td className="p-2 text-right border border-slate-200 font-mono font-bold text-blue-700">{it.total_price.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-4 flex justify-between items-center bg-blue-50/50 border border-blue-100 p-3 rounded-lg text-sm">
                           <span className="font-bold text-slate-700">총 견적가 (VAT 별도)</span>
                           <span className="font-black text-blue-700 text-lg">₩ {quoteData.total_amount.toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg border">
                        <div className="text-xs text-slate-500 mb-1">마진율</div>
                        <div className="text-xl font-bold">{selectedProject.margin_rate || '-'}%</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border">
                        <div className="text-xs text-slate-500 mb-1">최종 투찰 금액</div>
                        <div className="text-xl font-bold text-emerald-700">₩ {selectedProject.bid_price?.toLocaleString() || '-'}</div>
                      </div>
                    </div>
                    <div className="bg-white border rounded-lg p-5">
                      <h3 className="font-bold border-b pb-2 mb-4 text-slate-800">기술 사양</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between py-1 border-b border-dashed"><span className="text-slate-500">생산 속도</span><span className="font-semibold">{selectedProject.specs?.speed || '-'}</span></div>
                        <div className="flex justify-between py-1 border-b border-dashed"><span className="text-slate-500">제어반 (PLC)</span><span className="font-semibold">{selectedProject.specs?.plc_type || '-'}</span></div>
                        <div className="flex justify-between py-1 border-b border-dashed"><span className="text-slate-500">설치 환경</span><span className="font-bold text-amber-600">{selectedProject.specs?.environment || '-'}</span></div>
                      </div>
                    </div>

                    {/* Divider and Commercial Results Section */}
                    <hr className="my-6 border-t border-slate-200" />

                    <div className="bg-white border rounded-lg p-5">
                      <h3 className="font-bold border-b pb-2 mb-4 text-slate-800 flex items-center gap-2 text-base">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        상업적 결과 기록
                      </h3>
                      <div className="space-y-3.5 text-left">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">진행 상태 선택</label>
                          <select 
                            className="w-full border border-slate-200 h-9 px-2 rounded-md bg-white text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-medium"
                            value={statusInput}
                            onChange={(e) => setStatusInput(e.target.value)}
                          >
                            <option value="검토중">검토중</option>
                            <option value="견적제출">견적제출</option>
                            <option value="수주">수주</option>
                            <option value="실주">실주</option>
                          </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">최종 견적 제출 금액 (₩)</label>
                            <input 
                              type="text"
                              className="w-full border border-slate-200 h-9 px-2.5 rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                              placeholder="금액 입력"
                              value={actualQuoteInput}
                              onChange={handleMoneyInputChange(setActualQuoteInput)}
                            />
                            {actualQuoteInput && (
                              <div className="text-[10px] text-slate-500 mt-1 font-semibold select-none leading-tight">
                                {convertToKoreanWon(actualQuoteInput)}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">최종 투찰 금액 (₩)</label>
                            <input 
                              type="text"
                              className="w-full border border-slate-200 h-9 px-2.5 rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                              placeholder="금액 입력"
                              value={bidInput}
                              onChange={handleMoneyInputChange(setBidInput)}
                            />
                            {bidInput && (
                              <div className="text-[10px] text-slate-500 mt-1 font-semibold select-none leading-tight">
                                {convertToKoreanWon(bidInput)}
                              </div>
                            )}
                          </div>
                        </div>

                        {statusInput === "실주" && (
                          <div className="p-3 bg-red-50/50 rounded-lg border border-red-100 space-y-3 animate-slide-down">
                            <h4 className="text-xs font-bold text-red-800">실주 세부 정보 기록</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-semibold text-red-700 mb-1">낙찰 경쟁업체명</label>
                                <input 
                                  type="text"
                                  className="w-full border border-red-200 h-9 px-2.5 rounded-md text-xs focus:ring-2 focus:ring-red-500 outline-none text-slate-800"
                                  placeholder="경쟁사 이름"
                                  value={competitorInput}
                                  onChange={(e) => setCompetitorInput(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-red-700 mb-1">경쟁사 낙찰 금액 (₩)</label>
                                <input 
                                  type="text"
                                  className="w-full border border-red-200 h-9 px-2.5 rounded-md text-xs focus:ring-2 focus:ring-red-500 outline-none text-slate-800"
                                  placeholder="낙찰가 입력"
                                  value={winningPriceInput}
                                  onChange={handleMoneyInputChange(setWinningPriceInput)}
                                />
                                {winningPriceInput && (
                                  <div className="text-[10px] text-red-700 mt-1 font-semibold select-none leading-tight">
                                    {convertToKoreanWon(winningPriceInput)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <button 
                          onClick={saveCommercialResults}
                          disabled={isSavingResults}
                          className="w-full h-9 bg-emerald-600 text-white rounded-md text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                        >
                          {isSavingResults ? "저장 중..." : "상업 결과 저장"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Phase 4: Vendor Comparison Tab */}
                {activeTab === "vendor" && (
                  <div>
                    <div className="mb-4 bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center gap-3">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      <div>
                        <h4 className="font-bold text-indigo-900 text-sm">AI 자동 견적 비교</h4>
                        <p className="text-xs text-indigo-700 mt-0.5">협력사 견적서를 기반으로 최저가 및 최단 납기를 분석합니다.</p>
                      </div>
                    </div>

                    {!vendorData ? <div className="text-center py-10 text-slate-500">데이터 로딩중...</div> : (
                      <div className="space-y-8">
                        {vendorData.items.map((item, idx) => {
                          const minPrice = Math.min(...item.quotes.map(q => q.unit_price));
                          const minDelivery = Math.min(...item.quotes.map(q => q.delivery_days));

                          return (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 font-bold text-slate-800">{item.item_name}</div>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                                    <th className="p-3 border-b">협력사</th>
                                    <th className="p-3 border-b">단가 (원)</th>
                                    <th className="p-3 border-b text-center">납기 (일)</th>
                                    <th className="p-3 border-b">비고</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {item.quotes.map((q, qIdx) => (
                                    <tr key={qIdx} className="hover:bg-slate-50">
                                      <td className="p-3 font-medium text-slate-800">{q.vendor_name}</td>
                                      <td className="p-3 font-semibold">
                                        <div className="flex items-center gap-2">
                                          ₩{q.unit_price.toLocaleString()}
                                          {q.unit_price === minPrice && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">최저가</span>}
                                        </div>
                                      </td>
                                      <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          {q.delivery_days}일
                                          {q.delivery_days === minDelivery && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">최단납기</span>}
                                        </div>
                                      </td>
                                      <td className="p-3 text-slate-500 text-xs">{q.notes}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Phone-to-Task Modal */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold flex items-center gap-2"><svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg> 유선 문의 (Phone) 요약 기록</h3>
              <button onClick={() => setIsPhoneModalOpen(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold mb-2">통화 내용 (STT 텍스트 입력)</label>
              <textarea rows={6} className="w-full border border-slate-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="고객과의 통화 내용을 여기에 붙여넣으세요..." value={phoneText} onChange={e => setPhoneText(e.target.value)}></textarea>
              <div className="mt-3 flex gap-2">
                <button onClick={fillMockPhoneText} className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-200">가상 시나리오 채우기</button>
              </div>
            </div>
            <div className="p-5 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsPhoneModalOpen(false)} className="px-5 py-2 text-slate-600 hover:bg-slate-200 rounded-md">취소</button>
              <button onClick={handlePhoneSubmit} disabled={isSummarizing || !phoneText} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                {isSummarizing ? 'AI 요약 중...' : '업무 카드로 변환 (Task)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Analysis Modal (Step 1~4) */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className={`bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-500 ${modalStep >= 3 ? 'w-full max-w-[85rem] h-[90vh]' : 'w-[40rem] max-h-[85vh]'}`}>
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-3"><span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">{modalStep}</span> 신규 견적 등록</h3>
              <button onClick={() => { setIsQuoteModalOpen(false); setModalStep(1); setUploadedFile(null); setExtractedData(null); }} className="text-slate-400 hover:text-slate-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col">
              {modalStep === 1 && (
                <div className="p-8 space-y-6 text-left">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-slate-700">발주처 (고객사) 직접 입력</label>
                    <input
                      type="text"
                      list="customers-list"
                      placeholder="발주처명을 직접 입력하세요 (예: 자율주행 주식회사)"
                      className="w-full border border-slate-300 p-3 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                      value={draftProject.customer_name || ""}
                      onChange={(e) => setDraftProject({ ...draftProject, customer_name: e.target.value })}
                    />
                    <datalist id="customers-list">
                      {customers.map(c => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-slate-700">설비 (기계) 종류 직접 입력</label>
                    <input
                      type="text"
                      placeholder="설비 종류를 입력하세요 (예: 자율주행 로봇 플랫폼)"
                      className="w-full border border-slate-300 p-3 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                      value={draftProject.equipment_type || ""}
                      onChange={(e) => setDraftProject({ ...draftProject, equipment_type: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-slate-700">사양서 파일 업로드</label>
                    <div
                      className="border-2 border-dashed border-slate-300 p-10 rounded-lg text-center cursor-pointer hover:bg-slate-50 transition-all"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <p className="font-bold text-slate-600 mb-1">{uploadedFile ? uploadedFile.name : "사양서 드래그 앤 드롭 또는 클릭하여 업로드"}</p>
                      <span className="text-xs text-slate-400">PDF, 이미지 등 지원</span>
                      <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => setUploadedFile(e.target.files?.[0] || null)} />
                    </div>
                  </div>
                </div>
              )}
              {modalStep === 2 && <div className="flex-1 flex flex-col items-center justify-center"><div className="animate-spin h-16 w-16 border-4 border-slate-200 border-t-blue-600 rounded-full mb-4"></div><h3 className="text-xl font-bold">AI가 사양서 제원을 정밀 분석 중입니다...</h3></div>}
              {(modalStep === 3 || modalStep === 4) && (
                <div className="flex flex-1 overflow-hidden">
                  {/* Left Side: File Spec Preview */}
                  <div className="w-1/2 p-4 bg-slate-100 border-r flex flex-col justify-between">
                    <div className="text-xs font-bold text-slate-500 mb-2 flex justify-between items-center">
                      <span>📄 업로드된 사양서 원본 프리뷰</span>
                      <span className="text-[10px] text-slate-400">{uploadedFile?.name}</span>
                    </div>
                    <div className="flex-1 min-h-0 bg-white rounded border border-slate-200 overflow-hidden shadow-inner relative">
                      {uploadedFile?.name.toLowerCase().endsWith('.docx') && docxHtml ? (
                        <div 
                          id="docx-viewer"
                          className="w-full h-full overflow-y-auto p-8 prose prose-slate max-w-none text-sm bg-white"
                          dangerouslySetInnerHTML={{ __html: (() => {
                            let highlightedHtml = docxHtml;
                            if (extractedData?.extracted_tables?.length > 1) {
                              const rows = extractedData.extracted_tables.slice(1);
                              rows.forEach((row: any[], idx: number) => {
                                const itemName = row[1];
                                if (itemName && itemName !== "-") {
                                  // Regex 이스케이프 및 안전한 문자열 치환
                                  const escapedItemName = itemName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                                  const regex = new RegExp(`(${escapedItemName})`, 'gi');
                                  highlightedHtml = highlightedHtml.replace(regex, `<span id="item-highlight-${idx}" class="bg-yellow-300 text-black font-bold px-1 rounded transition-all duration-300">$1</span>`);
                                }
                              });
                            }
                            return highlightedHtml;
                          })() }}
                        />
                      ) : filePreviewUrl ? (
                        <object id="pdf-viewer" data={filePreviewUrl} type="application/pdf" className="w-full h-full scroll-smooth">
                          <div className="p-6 text-center text-slate-500 text-sm">
                            PDF 뷰어를 지원하지 않는 브라우저이거나 이미지 파일입니다.
                            <br />
                            <span className="text-xs text-slate-400 mt-2 block">({uploadedFile?.name})</span>
                          </div>
                        </object>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">미리보기 파일을 로드할 수 없습니다.</div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Multi-layered Strategic AI Report */}
                  <div className="w-1/2 p-6 overflow-y-auto bg-slate-50 space-y-6 text-left">
                    {/* Header Banner */}
                    <div className="bg-slate-900 text-white p-5 rounded-lg flex items-center justify-between shadow-sm">
                      <div>
                        <h4 className="text-sm font-bold flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
                          견적 대상 품목 리스트
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                          추출된 사양서 데이터를 확인하고 단가 및 수량을 입력하세요.
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded font-mono font-bold">
                        V2.1 PRO
                      </span>
                    </div>

                    {/* [표 데이터 표시 영역] 스프레드시트 UI */}
                    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                      <h5 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        [추출된 사양서 데이터]
                      </h5>
                      <div id="quote-builder" key={selectedProject?.id || 'new'} className="overflow-x-auto">
                        {extractedData?.extracted_tables ? (
                          <>
                            <table className="w-full text-xs text-left border-collapse">
                              <thead className="bg-slate-100">
                                <tr>
                                  <th className="border border-slate-300 px-3 py-2 font-bold text-slate-700 whitespace-nowrap text-center">Item No.</th>
                                  <th className="border border-slate-300 px-3 py-2 font-bold text-slate-700 whitespace-nowrap text-center">품명 및 사양</th>
                                  <th className="border border-slate-300 px-3 py-2 font-bold text-slate-700 whitespace-nowrap text-center">수량</th>
                                  <th className="border border-slate-300 px-3 py-2 font-bold text-slate-700 whitespace-nowrap text-center">단가(원)</th>
                                  <th className="border border-slate-300 px-3 py-2 font-bold text-slate-700 whitespace-nowrap text-center">소계(원)</th>
                                  <th className="border border-slate-300 px-3 py-2 font-bold text-slate-700 whitespace-nowrap text-center">비고</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(extractedData.extracted_tables.length > 1 ? extractedData.extracted_tables.slice(1) : extractedData.extracted_tables).map((row: any[], rowIdx: number) => {
                                  const qItem = quoteItems[rowIdx];
                                  const defaultQuantity = parseInt(row[2]) || 1;
                                  const quantity = qItem?.quantity !== undefined ? qItem.quantity : defaultQuantity;
                                  const unitPrice = qItem?.unitPrice || 0;
                                  const subTotal = quantity * unitPrice;
                                  return (
                                    <tr 
                                      key={rowIdx} 
                                      data-source-ref={row[0] || (rowIdx + 1)}
                                      onClick={() => {
                                        setActiveRowIdx(rowIdx);
                                        if (uploadedFile?.name.toLowerCase().endsWith('.docx')) {
                                          const highlightEl = document.getElementById(`item-highlight-${rowIdx}`);
                                          if (highlightEl) {
                                            highlightEl.scrollIntoView({ behavior: "smooth", block: "center" });
                                            highlightEl.classList.remove("bg-yellow-300");
                                            highlightEl.classList.add("bg-orange-500", "text-white");
                                            setTimeout(() => {
                                              highlightEl.classList.remove("bg-orange-500", "text-white");
                                              highlightEl.classList.add("bg-yellow-300");
                                            }, 1000);
                                          }
                                        } else {
                                          const viewer = document.getElementById("pdf-viewer");
                                          if (viewer) {
                                            viewer.scrollIntoView({ behavior: "smooth", block: "center" });
                                            viewer.style.opacity = "0.7";
                                            setTimeout(() => viewer.style.opacity = "1", 200);
                                          }
                                        }
                                      }}
                                      className={`cursor-pointer transition-colors ${activeRowIdx === rowIdx ? 'bg-blue-50 ring-2 ring-blue-400' : 'hover:bg-slate-50'}`}
                                    >
                                      <td className="border border-slate-200 px-3 py-2 text-slate-600 text-center">{row[0] || (rowIdx + 1)}</td>
                                      <td className="border border-slate-200 px-3 py-2 text-slate-600">{row[1] || "-"}</td>
                                      <td className="border border-slate-200 px-3 py-2 text-slate-600 text-center">
                                        <input 
                                          type="number" 
                                          min="1"
                                          className="w-16 border border-slate-200 rounded px-2 py-1 text-center focus:ring-2 focus:ring-blue-500 outline-none bg-white" 
                                          value={quantity === 0 ? '' : quantity}
                                          onChange={(e) => {
                                            const newQty = parseInt(e.target.value) || 0;
                                            const newItems = [...quoteItems];
                                            if (!newItems[rowIdx]) newItems[rowIdx] = { unitPrice: 0, quantity: defaultQuantity };
                                            newItems[rowIdx].quantity = newQty;
                                            setQuoteItems(newItems);
                                          }}
                                        />
                                      </td>
                                      <td className="border border-slate-200 px-3 py-2 text-slate-600 text-right">
                                        <input 
                                          type="number" 
                                          min="0"
                                          className="w-24 border border-slate-200 rounded px-2 py-1 text-right focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono" 
                                          value={unitPrice === 0 ? '' : unitPrice}
                                          placeholder="0"
                                          onChange={(e) => {
                                            const newPrice = parseInt(e.target.value) || 0;
                                            const newItems = [...quoteItems];
                                            if (!newItems[rowIdx]) newItems[rowIdx] = { unitPrice: 0, quantity: defaultQuantity };
                                            newItems[rowIdx].unitPrice = newPrice;
                                            setQuoteItems(newItems);
                                          }}
                                        />
                                      </td>
                                      <td className="border border-slate-200 px-3 py-2 text-slate-600 text-right font-bold text-blue-700 font-mono">{subTotal.toLocaleString()}</td>
                                      <td className="border border-slate-200 px-3 py-2 text-slate-600">{row[3] || row[4] || "-"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="bg-blue-50/50">
                                <tr>
                                  <td colSpan={4} className="border border-slate-300 px-3 py-3 font-bold text-slate-800 text-right">총 견적 금액</td>
                                  <td className="border border-slate-300 px-3 py-3 font-extrabold text-blue-700 text-right font-mono text-base">
                                    ₩{quoteItems.reduce((acc, item, idx) => {
                                      const rows = extractedData.extracted_tables.length > 1 ? extractedData.extracted_tables.slice(1) : extractedData.extracted_tables;
                                      const qty = item.quantity !== undefined ? item.quantity : (parseInt(rows[idx]?.[2]) || 1);
                                      return acc + ((item.unitPrice || 0) * qty);
                                    }, 0).toLocaleString()}
                                  </td>
                                  <td className="border border-slate-300 px-3 py-3"></td>
                                </tr>
                              </tfoot>
                            </table>
                            <div className="mt-4 flex justify-end">
                              <button 
                                onClick={() => {
                                  const rows = extractedData.extracted_tables.length > 1 ? extractedData.extracted_tables.slice(1) : extractedData.extracted_tables;
                                  const csvContent = [
                                    ["Item No.", "품명 및 사양", "수량", "단가(원)", "소계(원)", "비고"],
                                    ...rows.map((row: any[], idx: number) => {
                                      const qItem = quoteItems[idx] || { unitPrice: 0, quantity: 1 };
                                      const qty = qItem.quantity !== undefined ? qItem.quantity : (parseInt(row[2]) || 1);
                                      const subTotal = qty * (qItem.unitPrice || 0);
                                      return [
                                        row[0] || (idx + 1),
                                        `"${(row[1] || '').replace(/"/g, '""')}"`,
                                        qty,
                                        qItem.unitPrice || 0,
                                        subTotal,
                                        `"${(row[3] || row[4] || '').replace(/"/g, '""')}"`
                                      ];
                                    }),
                                    ["", "", "", "총 견적 금액", quoteItems.reduce((acc, item, idx) => {
                                      const rows = extractedData.extracted_tables.length > 1 ? extractedData.extracted_tables.slice(1) : extractedData.extracted_tables;
                                      const qty = item.quantity !== undefined ? item.quantity : (parseInt(rows[idx]?.[2]) || 1);
                                      return acc + ((item.unitPrice || 0) * qty);
                                    }, 0), ""]
                                  ].map(e => e.join(",")).join("\n");
                                  
                                  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                                  const url = URL.createObjectURL(blob);
                                  const link = document.createElement("a");
                                  link.setAttribute("href", url);
                                  link.setAttribute("download", `견적서_${draftProject.customer_name || '고객사'}.csv`);
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-sm flex items-center gap-1.5"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                견적서 자동 생성 (CSV)
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="p-4 text-slate-400">데이터를 추출 중이거나 데이터가 없습니다.</p>
                        )}
                      </div>
                    </div>

                    {/* 리스크 자동 탐지 체크리스트 */}
                    {riskAlerts.length > 0 && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-5 space-y-3 shadow-sm">
                        <h5 className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          🚨 리스크 자동 탐지 및 최종 확인 체크리스트
                        </h5>
                        <p className="text-[10px] text-rose-600 leading-normal -mt-1">
                          견적서 생성을 위해 추출된 기술 리스크 항목을 확인하시고 개별 서명/체크해 주시기 바랍니다.
                        </p>
                        <div className="space-y-2 pt-1">
                          {riskAlerts.map((a, i) => (
                            <label key={i} className="flex items-start gap-2.5 p-3 bg-white rounded border border-rose-100 hover:bg-rose-50/30 cursor-pointer transition">
                              <input
                                type="checkbox"
                                className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                                checked={a.acknowledged}
                                onChange={() => setRiskAlerts(prev => prev.map((al, j) => j === i ? {...al, acknowledged: !al.acknowledged} : al))}
                              />
                              <span className="text-xs text-slate-700 font-semibold leading-relaxed">{a.message}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {modalStep === 4 && (
                <>
                  {console.log("quoteData in step 4:", quoteData)}
                  {quoteData && (
                <div className="flex-1 overflow-y-auto bg-slate-100 p-8 text-left">
                  <div className="max-w-4xl mx-auto bg-white p-12 shadow-xl border border-slate-200 rounded-lg text-slate-800">
                    <div className="flex justify-between items-start border-b pb-6 mb-8">
                      <div>
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">견적서 (Quotation)</h1>
                        <p className="text-sm text-slate-500 mt-1">SteelOps Intelligent Quotation System</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-slate-800">{draftProject.customer_name || "고객사"} 귀하</div>
                        <p className="text-xs text-slate-500 mt-1">제출일: {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-lg flex justify-between items-center mb-8">
                      <span className="text-slate-700 font-bold">총 견적 금액 (VAT 별도):</span>
                      <span className="text-3xl font-extrabold text-blue-700">₩{quoteData.total_amount.toLocaleString()}</span>
                    </div>
                    
                    <div className="mb-8">
                      <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-blue-600 rounded-sm"></span>
                        세부 항목 및 내역
                      </h3>
                      <table className="w-full text-sm border-collapse border border-slate-200 rounded-lg overflow-hidden">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                            <th className="border border-slate-200 p-3 text-left">품명</th>
                            <th className="border border-slate-200 p-3 text-left">규격 및 사양</th>
                            <th className="border border-slate-200 p-3 text-center w-16">수량</th>
                            <th className="border border-slate-200 p-3 text-right">단가</th>
                            <th className="border border-slate-200 p-3 text-right">금액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {quoteData.items.map((i, x) => (
                            <tr key={x} className="hover:bg-slate-50/50">
                              <td className="border border-slate-200 p-3 font-semibold text-slate-900">{i.name}</td>
                              <td className="border border-slate-200 p-3 text-slate-500 text-xs">{i.specification}</td>
                              <td className="border border-slate-200 p-3 text-center">{i.quantity}</td>
                              <td className="border border-slate-200 p-3 text-right">₩{i.unit_price.toLocaleString()}</td>
                              <td className="border border-slate-200 p-3 text-right font-bold text-slate-900">₩{i.total_price.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {quoteData.scope_of_supply && quoteData.scope_of_supply.length > 0 && (
                      <div className="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-lg">
                        <h4 className="font-bold text-slate-800 mb-2.5">공급 범위 (Scope of Supply)</h4>
                        <ul className="list-disc pl-5 text-slate-600 space-y-1 text-sm">
                          {quoteData.scope_of_supply.map((s, x) => (
                            <li key={x}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                      <div className="bg-red-50/70 p-6 border border-red-100 rounded-lg">
                        <h4 className="font-bold text-red-800 mb-2.5 flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          제외 사항 (Exclusions)
                        </h4>
                        <ul className="list-disc pl-5 text-red-700 text-xs space-y-1.5">
                          {quoteData.exclusions.map((e, x) => (
                            <li key={x} className="leading-relaxed">{e}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-slate-50 p-6 border border-slate-200 rounded-lg">
                        <h4 className="font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          기본 조건 (Conditions)
                        </h4>
                        <ul className="list-disc pl-5 text-slate-600 text-xs space-y-1.5">
                          {quoteData.conditions.map((c, x) => (
                            <li key={x} className="leading-relaxed">{c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-200">
                      <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-4 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
                        <input 
                          type="checkbox" 
                          checked={isVerified} 
                          onChange={(e) => setIsVerified(e.target.checked)} 
                          className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500" 
                        />
                        <span className="text-sm font-bold text-slate-800">모든 단가와 수량을 확인했으며, 검증을 완료했습니다. (최종 견적 생성 동의)</span>
                      </label>
                    </div>
                  </div>
                </div>
                  )}
                  {!quoteData && (
                    <div className="flex-1 p-8 text-center text-slate-500">
                      <p>모든 품목의 단가를 입력해 주십시오. 총액이 계산되면 '최종 저장'이 활성화됩니다.</p>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* 하단 제어 영역 및 상태 메시지 */}
            <div className="p-5 border-t bg-white flex justify-between items-center shrink-0">
              <div className="text-sm font-semibold">
                {(() => {
                  if (modalStep === 1) return <span className="text-slate-500">사양서를 업로드하고 고객사 정보를 입력하십시오.</span>;
                  if (modalStep === 2) return <span className="text-blue-600">AI 분석이 진행 중입니다...</span>;
                  if (modalStep === 3 || modalStep === 4) {
                    const rows = extractedData?.extracted_tables?.length > 1 ? extractedData.extracted_tables.slice(1) : (extractedData?.extracted_tables || []);
                    const isAllPricesValid = rows.length > 0 && quoteItems.length >= rows.length && rows.every((_, idx) => (quoteItems[idx]?.unitPrice || 0) > 0);
                    
                    if (isAllPricesValid) {
                      return <span className="text-emerald-600 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> 모든 검증이 완료되었습니다. [최종 저장]을 눌러 데이터베이스에 반영하십시오.</span>;
                    } else {
                      return <span className="text-blue-600 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> 품목별 단가를 입력해주십시오. 총액이 계산되면 '최종 저장'이 활성화됩니다.</span>;
                    }
                  }
                  return null;
                })()}
              </div>
              <div className="flex gap-3">
                {modalStep === 1 && <button onClick={startExtraction} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md">데이터 추출 시작</button>}
                {(modalStep === 3 || modalStep === 4) && (
                  <button 
                    onClick={saveProject} 
                    disabled={
                      (() => {
                        const rows = extractedData?.extracted_tables?.length > 1 ? extractedData.extracted_tables.slice(1) : (extractedData?.extracted_tables || []);
                        const isAllPricesValid = rows.length > 0 && quoteItems.length >= rows.length && rows.every((_, idx) => (quoteItems[idx]?.unitPrice || 0) > 0);
                        return !isAllPricesValid;
                      })()
                    }
                    className={`px-8 py-2 font-bold rounded-md transition ${
                      (() => {
                        const rows = extractedData?.extracted_tables?.length > 1 ? extractedData.extracted_tables.slice(1) : (extractedData?.extracted_tables || []);
                        const isAllPricesValid = rows.length > 0 && quoteItems.length >= rows.length && rows.every((_, idx) => (quoteItems[idx]?.unitPrice || 0) > 0);
                        return isAllPricesValid ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md' : 'bg-slate-300 text-slate-500 cursor-not-allowed';
                      })()
                    }`}
                  >
                    최종 저장
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
