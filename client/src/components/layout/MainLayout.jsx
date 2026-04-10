import React, { useContext, useState, useEffect, useCallback } from 'react';
import { Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { LayoutDashboard, Users, Calendar, Activity, Receipt, UserRound, Search, Bell, MonitorPlay, Settings, LogOut, MessageCircle, PieChart, Moon, Sun, X, Smartphone } from 'lucide-react';
import api from '../../utils/api';
import { getRoleText } from '../../utils/helpers';
import './MainLayout.css';

const MainLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  useEffect(() => {
    fetchNotifCount();
    const interval = setInterval(fetchNotifCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifCount = async () => {
    try {
      const data = await api.get('/notifications/count');
      setNotifCount(data.count || 0);
    } catch (err) {
      // Silently fail
    }
  };

  const toggleDarkMode = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('dark-mode');
    }
  };

  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    try {
      const data = await api.get(`/patients?search=${query}&limit=5`);
      setSearchResults(data.patients || []);
      setShowSearch(true);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const navItems = [
    { name: 'لوحة التحكم', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'المرضى', path: '/patients', icon: <Users size={20} /> },
    { name: 'المواعيد', path: '/appointments', icon: <Calendar size={20} /> },
    { name: 'الدور', path: '/queue', icon: <MonitorPlay size={20} /> },
    { name: 'الزيارات', path: '/visits', icon: <Activity size={20} /> },
    { name: 'المراجعات', path: '/followup', icon: <MessageCircle size={20} /> },
    { name: 'طلبات الواتساب', path: '/whatsapp-requests', icon: <MessageCircle size={20} /> },
    { name: 'الفواتير', path: '/billing', icon: <Receipt size={20} /> },
    { name: 'التقارير', path: '/reports', icon: <PieChart size={20} /> },
    { name: 'الأطباء', path: '/doctors', icon: <UserRound size={20} /> },
    { name: 'ربط الواتساب', path: '/whatsapp', icon: <Smartphone size={20} /> },
    { name: 'الإعدادات', path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
             <div className="logo-placeholder">⚕️</div>
             <h2>نظام العيادة</h2>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={logout} className="logout-btn">
            <LogOut size={20} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Header */}
        <header className="topbar">
           <div className="topbar-search" style={{ position: 'relative' }}>
              <Search size={18} className="text-muted" />
              <input 
                type="text" 
                placeholder="بحث بالاسم، الجوال، رقم الملف..." 
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearch(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
                  <X size={16}/>
                </button>
              )}
              
              {/* Search Dropdown */}
              {showSearch && searchResults.length > 0 && (
                <div className="search-dropdown">
                  {searchResults.map(p => (
                    <div 
                      key={p.id} 
                      className="search-result-item"
                      onMouseDown={() => { navigate(`/patients/${p.id}`); setShowSearch(false); setSearchQuery(''); }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>{p.name.charAt(0)}</div>
                        <div>
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-xs text-muted en-font">{p.fileNumber} {p.phone ? `• ${p.phone}` : ''}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
           </div>
            
            <div className="flex items-center gap-4">
              <button className="icon-btn relative bg-surface border border-color" onClick={toggleDarkMode} title="تبديل الوضع">
                {isDark ? <Sun size={20} className="text-warning-500" /> : <Moon size={20} className="text-muted" />}
              </button>
              <button className="icon-btn relative bg-surface border border-color" onClick={() => navigate('/notifications')} style={{ position: 'relative' }}>
                <Bell size={20} className="text-muted" />
                {notifCount > 0 && <span className="notification-badge">{notifCount > 9 ? '9+' : notifCount}</span>}
              </button>
              <div className="user-profile">
                <div className="avatar">{user.name.charAt(0)}</div>
                <div className="user-info">
                  <span className="user-name">{user.name}</span>
                  <span className="user-role">{getRoleText(user.role)}</span>
                </div>
              </div>
           </div>
        </header>

        {/* Page Content */}
        <div className="page-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
