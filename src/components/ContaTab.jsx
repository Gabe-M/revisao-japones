import React from 'react';
import { supabase } from '../supabase';

export default function ContaTab({ session }) {
  
  const fazerLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('supabase_session');
    window.location.href = "login.html";
  };

  const deletarConta = async () => {
    const confirmacao = window.confirm("ATENÇÃO: Tem certeza de que deseja EXCLUIR SUA CONTA DEFINITIVAMENTE?\nIsso apagará todos os seus dados e não poderá ser desfeito.");
    
    if (confirmacao) {
      const { error } = await supabase.rpc('delete_user_account');
      
      if (error) {
        alert("Erro ao excluir conta: " + error.message);
      } else {
        alert("Conta excluída com sucesso.");
        await supabase.auth.signOut();
        localStorage.removeItem('supabase_session');
        window.location.href = "login.html";
      }
    }
  };

  return (
    <>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '1.3em', textAlign: 'center' }}>👤 Área do Usuário</h3>
      <div className="info-label" style={{ textAlign: 'center' }}>E-mail Cadastrado:</div>
      <div className="info-value" id="user-email" style={{ textAlign: 'center', marginBottom: '25px' }}>
        {session?.user?.email || 'Carregando...'}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
        <button className="btn-logout" onClick={fazerLogout}>Sair (Logout)</button>
        <button className="btn-delete" onClick={deletarConta}>Deletar Conta Definitivamente</button>
      </div>
    </>
  );
}
