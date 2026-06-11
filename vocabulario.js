const dadosRevisao = [
    // KANJIS
    { categoria: 'Kanji', item: '私', leitura: 'Watashi / Atashi', significado: 'Eu', notas: 'Radical: 亻 (pessoa) + 厶 (privado).' },
    { categoria: 'Kanji', item: '日', leitura: 'Ni / Hi / Nichi', significado: 'Sol / Dia', notas: 'Radical pictográfico primitivo.' },
    { categoria: 'Kanji', item: '本', leitura: 'Hon', significado: 'Livro / Raiz / Origem', notas: 'Radical: 木 (árvore) + 一 (traço na base indicando raiz).' },
    { categoria: 'Kanji', item: '語', leitura: 'Go', significado: 'Idioma / Palavra', notas: 'Radical: 言 (fala) + 五 (cinco) + 口 (boca).' },
    { categoria: 'Kanji', item: '勉', leitura: 'Ben', significado: 'Esforço', notas: 'Radical: 力 (força) + 免 (escapar).' },
    { categoria: 'Kanji', item: '強', leitura: 'Kyou / Tsuyo-i', significado: 'Forte / Forçar', notas: 'Radical: 弓 (arco) + 口 (boca) + 虫 (inseto).' },
    { categoria: 'Kanji', item: '何', leitura: 'Nan / Nani', significado: 'O quê', notas: 'Radical: 亻 (pessoa) + 可 (permitir).' },
    { categoria: 'Kanji', item: '好', leitura: 'Suki', significado: 'Gostar', notas: 'Radical: 女 (mulher) + 子 (criança).' },
    { categoria: 'Kanji', item: '毎', leitura: 'Mai', significado: 'Todo / Cada', notas: 'Base histórica no radical 毋 (mãe).' },
    { categoria: 'Kanji', item: '兄', leitura: 'Ani', significado: 'Irmão mais velho', notas: 'Radical: 儿 (pernas) + 口 (boca).' },

    // PARTICULAS
    { categoria: 'Partícula', item: 'は', leitura: 'Wa', significado: 'Marcador de Tópico', notas: 'Indica sobre o que a frase fala.' },
    { categoria: 'Partícula', item: 'を', leitura: 'Wo / O', significado: 'Objeto Direto', notas: 'Indica quem/o que sofre a ação do verbo.' },
    { categoria: 'Partícula', item: 'ね', leitura: 'Ne', significado: 'Confirmação', notas: 'Equivalente a "né?". Busca empatia/concordância.' },
    { categoria: 'Partícula', item: 'の', leitura: 'No', significado: 'Posse / Especificação', notas: 'Equivalente a "de/do/da". Conecta substantivos.' },
    { categoria: 'Partícula', item: 'か', leitura: 'Ka', significado: 'Interrogação', notas: 'Transforma a frase em pergunta.' },
    { categoria: 'Partícula', item: 'が', leitura: 'Ga', significado: 'Sujeito / Foco', notas: 'Aponta quem realiza ou sofre um estado (ex: gostar, existir).' },

    // VERBOS
    { categoria: 'Verbo', item: 'です', leitura: 'Desu', significado: 'Ser (Presente/Polido)', notas: 'Afirmação de estado.' },
    { categoria: 'Verbo', item: 'でした', leitura: 'Deshita', significado: 'Ser (Passado/Polido)', notas: 'Foi / Era.' },
    { categoria: 'Verbo', item: 'します', leitura: 'Shimasu', significado: 'Fazer (Presente/Polido)', notas: 'Ação habitual ou futura.' },
    { categoria: 'Verbo', item: 'しています', leitura: 'Shite imasu', significado: 'Gerúndio (Progresso)', notas: 'Ação contínua ("estou fazendo").' },
    { categoria: 'Verbo', item: 'いる', leitura: 'Iru', significado: 'Existir / Estar', notas: 'Apenas para seres vivos (casual).' },
    { categoria: 'Verbo', item: 'います', leitura: 'Imasu', significado: 'Existir / Estar', notas: 'Apenas para seres vivos (polido).' },

    // DEMONSTRATIVOS
    { categoria: 'Demonstrativo', item: 'これ', leitura: 'Kore', significado: 'Isto', notas: 'Perto de quem fala.' },
    { categoria: 'Demonstrativo', item: 'それ', leitura: 'Sore', significado: 'Isso', notas: 'Perto de quem ouve.' },
    { categoria: 'Demonstrativo', item: 'あれ', leitura: 'Are', significado: 'Aquilo', notas: 'Longe de ambos.' },
    { categoria: 'Demonstrativo', item: 'どれ', leitura: 'Dore', significado: 'Qual?', notas: 'Escolha entre três ou mais opções.' },

    // VOCABULARIO
    { categoria: 'Vocabulário', item: 'いい', leitura: 'Ii', significado: 'Bom', notas: 'Adjetivo.' },
    { categoria: 'Vocabulário', item: 'パソコン', leitura: 'Pasokon', significado: 'Computador / PC', notas: 'Abreviação em Katakana de Personal Computer.' },
    { categoria: 'Vocabulário', item: '日本語', leitura: 'Nihongo', significado: 'Língua Japonesa', notas: 'A origem do sol + idioma.' },
    { categoria: 'Vocabulário', item: '勉強', leitura: 'Benkyou', significado: 'Estudo', notas: 'Forçar-se a progredir.' },
    { categoria: 'Vocabulário', item: '毎日', leitura: 'Mainichi', significado: 'Todos os dias', notas: 'Todo + dia.' }
];