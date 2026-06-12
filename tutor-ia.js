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
            
            <div id="tutor-config-panel">
                <p style="margin-top:0;"><strong>Chave de API do Gemini (Grátis)</strong></p>
                <p style="font-size:0.85em; color:gray;">Obtenha sua chave gratuita no <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--tutor-user-msg);">Google AI Studio</a>. Fica salva apenas no seu navegador.</p>
                <input type="password" id="tutor-api-key-input" placeholder="Cole sua chave aqui (opcional se houver no server)...">
                <button id="tutor-save-key">Salvar Chave</button>
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
    const inputKey = document.getElementById('tutor-api-key-input');
    const btnSaveKey = document.getElementById('tutor-save-key');
    const messagesBox = document.getElementById('tutor-messages');
    const inputField = document.getElementById('tutor-input');
    const btnSend = document.getElementById('tutor-send');

    // Inicializa Input Key
    inputKey.value = state.apiKey;

    // Eventos de UI
    fab.addEventListener('click', toggleChat);
    btnClose.addEventListener('click', toggleChat);
    btnConfig.addEventListener('click', () => {
        configPanel.style.display = configPanel.style.display === 'block' ? 'none' : 'block';
    });
    btnSaveKey.addEventListener('click', () => {
        const val = inputKey.value.trim();
        state.apiKey = val;
        if(val) {
            localStorage.setItem('gemini_api_key', val);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
        configPanel.style.display = 'none';
        addMessage("Configuração salva! A chave será usada nas requisições.", "ai");
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
                headers['X-Gemini-Key'] = state.apiKey;
            }

            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ messages: state.messages })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro desconhecido da API');
            }

            const aiReply = data.reply;
            addMessage(aiReply, 'ai');
            state.messages.push({ role: 'model', parts: [{ text: aiReply }] });

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
