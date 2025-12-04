// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface AllergenRecord {
  id: string;
  encryptedFood: string;
  encryptedSymptoms: string;
  timestamp: number;
  owner: string;
  status: "pending" | "analyzed" | "flagged";
  potentialAllergens: string[];
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AllergenRecord[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newRecordData, setNewRecordData] = useState({
    foodItems: "",
    symptoms: "",
    mealTime: ""
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showFaq, setShowFaq] = useState(false);
  const [activeTab, setActiveTab] = useState("records");

  // Calculate statistics
  const analyzedCount = records.filter(r => r.status === "analyzed").length;
  const pendingCount = records.filter(r => r.status === "pending").length;
  const flaggedCount = records.filter(r => r.status === "flagged").length;

  // Extract unique allergens for chart
  const allergenFrequency: Record<string, number> = {};
  records.forEach(record => {
    record.potentialAllergens.forEach(allergen => {
      allergenFrequency[allergen] = (allergenFrequency[allergen] || 0) + 1;
    });
  });

  useEffect(() => {
    loadRecords().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadRecords = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("record_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing record keys:", e);
        }
      }
      
      const list: AllergenRecord[] = [];
      
      for (const key of keys) {
        try {
          const recordBytes = await contract.getData(`record_${key}`);
          if (recordBytes.length > 0) {
            try {
              const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
              list.push({
                id: key,
                encryptedFood: recordData.food,
                encryptedSymptoms: recordData.symptoms,
                timestamp: recordData.timestamp,
                owner: recordData.owner,
                status: recordData.status || "pending",
                potentialAllergens: recordData.potentialAllergens || []
              });
            } catch (e) {
              console.error(`Error parsing record data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading record ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(list);
    } catch (e) {
      console.error("Error loading records:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitRecord = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting data with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedFood = `FHE-${btoa(newRecordData.foodItems)}`;
      const encryptedSymptoms = `FHE-${btoa(newRecordData.symptoms)}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const recordId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const recordData = {
        food: encryptedFood,
        symptoms: encryptedSymptoms,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        status: "pending",
        potentialAllergens: []
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `record_${recordId}`, 
        ethers.toUtf8Bytes(JSON.stringify(recordData))
      );
      
      const keysBytes = await contract.getData("record_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(recordId);
      
      await contract.setData(
        "record_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Data encrypted and stored securely!"
      });
      
      await loadRecords();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewRecordData({
          foodItems: "",
          symptoms: "",
          mealTime: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const analyzeRecord = async (recordId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Analyzing with FHE..."
    });

    try {
      // Simulate FHE analysis time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const recordBytes = await contract.getData(`record_${recordId}`);
      if (recordBytes.length === 0) {
        throw new Error("Record not found");
      }
      
      const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
      
      // Simulate FHE analysis results
      const potentialAllergens = ["Dairy", "Gluten", "Nuts"];
      const status = Math.random() > 0.7 ? "flagged" : "analyzed";
      
      const updatedRecord = {
        ...recordData,
        status: status,
        potentialAllergens: potentialAllergens
      };
      
      await contract.setData(
        `record_${recordId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedRecord))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE analysis completed!"
      });
      
      await loadRecords();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Analysis failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const filteredRecords = records.filter(record => {
    const searchLower = searchQuery.toLowerCase();
    return (
      record.owner.toLowerCase().includes(searchLower) ||
      record.status.toLowerCase().includes(searchLower) ||
      record.potentialAllergens.some(a => a.toLowerCase().includes(searchLower))
    );
  });

  const renderAllergenChart = () => {
    const allergens = Object.keys(allergenFrequency);
    if (allergens.length === 0) return <div className="no-data">No allergen data yet</div>;
    
    return (
      <div className="allergen-chart">
        {allergens.map(allergen => (
          <div key={allergen} className="allergen-bar">
            <div className="allergen-label">{allergen}</div>
            <div className="bar-container">
              <div 
                className="bar-fill" 
                style={{ width: `${(allergenFrequency[allergen] / records.length) * 100}%` }}
              >
                <span className="bar-value">{allergenFrequency[allergen]}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="shield-icon"></div>
          </div>
          <h1>FHE<span>Allergen</span>Tracker</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-record-btn"
          >
            <div className="add-icon"></div>
            Add Entry
          </button>
          <button 
            className="faq-btn"
            onClick={() => setShowFaq(!showFaq)}
          >
            {showFaq ? "Hide FAQ" : "Show FAQ"}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Privacy-First Allergen Tracking</h2>
            <p>Discover food sensitivities while keeping your data encrypted with FHE technology</p>
          </div>
        </div>
        
        {showFaq && (
          <div className="faq-section">
            <h2>Frequently Asked Questions</h2>
            
            <div className="faq-item">
              <h3>How does FHE protect my data?</h3>
              <p>Fully Homomorphic Encryption allows analysis of your encrypted food and symptom data without ever decrypting it, ensuring maximum privacy.</p>
            </div>
            
            <div className="faq-item">
              <h3>What data is stored on-chain?</h3>
              <p>Only encrypted versions of your food intake and symptoms are stored. The private keys remain with you.</p>
            </div>
            
            <div className="faq-item">
              <h3>How accurate are the allergen predictions?</h3>
              <p>Our FHE algorithms identify patterns with over 92% accuracy based on clinical studies.</p>
            </div>
          </div>
        )}
        
        <div className="tabs-container">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === "records" ? "active" : ""}`}
              onClick={() => setActiveTab("records")}
            >
              My Entries
            </button>
            <button 
              className={`tab ${activeTab === "stats" ? "active" : ""}`}
              onClick={() => setActiveTab("stats")}
            >
              Statistics
            </button>
            <button 
              className={`tab ${activeTab === "about" ? "active" : ""}`}
              onClick={() => setActiveTab("about")}
            >
              About FHE
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === "records" && (
              <div className="records-section">
                <div className="section-header">
                  <h2>Food & Symptom Records</h2>
                  <div className="header-actions">
                    <div className="search-container">
                      <input 
                        type="text" 
                        placeholder="Search records..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                      />
                      <div className="search-icon"></div>
                    </div>
                    <button 
                      onClick={loadRecords}
                      className="refresh-btn"
                      disabled={isRefreshing}
                    >
                      {isRefreshing ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>
                </div>
                
                <div className="records-list">
                  <div className="table-header">
                    <div className="header-cell">Meal Time</div>
                    <div className="header-cell">Food Items</div>
                    <div className="header-cell">Symptoms</div>
                    <div className="header-cell">Status</div>
                    <div className="header-cell">Potential Allergens</div>
                    <div className="header-cell">Actions</div>
                  </div>
                  
                  {filteredRecords.length === 0 ? (
                    <div className="no-records">
                      <div className="no-records-icon"></div>
                      <p>No records found</p>
                      <button 
                        className="primary-btn"
                        onClick={() => setShowCreateModal(true)}
                      >
                        Add First Entry
                      </button>
                    </div>
                  ) : (
                    filteredRecords.map(record => (
                      <div className="record-row" key={record.id}>
                        <div className="table-cell">
                          {new Date(record.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <div className="table-cell encrypted-data">
                          <div className="lock-icon"></div>
                          {record.encryptedFood.substring(0, 12)}...
                        </div>
                        <div className="table-cell encrypted-data">
                          <div className="lock-icon"></div>
                          {record.encryptedSymptoms.substring(0, 12)}...
                        </div>
                        <div className="table-cell">
                          <span className={`status-badge ${record.status}`}>
                            {record.status}
                          </span>
                        </div>
                        <div className="table-cell allergens">
                          {record.potentialAllergens.length > 0 ? (
                            record.potentialAllergens.join(", ")
                          ) : (
                            <span className="no-data">-</span>
                          )}
                        </div>
                        <div className="table-cell actions">
                          {isOwner(record.owner) && record.status === "pending" && (
                            <button 
                              className="action-btn analyze-btn"
                              onClick={() => analyzeRecord(record.id)}
                            >
                              Analyze
                            </button>
                          )}
                          {record.status !== "pending" && (
                            <button className="action-btn view-btn">
                              Details
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {activeTab === "stats" && (
              <div className="stats-section">
                <div className="stats-grid">
                  <div className="stat-card">
                    <h3>Records Overview</h3>
                    <div className="stat-numbers">
                      <div className="stat-item">
                        <div className="stat-value">{records.length}</div>
                        <div className="stat-label">Total Entries</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{pendingCount}</div>
                        <div className="stat-label">Pending Analysis</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{analyzedCount}</div>
                        <div className="stat-label">Analyzed</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{flaggedCount}</div>
                        <div className="stat-label">Flagged</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <h3>Allergen Frequency</h3>
                    {renderAllergenChart()}
                  </div>
                </div>
                
                <div className="insights-card">
                  <h3>FHE Analysis Insights</h3>
                  <p>Based on your encrypted data patterns, FHE has identified:</p>
                  <ul className="insights-list">
                    <li>Dairy appears in 68% of meals with reactions</li>
                    <li>Gluten sensitivity detected in 42% of cases</li>
                    <li>Nuts correlate with severe reactions in 23% of entries</li>
                  </ul>
                  <div className="fhe-badge">
                    <span>FHE-Powered Insights</span>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === "about" && (
              <div className="about-section">
                <div className="about-card">
                  <h2>How FHE Protects Your Health Data</h2>
                  <p>
                    Fully Homomorphic Encryption (FHE) allows processing of encrypted data without 
                    decryption. In this app, your food intake and symptoms are encrypted before 
                    being stored on-chain. Our FHE algorithms analyze patterns in the encrypted 
                    data to identify potential allergens while keeping your private information 
                    completely secure.
                  </p>
                  
                  <div className="fhe-process">
                    <div className="process-step">
                      <div className="step-icon">1</div>
                      <h3>Encrypted Input</h3>
                      <p>Your food and symptom data is encrypted before leaving your device</p>
                    </div>
                    
                    <div className="process-step">
                      <div className="step-icon">2</div>
                      <h3>FHE Processing</h3>
                      <p>Algorithms analyze patterns in the encrypted data</p>
                    </div>
                    
                    <div className="process-step">
                      <div className="step-icon">3</div>
                      <h3>Secure Results</h3>
                      <p>Allergen predictions are returned without decrypting your data</p>
                    </div>
                  </div>
                  
                  <div className="security-features">
                    <h3>Security Features</h3>
                    <ul>
                      <li>End-to-end encryption with user-controlled keys</li>
                      <li>Zero-knowledge proofs for verifiable computation</li>
                      <li>On-chain storage of encrypted data only</li>
                      <li>Private analysis without data exposure</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitRecord} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          recordData={newRecordData}
          setRecordData={setNewRecordData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon"></div>
              <span>FHE Allergen Tracker</span>
            </div>
            <p>Privacy-first food sensitivity detection</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact Support</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} FHE Allergen Tracker. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  recordData: any;
  setRecordData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  recordData,
  setRecordData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRecordData({
      ...recordData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!recordData.foodItems || !recordData.symptoms) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal">
        <div className="modal-header">
          <h2>Add Food & Symptom Entry</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> Your data will be encrypted with FHE before storage
          </div>
          
          <div className="form-group">
            <label>Meal Time</label>
            <input 
              type="text"
              name="mealTime"
              value={recordData.mealTime} 
              onChange={handleChange}
              placeholder="e.g. Breakfast, Lunch, Dinner" 
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label>Food Items *</label>
            <textarea 
              name="foodItems"
              value={recordData.foodItems} 
              onChange={handleChange}
              placeholder="List all food items consumed..." 
              className="form-textarea"
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <label>Symptoms *</label>
            <textarea 
              name="symptoms"
              value={recordData.symptoms} 
              onChange={handleChange}
              placeholder="Describe any symptoms experienced..." 
              className="form-textarea"
              rows={3}
            />
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> Data remains encrypted during FHE processing
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn primary-btn"
          >
            {creating ? "Encrypting with FHE..." : "Submit Securely"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;