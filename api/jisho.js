const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function obterUserIdDoToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.substring(7);
    try {
        const parts = token.split('.');
        if (parts.length === 3) {
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
            if (payload && payload.sub && payload.role === 'authenticated') {
                return payload.sub;
            }
        }
    } catch (e) {
        console.error("Erro ao decodificar JWT:", e);
    }
    return null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const { acao, termo } = req.query;

    // Captura o token de quem está logado
    const tokenUsuario = req.headers['authorization'] || `Bearer ${SUPABASE_KEY}`;
    const userId = obterUserIdDoToken(tokenUsuario);

    // AÇÃO 1: Buscar vocabulário
    if (acao === 'listar') {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario?select=*&order=item.asc`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario,
                    "Cache-Control": "no-cache"
                },
                cache: 'no-store'
            });
            const dados = await response.json();
            return res.status(200).json(dados);
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao ler o banco' });
        }
    }

    // AÇÃO 2: Salvar palavra nova
    if (acao === 'salvar' && req.method === 'POST') {
        try {
            const corpo = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const itensNovosInput = Array.isArray(corpo) ? corpo : [corpo];

            if (itensNovosInput.length === 0) {
                return res.status(200).json([]);
            }

            // 1. Buscar os termos equivalentes no banco para fundir conjuntos em caso de duplicidade
            const nomesItens = itensNovosInput.map(i => i.item).filter(Boolean);
            let cardsExistentesMap = new Map();

            if (nomesItens.length > 0) {
                const listaItens = nomesItens.map(i => `"${i.replace(/"/g, '\\"')}"`).join(',');
                const responseListar = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario?item=in.(${encodeURIComponent(listaItens)})`, {
                    headers: {
                        "apikey": SUPABASE_KEY,
                        "Authorization": tokenUsuario
                    }
                });
                if (responseListar.ok) {
                    const dadosExistentes = await responseListar.json();
                    if (Array.isArray(dadosExistentes)) {
                        dadosExistentes.forEach(c => {
                            cardsExistentesMap.set(c.item, c);
                        });
                    }
                }
            }

            // Helpers internos para conjuntos
            const extrairConjuntosInterno = (notas) => {
                let conjuntos = [];
                if (notas) {
                    const match = notas.match(/\[Conjuntos:\s*([^\]]+)\]/);
                    if (match) {
                        conjuntos = match[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
                    }
                }
                if (!conjuntos.includes('Geral')) {
                    conjuntos.unshift('Geral');
                }
                return conjuntos;
            };

            const formatarNotasComConjuntosInterno = (notasLimpa, conjuntos) => {
                if (conjuntos.length === 0) return notasLimpa;
                const tag = `[Conjuntos: ${conjuntos.join(', ')}]`;
                return notasLimpa ? `${notasLimpa}\n${tag}` : tag;
            };

            const removerTagConjuntosInterno = (notas) => {
                if (!notas) return '';
                return notas.replace(/\s*\[Conjuntos:\s*([^\]]+)\]/, '').trim();
            };

            // 2. Monta o payload fundindo os conjuntos de itens duplicados
            const payloadFinal = [];
            for (const itemNovo of itensNovosInput) {
                if (!itemNovo.item) continue;

                if (cardsExistentesMap.has(itemNovo.item)) {
                    const cardExistente = cardsExistentesMap.get(itemNovo.item);
                    
                    // Extrai conjuntos de ambos e junta-os
                    const conjuntosExistentes = extrairConjuntosInterno(cardExistente.notas);
                    const conjuntosNovos = extrairConjuntosInterno(itemNovo.notas);
                    const conjuntosFundidos = Array.from(new Set([...conjuntosExistentes, ...conjuntosNovos]));

                    // Remove as tags e reconstrói as notas fundidas
                    const notasLimpaExistente = removerTagConjuntosInterno(cardExistente.notas);
                    const notasLimpaNova = removerTagConjuntosInterno(itemNovo.notas);
                    let notasFinaisLimpa = notasLimpaExistente;
                    if (notasLimpaNova && notasLimpaNova !== notasLimpaExistente) {
                        notasFinaisLimpa = notasLimpaExistente ? `${notasLimpaExistente}\n${notasLimpaNova}` : notasLimpaNova;
                    }

                    const novasNotas = formatarNotasComConjuntosInterno(notasFinaisLimpa, conjuntosFundidos);

                    payloadFinal.push({
                        id: cardExistente.id, // Usa o mesmo ID para disparar a atualização na restrição unique
                        item: cardExistente.item,
                        leitura: itemNovo.leitura || cardExistente.leitura,
                        significado: itemNovo.significado || cardExistente.significado,
                        categoria: itemNovo.categoria || cardExistente.categoria,
                        jlpt: itemNovo.jlpt || cardExistente.jlpt,
                        notas: novasNotas,
                        user_id: userId || cardExistente.user_id
                    });
                } else {
                    if (userId) {
                        itemNovo.user_id = userId;
                    }
                    payloadFinal.push(itemNovo);
                }
            }

            if (payloadFinal.length === 0) {
                return res.status(200).json([]);
            }

            const response = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario`, {
                method: 'POST',
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario,
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates,return=representation"
                },
                cache: 'no-store',
                body: JSON.stringify(Array.isArray(corpo) ? payloadFinal : payloadFinal[0])
            });

            const resultado = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({
                    error: 'O Supabase rejeitou a gravação',
                    detalhes: resultado,
                    debug: {
                        userId: userId,
                        tokenUsuarioLength: tokenUsuario ? tokenUsuario.length : 0,
                        payloadFinal: payloadFinal
                    }
                });
            }

            return res.status(201).json(resultado);
        } catch (error) {
            return res.status(500).json({ error: 'Falha no servidor', mensagem: error.message });
        }
    }
 
    // AÇÃO 4: Atualizar termo (ex: trocar de conjunto/categoria)
    if (acao === 'atualizar' && req.method === 'PATCH') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'ID ausente para atualização' });
        try {
            const corpo = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            
            const response = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                cache: 'no-store',
                body: JSON.stringify(corpo)
            });

            const resultado = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({
                    error: 'O Supabase rejeitou a atualização',
                    detalhes: resultado
                });
            }

            return res.status(200).json(resultado);
        } catch (error) {
            return res.status(500).json({ error: 'Falha no servidor ao atualizar', mensagem: error.message });
        }
    }

    // AÇÃO 5: Deletar termo
    if (acao === 'deletar' && (req.method === 'DELETE' || req.method === 'POST')) {
        const { id, item } = req.query;
        if (!id && !item) {
            return res.status(400).json({ error: 'ID ou Item ausente para exclusão' });
        }
        try {
            let urlParam = id ? `id=eq.${id}` : `item=eq.${encodeURIComponent(item)}`;
            const response = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario?${urlParam}`, {
                method: 'DELETE',
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario,
                    "Prefer": "return=representation"
                },
                cache: 'no-store'
            });

            const resultado = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({
                    error: 'O Supabase rejeitou a exclusão',
                    detalhes: resultado
                });
            }

            // se o array vier vazio, nada foi excluido (possivel erro de RLS ou ID inexistente)
            if (Array.isArray(resultado) && resultado.length === 0) {
                return res.status(404).json({ error: 'Nenhum registro excluído (ID não encontrado ou RLS bloqueou).' });
            }

            return res.status(200).json(resultado);
        } catch (error) {
            return res.status(500).json({ error: 'Falha no servidor ao deletar', mensagem: error.message });
        }
    }

    // AÇÃO 6: Deletar conjunto inteiro
    if (acao === 'deletar_conjunto' && req.method === 'POST') {
        try {
            const corpo = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const { conjunto, modoExclusao } = corpo;

            if (!conjunto) {
                return res.status(400).json({ error: 'Conjunto ausente para exclusão' });
            }

            // 1. Buscar todos os vocabulários do usuário para processar em memória
            const responseListar = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario?select=*`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": tokenUsuario
                }
            });
            const todosCards = await responseListar.json();

            if (!responseListar.ok) {
                return res.status(responseListar.status).json({
                    error: 'Erro ao listar termos para exclusão de conjunto',
                    detalhes: todosCards
                });
            }

            const idsParaDeletar = [];
            const itensParaDeletar = [];
            const cardsParaAtualizar = [];

            // Helper para extrair conjuntos
            const extrairConjuntosInterno = (notas) => {
                let conjuntos = [];
                if (notas) {
                    const match = notas.match(/\[Conjuntos:\s*([^\]]+)\]/);
                    if (match) {
                        conjuntos = match[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
                    }
                }
                return conjuntos;
            };

            const removerTagConjuntosInterno = (notas, conjRemover) => {
                if (!notas) return '';
                const conjuntos = extrairConjuntosInterno(notas);
                const novosConjuntos = conjuntos.filter(c => c !== conjRemover);
                
                // Remove a linha do conjunto completamente
                const notasSemTag = notas.replace(/\s*\[Conjuntos:\s*([^\]]+)\]/, '').trim();
                
                if (novosConjuntos.length === 0) {
                    return notasSemTag;
                }
                
                const tag = `[Conjuntos: ${novosConjuntos.join(', ')}]`;
                return notasSemTag ? `${notasSemTag}\n${tag}` : tag;
            };

            for (const card of todosCards) {
                const conjuntos = extrairConjuntosInterno(card.notas);
                if (conjuntos.includes(conjunto)) {
                    const outrosConjuntos = conjuntos.filter(c => c !== conjunto && c !== 'Geral');
                    
                    if (modoExclusao === 'todos_associados' || outrosConjuntos.length === 0) {
                        idsParaDeletar.push(card.id);
                        if (card.item) {
                            itensParaDeletar.push(card.item);
                        }
                    } else {
                        // Apenas remove o conjunto das notas do card
                        const novasNotas = removerTagConjuntosInterno(card.notas, conjunto);
                        cardsParaAtualizar.push({
                            id: card.id,
                            item: card.item,
                            leitura: card.leitura,
                            significado: card.significado,
                            categoria: card.categoria,
                            notas: novasNotas,
                            user_id: userId || card.user_id
                        });
                    }
                }
            }

            // Executa as deleções
            if (idsParaDeletar.length > 0) {
                const responseDelete = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario?id=in.(${idsParaDeletar.join(',')})`, {
                    method: 'DELETE',
                    headers: {
                        "apikey": SUPABASE_KEY,
                        "Authorization": tokenUsuario,
                        "Prefer": "return=representation"
                    }
                });
                
                if (!responseDelete.ok) {
                    const errDelete = await responseDelete.json();
                    return res.status(responseDelete.status).json({
                        error: 'Erro ao deletar cards do conjunto',
                        detalhes: errDelete
                    });
                }

                // Deleta também o progresso do SRS correspondente a esses itens deletados
                if (itensParaDeletar.length > 0) {
                    const listaItens = itensParaDeletar.map(i => `"${i.replace(/"/g, '\\"')}"`).join(',');
                    await fetch(`${SUPABASE_URL}/rest/v1/srs_progresso?item=in.(${encodeURIComponent(listaItens)})`, {
                        method: 'DELETE',
                        headers: {
                            "apikey": SUPABASE_KEY,
                            "Authorization": tokenUsuario
                        }
                    });
                }
            }

            // Executa as atualizações (remover a tag do conjunto)
            if (cardsParaAtualizar.length > 0) {
                const responseUpdate = await fetch(`${SUPABASE_URL}/rest/v1/vocabulario`, {
                    method: 'POST', // UPSERT
                    headers: {
                        "apikey": SUPABASE_KEY,
                        "Authorization": tokenUsuario,
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates,return=representation"
                    },
                    body: JSON.stringify(cardsParaAtualizar)
                });

                if (!responseUpdate.ok) {
                    const errUpdate = await responseUpdate.json();
                    return res.status(responseUpdate.status).json({
                        error: 'Erro ao atualizar tags dos cards',
                        detalhes: errUpdate
                    });
                }
            }

            return res.status(200).json({
                deletados: idsParaDeletar.length,
                atualizados: cardsParaAtualizar.length
            });
        } catch (error) {
            return res.status(500).json({ error: 'Falha no servidor ao processar exclusão do conjunto', mensagem: error.message });
        }
    }

    // AÇÃO 3: Traduzir no Jisho
    if (!termo) return res.status(400).json({ error: 'Termo ausente' });

    try {
        const urlJisho = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(termo)}`;
        const response = await fetch(urlJisho);
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao consultar o Jisho' });
    }
}