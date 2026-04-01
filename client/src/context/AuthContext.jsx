import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('smartcut_token');
    const savedUser = localStorage.getItem('smartcut_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (tokenVal, userData) => {
    localStorage.setItem('smartcut_token', tokenVal);
    localStorage.setItem('smartcut_user', JSON.stringify(userData));
    setToken(tokenVal);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('smartcut_token');
    localStorage.removeItem('smartcut_user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (data) => {
    const updated = { ...user, ...data };
    localStorage.setItem('smartcut_user', JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, loading, isCustomer: user?.type === 'customer', isBarbershop: user?.type === 'barbershop' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
