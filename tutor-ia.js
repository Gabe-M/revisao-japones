/**
 * Sensei IA - Widget flutuante de chat integrado com o Gemini
 */
(function () {
    // Evita carregar duas vezes
    if (window.TutorIA) return;

    // Configurações e Estado
    const state = {
        isOpen: false,
        apiKey: localStorage.getItem('gemini_api_key') || '',
        messages: [],
        isWaiting: false
    };

    // Estilos CSS do Chatbot
    const style = document.createElement('style');
    style.innerHTML = `
        /* Variáveis do Tema Baseadas no App Principal */
        :root {
            --tutor-bg: var(--card-bg, #ffffff);
            --tutor-text: var(--text-color, #333333);
            --tutor-primary: var(--primary-color, #2c3e50);
            --tutor-border: var(--border-color, #dddddd);
            --tutor-user-msg: var(--learned-color, #2980b9);
            --tutor-ai-msg: #ecf0f1;
            --tutor-ai-text: #2c3e50;
        }

        [data-theme="dark"] {
            --tutor-ai-msg: #34495e;
            --tutor-ai-text: #ecf0f1;
        }

        /* Botão Flutuante */
        #tutor-fab {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            background-color: var(--tutor-primary);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            z-index: 10000;
            transition: transform 0.3s, background-color 0.3s;
        }
        #tutor-fab:hover {
            transform: scale(1.1);
            background-color: var(--tutor-user-msg);
        }

        /* Janela do Chat */
        #tutor-window {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 350px;
            max-width: calc(100vw - 40px);
            height: 500px;
            max-height: calc(100vh - 120px);
            background: var(--tutor-bg);
            border: 1px solid var(--tutor-border);
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            display: flex;
            flex-direction: column;
            z-index: 10000;
            opacity: 0;
            pointer-events: none;
            transform: translateY(20px);
            transition: opacity 0.3s, transform 0.3s;
            overflow: hidden;
            color: var(--tutor-text);
            font-family: 'Segoe UI', sans-serif;
        }
        #tutor-window.open {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }

        /* Cabeçalho do Chat */
        #tutor-header {
            background: var(--tutor-primary);
            color: white;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
            font-size: 1.1em;
        }
        #tutor-header-actions {
            display: flex;
            gap: 10px;
        }
        .tutor-icon-btn {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 16px;
            padding: 0;
            opacity: 0.8;
        }
        .tutor-icon-btn:hover {
            opacity: 1;
        }

        /* Painel de Configuração (API Key) */
        #tutor-config-panel {
            display: none;
            padding: 15px;
            background: var(--tutor-bg);
            border-bottom: 1px solid var(--tutor-border);
            font-size: 0.9em;
        }
        #tutor-config-panel input {
            width: 100%;
            padding: 8px;
            margin-top: 5px;
            margin-bottom: 10px;
            box-sizing: border-box;
            border: 1px solid var(--tutor-border);
            border-radius: 4px;
            background: var(--tutor-bg);
            color: var(--tutor-text);
        }
        #tutor-config-panel button {
            background: var(--tutor-primary);
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
        }

        /* Área de Mensagens */
        #tutor-messages {
            flex-grow: 1;
            padding: 15px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .tutor-msg {
            max-width: 85%;
            padding: 10px 14px;
            border-radius: 15px;
            font-size: 0.95em;
            line-height: 1.4;
            word-wrap: break-word;
        }
        .tutor-msg-user {
            align-self: flex-end;
            background: var(--tutor-user-msg);
            color: white;
            border-bottom-right-radius: 4px;
        }
        .tutor-msg-ai {
            align-self: flex-start;
            background: var(--tutor-ai-msg);
            color: var(--tutor-ai-text);
            border-bottom-left-radius: 4px;
        }

        /* Formatação de Markdown Básica na IA */
        .tutor-msg-ai strong { color: var(--tutor-user-msg); }
        .tutor-msg-ai p { margin: 0 0 8px 0; }
        .tutor-msg-ai p:last-child { margin: 0; }

        /* Área de Input */
        #tutor-input-area {
            display: flex;
            padding: 10px;
            border-top: 1px solid var(--tutor-border);
            background: var(--tutor-bg);
        }
        #tutor-input {
            flex-grow: 1;
            padding: 10px;
            border: 1px solid var(--tutor-border);
            border-radius: 20px;
            background: var(--tutor-bg);
            color: var(--tutor-text);
            outline: none;
        }
        #tutor-send {
            background: none;
            border: none;
            color: var(--tutor-primary);
            font-size: 24px;
            cursor: pointer;
            padding: 0 10px;
            display: flex;
            align-items: center;
        }
        #tutor-send:disabled {
            color: gray;
            cursor: not-allowed;
        }
        
        .tutor-typing {
            font-style: italic;
            color: gray;
            font-size: 0.85em;
            align-self: flex-start;
            margin-left: 5px;
        }
    `;
    document.head.appendChild(style);

    // Estrutura HTML
    const container = document.createElement('div');
    container.innerHTML = `
        <div id="tutor-fab">🤖</div>
        <div id="tutor-window">
            <div id="tutor-header">
                <span>Sensei IA</span>
                <div id="tutor-header-actions">
                    <button class="tutor-icon-btn" id="tutor-btn-config" title="Configurar Chave API">⚙️</button>
                    <button class="tutor-icon-btn" id="tutor-btn-close" title="Fechar">✖</button>
                </div>
            </div>
            
            <div id="tutor-config-panel" style="border-bottom: 2px solid var(--tutor-border); padding: 15px; text-align: center;">
                <p style="margin-top:0; font-weight: bold; font-size: 1em; color: var(--tutor-primary);">⚙️ Configurações da IA</p>
                <p style="font-size:0.85em; line-height:1.4; color:gray; margin-bottom: 15px;">
                    Você pode alterar a configuração de limite de velocidade da IA escolhendo entre usar a chave do servidor ou sua chave própria.
                </p>
                <button id="tutor-btn-setup-redirect" style="width: 100%; padding: 8px 12px; font-weight: bold; border-radius: 6px; background-color: var(--tutor-primary); color: white; border: none; cursor: pointer;">Configurar IA (Setup)</button>
            </div>

            <div id="tutor-messages">
                <div class="tutor-msg tutor-msg-ai">Olá! Eu sou o Sensei IA. Como posso ajudar com seus estudos de japonês hoje?</div>
            </div>
            
            <div id="tutor-input-area">
                <input type="text" id="tutor-input" placeholder="Digite sua pergunta..." autocomplete="off">
                <button id="tutor-send">➤</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    // Elementos DOM
    const fab = document.getElementById('tutor-fab');
    const win = document.getElementById('tutor-window');
    const btnClose = document.getElementById('tutor-btn-close');
    const btnConfig = document.getElementById('tutor-btn-config');
    const configPanel = document.getElementById('tutor-config-panel');
    const btnSetupRedirect = document.getElementById('tutor-btn-setup-redirect');
    const messagesBox = document.getElementById('tutor-messages');
    const inputField = document.getElementById('tutor-input');
    const btnSend = document.getElementById('tutor-send');

    // Alerta o usuário no chat caso a chave não esteja configurada
    const iaPref = localStorage.getItem('ia_preference');
    if (iaPref === 'custom' && !state.apiKey) {
        const divWarning = document.createElement('div');
        divWarning.className = 'tutor-msg tutor-msg-ai';
        divWarning.style.border = '1px solid #e67e22';
        divWarning.style.background = 'rgba(230, 126, 34, 0.08)';
        divWarning.style.marginTop = '10px';
        divWarning.innerHTML = `
            <strong>⚠️ Atenção: Chave de API ausente!</strong><br><br>
            Para conversar com o Sensei e traduzir os termos, você precisa configurar sua própria chave de API:<br><br>
            1. Acesse a <strong><a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--tutor-user-msg); font-weight:bold; text-decoration:underline;">OpenAI Platform</a></strong>.<br>
            2. Crie uma chave de API secreta (começando com sk-).<br>
            3. Clique no botão de engrenagem <strong>⚙️</strong> no topo do chat, cole a chave e salve.
        `;
        messagesBox.appendChild(divWarning);
    }

    // Eventos de UI
    fab.addEventListener('click', toggleChat);
    btnClose.addEventListener('click', toggleChat);
    btnConfig.addEventListener('click', () => {
        configPanel.style.display = configPanel.style.display === 'block' ? 'none' : 'block';
    });
    
    btnSetupRedirect.addEventListener('click', () => {
        window.location.href = "setup.html";
    });

    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    btnSend.addEventListener('click', sendMessage);

    function toggleChat() {
        state.isOpen = !state.isOpen;
        if (state.isOpen) {
            win.classList.add('open');
            inputField.focus();
        } else {
            win.classList.remove('open');
        }
    }

    // Processamento de Markdown simples
    function formatMarkdown(text) {
        if (!text) return '';
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Negrito **texto**
            .replace(/\*(.*?)\*/g, '<em>$1</em>')             // Itálico *texto*
            .replace(/\n/g, '<br>');                          // Quebras de linha
        return html;
    }

    function addMessage(text, role) {
        const div = document.createElement('div');
        div.className = 'tutor-msg tutor-msg-' + role;
        
        if (role === 'ai') {
            div.innerHTML = formatMarkdown(text);
        } else {
            div.textContent = text;
        }

        messagesBox.appendChild(div);
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    function showTyping() {
        const div = document.createElement('div');
        div.className = 'tutor-typing';
        div.id = 'tutor-typing-indicator';
        div.textContent = 'Sensei está digitando...';
        messagesBox.appendChild(div);
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    function hideTyping() {
        const el = document.getElementById('tutor-typing-indicator');
        if (el) el.remove();
    }

    async function sendMessage(overrideText = null) {
        if (state.isWaiting) return;
        
        const text = overrideText || inputField.value.trim();
        if (!text) return;

        inputField.value = '';
        addMessage(text, 'user');
        
        // Adiciona ao histórico para contexto do Gemini
        state.messages.push({ role: 'user', parts: [{ text: text }] });

        state.isWaiting = true;
        btnSend.disabled = true;
        showTyping();

        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            if (state.apiKey) {
                headers['X-OpenAI-Key'] = state.apiKey;
                headers['X-Gemini-Key'] = state.apiKey;
            }

            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ messages: state.messages })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Erro desconhecido da API');
            }

            const aiReply = data.reply;
            addMessage(aiReply, 'ai');
            state.messages.push({ role: 'model', parts: [{ text: aiReply }] });
            
            if (data.action === 'add_terms' && data.terms && data.terms.length > 0) {
                await salvarTermosIA(data.terms);
            } else if (data.action === 'remove_terms' && data.terms && data.terms.length > 0) {
                await removerTermosIA(data.terms);
            }

        } catch (error) {
            console.error(error);
            addMessage("❌ Ocorreu um erro: " + error.message, 'ai');
            // Remove a mensagem do usuário do histórico se falhou
            state.messages.pop();
        } finally {
            state.isWaiting = false;
            btnSend.disabled = false;
            hideTyping();
        }
    }

    async function removerTermosIA(termos) {
        try {
            const sessaoLocalStorage = localStorage.getItem('supabase_session');
            if (!sessaoLocalStorage) {
                addMessage("❌ Você precisa estar logado para remover termos.", 'ai');
                return;
            }
            const sessao = JSON.parse(sessaoLocalStorage);
            const tokenDeAcesso = `Bearer ${sessao.access_token}`;

            let removidos = 0;
            let naoEncontrados = [];
            let padroesDoSistema = [];

            for (const t of termos) {
                const itemLimpo = t.trim();

                let ehPadrao = false;
                if (typeof dadosRevisao !== 'undefined' && Array.isArray(dadosRevisao)) {
                    ehPadrao = dadosRevisao.some(d => d.item === itemLimpo);
                }

                const res = await fetch(`/api/jisho?acao=deletar&item=${encodeURIComponent(itemLimpo)}`, {
                    method: 'DELETE',
                    headers: {
                        "Authorization": tokenDeAcesso
                    }
                });

                if (res.ok) {
                    const resultado = await res.json();
                    if (Array.isArray(resultado) && resultado.length > 0) {
                        removidos++;
                    } else {
                        if (ehPadrao) {
                            padroesDoSistema.push(itemLimpo);
                        } else {
                            naoEncontrados.push(itemLimpo);
                        }
                    }
                } else {
                    naoEncontrados.push(itemLimpo);
                }
            }

            if (removidos > 0) {
                addMessage(`✅ Sucesso! ${removidos} termo(s) removido(s) do seu banco de dados. Atualize a página se necessário.`, 'ai');
                if (typeof window.carregarDados === 'function') {
                    window.carregarDados().then(() => {
                        if (typeof window.aplicarFiltros === 'function') {
                            window.aplicarFiltros();
                        }
                    });
                } else if (typeof window.carregarFrasesDinamicas === 'function') {
                    window.carregarFrasesDinamicas();
                }
            }
            if (padroesDoSistema.length > 0) {
                addMessage(`⚠️ O(s) termo(s) [${padroesDoSistema.join(', ')}] faz(em) parte do vocabulário padrão do sistema e não pode(m) ser removido(s).`, 'ai');
            }
            if (naoEncontrados.length > 0 && padroesDoSistema.length === 0) {
                addMessage(`🔍 Não encontrei o(s) termo(s) [${naoEncontrados.join(', ')}] no seu banco de dados personalizado para remover.`, 'ai');
            }

        } catch (error) {
            console.error("Erro ao remover termos da IA", error);
            addMessage("❌ Erro interno ao tentar remover no banco de dados.", 'ai');
        }
    }

    async function salvarTermosIA(termos) {
        try {
            const sessaoLocalStorage = localStorage.getItem('supabase_session');
            if (!sessaoLocalStorage) {
                addMessage("❌ Você precisa estar logado para salvar termos.", 'ai');
                return;
            }
            const sessao = JSON.parse(sessaoLocalStorage);
            const tokenDeAcesso = `Bearer ${sessao.access_token}`;
            const idDoUsuarioLogado = sessao.user.id;

            // Obter termos existentes no banco de dados
            const responseDb = await fetch('/api/jisho?acao=listar', {
                headers: { 
                    "Authorization": tokenDeAcesso,
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0"
                },
                cache: "no-store"
            });
            const dadosDb = responseDb.ok ? await responseDb.json() : [];
            
            const itensExistentes = new Set();
            if (Array.isArray(dadosDb)) {
                dadosDb.forEach(d => {
                    if (d && d.item) itensExistentes.add(d.item.trim());
                });
            }
            
            // Obter termos existentes locais (dadosRevisao) se disponível
            if (typeof dadosRevisao !== 'undefined' && Array.isArray(dadosRevisao)) {
                dadosRevisao.forEach(d => {
                    if (d && d.item) itensExistentes.add(d.item.trim());
                });
            }

            let salvos = 0;
            let duplicados = [];
            for (const t of termos) {
                const itemLimpo = t.item.trim();
                if (itensExistentes.has(itemLimpo)) {
                    duplicados.push(itemLimpo);
                    continue;
                }

                const notas = t.conjunto ? `[Conjuntos: ${t.conjunto}]` : `[Conjuntos: Geral]`;
                
                const novoTermo = {
                    item: itemLimpo,
                    leitura: t.leitura,
                    significado: t.significado,
                    categoria: t.categoria || 'Vocabulário',
                    jlpt: t.jlpt ? t.jlpt.trim() : null,
                    notas: notas,
                    user_id: idDoUsuarioLogado
                };

                const res = await fetch('/api/jisho?acao=salvar', {
                    method: 'POST',
                    headers: {
                        "Authorization": tokenDeAcesso,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(novoTermo)
                });
                
                if (res.ok) {
                    salvos++;
                    itensExistentes.add(itemLimpo);
                }
            }
            
            if (duplicados.length > 0) {
                addMessage(`⚠️ O(s) seguinte(s) termo(s) já existe(m) no seu banco de dados e não foi(ram) adicionado(s): ${duplicados.join(', ')}`, 'ai');
            }
            
            if (salvos > 0) {
                addMessage(`✅ Sucesso! ${salvos} termo(s) novo(s) adicionado(s) ao seu banco de dados. Atualize a página se necessário.`, 'ai');
                // Se a função carregarDados existir no escopo global, tenta atualizar a view
                if (typeof window.carregarDados === 'function') {
                    window.carregarDados();
                }
            } else if (duplicados.length === 0) {
                addMessage("⚠️ Não foi possível salvar os termos.", 'ai');
            }
            
        } catch (error) {
            console.error("Erro ao salvar termos da IA", error);
            addMessage("❌ Erro interno ao tentar salvar no banco de dados.", 'ai');
        }
    }

    // Objeto Global para interações externas (outros scripts do site)
    window.TutorIA = {
        perguntar: function (texto) {
            if (!state.isOpen) toggleChat();
            setTimeout(() => {
                sendMessage(texto);
            }, 300);
        }
    };

})();
