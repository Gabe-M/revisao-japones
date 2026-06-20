import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import PerfilCard from './components/PerfilCard';
import './index.css';

function PerfilApp() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const sessaoSalva = localStorage.getItem('supabase_session');
    if (sessaoSalva) {
      setSession(JSON.parse(sessaoSalva));
    } else {
      window.location.href = "login.html";
    }
  }, []);

  if (!session) return <p style={{ textAlign: 'center' }}>Carregando...</p>;

  return <PerfilCard session={session} />;
}

const rootElement = document.getElementById('root-perfil');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<PerfilApp />);
}
