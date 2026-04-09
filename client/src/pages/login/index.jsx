import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

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
      setError(err.message || 'فشل تسجيل الدخول');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-content animate-slide-up">
        <div className="login-header">
           <div className="login-logo-placeholder">⚕️</div>
           <h1>مرحباً بك في العيادة</h1>
           <p>يرجى تسجيل الدخول للمتابعة</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>اسم المستخدم</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </div>
          
          <div className="form-group">
            <label>كلمة المرور</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="login-footer">
           <p>نظام إدارة عيادة متكامل - نسخة تجريبية</p>
        </div>
      </div>
      <div className="login-cover">
        <div className="cover-glass">
            <h2>رعاية صحية متقدمة</h2>
            <p>حلول ذكية لإدارة عيادتك بسهولة وأمان</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
