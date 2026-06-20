import React, { useState } from 'react';
import InteractiveText from '../../components/InteractiveText';

interface VocabularioChipProps {
    item: string;
    leitura: string;
    significado: string;
    jlpt?: string;
    jaPossui: boolean;
    onAdd: () => void;
    onClickCard?: () => void;
}

export default function VocabularioChip({ item, leitura, significado, jlpt, jaPossui, onAdd, onClickCard }: VocabularioChipProps) {
    const [added, setAdded] = useState(false);

    const isAdded = jaPossui || added;

    return (
        <div 
            onClick={onClickCard}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '8px', cursor: onClickCard ? 'pointer' : 'default', transition: 'background 0.2s' }}
            onMouseOver={(e) => onClickCard && (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
            onMouseOut={(e) => onClickCard && (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
        >
            <div>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '4px' }}>
                    <InteractiveText text={item} fallbackLeitura={leitura} />
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
                        onClick={(e) => { e.stopPropagation(); setAdded(true); onAdd(); }}
                        style={{ padding: '6px 12px', background: 'var(--highlight-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8em' }}
                    >
                        + Adicionar
                    </button>
                )}
            </div>
        </div>
    );
}
