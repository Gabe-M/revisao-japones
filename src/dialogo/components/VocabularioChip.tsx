import React, { useState } from 'react';
import FuriganaText from './FuriganaText';

interface VocabularioChipProps {
    item: string;
    leitura: string;
    significado: string;
    jlpt?: string;
    jaPossui: boolean;
    onAdd: () => void;
}

export default function VocabularioChip({ item, leitura, significado, jlpt, jaPossui, onAdd }: VocabularioChipProps) {
    const [added, setAdded] = useState(false);

    const isAdded = jaPossui || added;

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
            <div>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '4px' }}>
                    <FuriganaText text={item} fallbackLeitura={leitura} />
                </div>
                <div style={{ fontSize: '0.9em', color: 'gray' }}>{significado}</div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {jlpt && (
                    <span style={{ fontSize: '0.75em', padding: '2px 6px', background: 'var(--primary-color)', color: 'white', borderRadius: '4px' }}>
                        {jlpt}
                    </span>
                )}
                
                {isAdded ? (
                    <span style={{ fontSize: '0.8em', color: 'green', fontWeight: 'bold', padding: '4px 8px', background: 'rgba(0, 255, 0, 0.1)', borderRadius: '12px' }}>
                        ✓ Já tenho
                    </span>
                ) : (
                    <button 
                        onClick={() => { setAdded(true); onAdd(); }}
                        style={{ padding: '6px 12px', background: 'var(--highlight-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8em' }}
                    >
                        + Adicionar
                    </button>
                )}
            </div>
        </div>
    );
}
