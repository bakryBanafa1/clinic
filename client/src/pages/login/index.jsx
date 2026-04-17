import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight, ShieldCheck, HeartPulse } from 'lucide-react';
import api from '../../utils/api';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [clinicInfo, setClinicInfo] = useState({ clinicName: 'نظام العيادة', logo: null });
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClinicInfo = async () => {
      try {
        const data = await api.get('/settings/public-info');
        if (data.clinicName) {
          setClinicInfo(data);
        }
      } catch (err) {
        console.error('Failed to fetch clinic info:', err);
      }
    };
    fetchClinicInfo();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'فشل تسجيل الدخول. يرجى التأكد من البيانات.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-sidebar">
        <div className="login-box animate-scale-in">
          <div className="login-header">
            <div className="login-logo">
              {clinicInfo.logo ? (
                <img src={clinicInfo.logo} alt="Logo" className="logo-img" />
              ) : (
                <div className="logo-icon">
                  <HeartPulse size={32} />
                </div>
              )}
            </div>
            <h1 className="clinic-name">{clinicInfo.clinicName}</h1>
            <p className="login-subtitle">يرجى تسجيل الدخول للوصول إلى لوحة التحكم</p>
          </div>

          {error && (
            <div className="login-alert error-alert animate-shake">
              <ShieldCheck size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label>اسم المستخدم</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  dir="ltr"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>كلمة المرور</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={isLoading}>
              <span>{isLoading ? 'جاري التحقق...' : 'دخول للنظام'}</span>
              {!isLoading && <ArrowRight size={20} />}
            </button>
          </form>

          <div className="login-footer">
            <p>© 2026 جميع الحقوق محفوظة - {clinicInfo.clinicName}</p>
          </div>
        </div>
      </div>

      <div className="login-visual en-font">
        <div className="visual-overlay"></div>
        <div className="visual-content animate-slide-left">
          <span className="visual-tag">Professional Care</span>
          <h2>إدارة طبية ذكية لعيادة متألقة</h2>
          <p>نقدم لك الحلول التقنية الأكثر تطوراً لتنظيم المواعيد، ملفات المرضى، والتقارير المالية في مكان واحد.</p>
          
          <div className="visual-features">
            <div className="feature-item">
              <span className="feature-dot"></span>
              <span>سهولة الاستخدام</span>
            </div>
            <div className="feature-item">
              <span className="feature-dot"></span>
              <span>أمان عالي للبيانات</span>
            </div>
            <div className="feature-item">
              <span className="feature-dot"></span>
              <span>تقارير فورية</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
